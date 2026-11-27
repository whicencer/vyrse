import { randomUUID } from "crypto";
import type { AgentView, Card, ChatSummary, Draft, IncomingMessage } from "@vyrse/protocol/legacy";
import type { ReplyKind } from "@vyrse/protocol/legacy";
import { analyze, compose, type Turn } from "./agent";
import { transcribe } from "./voice";
import { knowledgeOf, logHandled, modeOf, ownerNameOf } from "./secretary";

const SILENCE_MS = (Number(process.env.BATCH_SILENCE_SEC) || 10) * 1000;
// Put in front of every secretary reply, so the contact sees it's the AI assistant writing.
const AI_MARK = "🤖 ";
// Earlier messages the agent sees as context.
const HISTORY_LIMIT = 30;

type Batch = {
  id: string;
  connectionId: string;
  chatId: number;
  name: string;
  messages: IncomingMessage[];
  ready: boolean;
  // Has been ready at least once, so it's already in the chat list.
  listed: boolean;
  timer?: NodeJS.Timeout;
  // Bumped on every new message, so a late agent answer for an older burst is dropped.
  version: number;
  agent: AgentView;
  draft: Draft | null;
  // Being answered by the secretary in secretary mode, so not shown on the glasses.
  // keepOpen: something earlier in this batch still waits for the owner, so the chat stays.
  auto: { asked: string; keepOpen: boolean } | null;
  // The secretary already told the contact the owner will get back (once per batch).
  holdSent: boolean;
};

type Queue = {
  // Ordered by the batch's first message (new batches go to the end).
  batches: Batch[];
  // Chat the user opened from the list. null = the glasses show the list.
  // It stays open until answered or closed, even if the contact writes again.
  currentId: string | null;
};

const queues = new Map<number, Queue>();

// Conversation per chat (answered messages included), for the agent's context.
// messageId: the contact's Telegram message, so an edit can update it.
type StoredTurn = Turn & { messageId?: number };
const histories = new Map<string, StoredTurn[]>();
const chatKey = (connectionId: string, chatId: number) => `${connectionId}:${chatId}`;

function remember(connectionId: string, chatId: number, turn: StoredTurn) {
  const key = chatKey(connectionId, chatId);
  const turns = histories.get(key) ?? [];
  turns.push(turn);
  histories.set(key, turns.slice(-HISTORY_LIMIT));
}

// What the agent gets for a batch:
//   history  — the conversation before this batch;
//   open     — this batch as it happened: the contact's messages, plus any "I'll pass it on"
//              notes the secretary already sent in between;
//   toAnswer — the contact's messages after the last reply in the chat: the only ones the
//              secretary should respond to now.
function contextOf(b: Batch) {
  const turns: Turn[] = (histories.get(chatKey(b.connectionId, b.chatId)) ?? []).map(({ from, text }) => ({ from, text }));

  // The batch starts at its first message: walk back over its contact messages.
  let start = turns.length;
  for (let seen = 0; start > 0 && seen < b.messages.length; ) if (turns[--start].from === "contact") seen++;

  let lastReply = turns.length;
  while (lastReply > start && turns[lastReply - 1].from === "contact") lastReply--;

  return {
    history: turns.slice(0, start),
    open: turns.slice(start),
    toAnswer: turns.slice(lastReply).map((t) => t.text),
  };
}

// Sends a reply through the bot (set by the server). The result comes back via replied()/autoFailed().
type Sender = (ownerId: number, batch: { id: string; chatId: number; connectionId: string }, text: string, kind: ReplyKind) => void;
let sendReply: Sender = () => {};
export function onSendReply(fn: Sender) {
  sendReply = fn;
}

// Called whenever an owner's queue changes, so the glasses can be updated.
let onChange: (ownerId: number) => void = () => {};
export function onQueueChange(fn: (ownerId: number) => void) {
  onChange = fn;
}

function queueOf(ownerId: number) {
  let q = queues.get(ownerId);
  if (!q) queues.set(ownerId, (q = { batches: [], currentId: null }));
  return q;
}

function stillThere(ownerId: number, b: Batch, version: number) {
  return queues.get(ownerId)?.batches.includes(b) && b.version === version;
}

// optionsOnly: just refresh the summary and options for the owner, never send anything.
function runAgent(ownerId: number, b: Batch, optionsOnly = false) {
  const version = b.version;
  // A refresh keeps the old options on screen until the new ones are ready.
  if (!optionsOnly) b.agent = { status: "thinking" };
  const on = !optionsOnly && !!modeOf(ownerId);
  const knowledge = knowledgeOf(ownerId);

  analyze(b.name, contextOf(b), { on, owner: ownerNameOf(ownerId), knowledge })
    .then((result) => {
      if (!stillThere(ownerId, b, version)) return;
      b.agent = result.options.length
        ? { status: "ready", summary: result.summary, options: result.options }
        : { status: "failed" };

      // Secretary mode: answer what doesn't need the owner, show the rest. The facts it cites must be real.
      const grounded = result.facts.every((i) => Number.isInteger(i) && i >= 0 && i < knowledge.length);
      if (on && result.decision === "answered" && result.reply && grounded) {
        // An earlier part of this chat is already waiting for the owner: answer the new
        // question, but keep the chat on the glasses.
        b.auto = { asked: result.summary, keepOpen: b.holdSent };
        console.log(`Secretary → ${b.name}: ${result.reply}`);
        sendReply(ownerId, b, AI_MARK + result.reply, "auto");
        return;
      }

      b.listed = true;
      // Needs the owner: it's on the glasses now; tell the contact the owner will get back.
      if (on && result.reply && grounded && !b.holdSent) {
        b.holdSent = true;
        console.log(`Secretary → ${b.name} (hold): ${result.reply}`);
        sendReply(ownerId, b, AI_MARK + result.reply, "hold");
      }
    })
    .catch((e) => {
      console.error("Agent analyze failed:", e);
      if (!stillThere(ownerId, b, version)) return;
      // Nobody answered it: the owner has to see it, mode or not.
      b.listed = true;
      b.agent = { status: "failed" };
    })
    .finally(() => onChange(ownerId));
}

export function addMessage(
  ownerId: number,
  connectionId: string,
  chat: { id: number; name: string },
  message: IncomingMessage,
) {
  const q = queueOf(ownerId);
  let batch = q.batches.find((b) => b.connectionId === connectionId && b.chatId === chat.id);

  if (!batch) {
    batch = {
      id: randomUUID(),
      connectionId,
      chatId: chat.id,
      name: chat.name,
      messages: [],
      ready: false,
      listed: false,
      version: 0,
      agent: { status: "thinking" },
      draft: null,
      auto: null,
      holdSent: false,
    };
    q.batches.push(batch);
  }

  batch.messages.push(message);
  batch.name = chat.name;
  batch.ready = false;
  batch.version++;
  // Options and drafts were for the older messages.
  batch.agent = { status: "thinking" };
  batch.draft = null;
  remember(connectionId, chat.id, { from: "contact", text: message.text, messageId: message.id });

  clearTimeout(batch.timer);
  const b = batch;
  b.timer = setTimeout(() => {
    b.ready = true;
    // In a mode the secretary may answer it itself, so it shows up only once the agent decides.
    if (!modeOf(ownerId)) b.listed = true;
    runAgent(ownerId, b);
    onChange(ownerId);
  }, SILENCE_MS);

  // A brand-new burst stays hidden until it's complete; a listed one switches to "typing".
  if (batch.listed) onChange(ownerId);
}

// The contact edited a message: the new text replaces the old one everywhere, quietly.
export function editMessage(ownerId: number, connectionId: string, chatId: number, messageId: number, text: string) {
  const turn = histories.get(chatKey(connectionId, chatId))?.find((t) => t.messageId === messageId);
  if (turn) turn.text = text;

  const b = queues.get(ownerId)?.batches.find((x) => x.connectionId === connectionId && x.chatId === chatId);
  const message = b?.messages.find((m) => m.id === messageId);
  if (!b || !message || message.text === text) return;
  message.text = text;

  // Still collecting: the agent reads it when the burst is complete. Already shown: redo the
  // summary and options for the new text (never answers by itself, the edit isn't a new message).
  if (b.ready && b.listed && !b.auto) runAgent(ownerId, b, true);
  onChange(ownerId);
}

function remove(ownerId: number, match: (b: Batch) => boolean) {
  const q = queues.get(ownerId);
  if (!q) return;
  const before = q.batches.length;
  q.batches = q.batches.filter((b) => {
    if (!match(b)) return true;
    clearTimeout(b.timer);
    return false;
  });
  if (q.batches.length !== before) onChange(ownerId);
}

// A reply went out (the owner's or the secretary's): remember it and close the batch.
export function replied(ownerId: number, batchId: string, text: string, kind: ReplyKind) {
  const b = findBatch(ownerId, batchId);
  if (!b) return;
  remember(b.connectionId, b.chatId, { from: kind === "owner" ? "owner" : "assistant", text });
  // "Alex will get back to you" doesn't answer anything: the chat stays open for the owner.
  if (kind === "hold") return;
  // The glasses font may not have the emoji, so the log keeps the text without the mark.
  if (kind === "auto" && b.auto) {
    logHandled(ownerId, { name: b.name, asked: b.auto.asked, reply: text.replace(AI_MARK, "") });
    if (b.auto.keepOpen) {
      b.auto = null;
      // The options were made before this answer existed: redo them so they skip it.
      runAgent(ownerId, b, true);
      onChange(ownerId);
      return;
    }
  }
  remove(ownerId, (x) => x === b);
}

// The secretary's own reply didn't go out: the owner has to see the chat after all.
export function autoFailed(ownerId: number, batchId: string) {
  const b = findBatch(ownerId, batchId);
  if (!b) return;
  b.auto = null;
  b.listed = true;
  b.agent = { status: "failed" };
  onChange(ownerId);
}

// The owner answered this chat from their phone.
export function closeChat(ownerId: number, connectionId: string, chatId: number, text?: string) {
  if (text) remember(connectionId, chatId, { from: "owner", text });
  remove(ownerId, (b) => b.connectionId === connectionId && b.chatId === chatId);
}

// The owner tapped "Ignore": close it without answering. The messages stay in the history.
export function dismissBatch(ownerId: number, batchId: string) {
  remove(ownerId, (b) => b.id === batchId);
}

export function findBatch(ownerId: number, batchId: string) {
  return queues.get(ownerId)?.batches.find((b) => b.id === batchId);
}

// The user picked a chat from the list (batchId), or went back to the list (null).
export function openBatch(ownerId: number, batchId: string | null) {
  const q = queueOf(ownerId);
  q.currentId = batchId && q.batches.some((b) => b.id === batchId) ? batchId : null;
  onChange(ownerId);
}

// The user picked one of the agent's options: write the message for it.
export function chooseOption(ownerId: number, batchId: string, option: number) {
  const b = findBatch(ownerId, batchId);
  if (!b || b.agent.status !== "ready" || !b.ready) return;
  const intent = b.agent.options[option];
  if (intent) writeDraft(ownerId, b, intent);
}

// Voice reply: the owner held the temple and spoke. Transcribe it, then the agent turns it
// into the message (same draft screen: Send / Back).
export function dictate(ownerId: number, batchId: string, pcm: Buffer) {
  const b = findBatch(ownerId, batchId);
  if (!b) return;

  const version = b.version;
  const draft: Draft = { status: "writing", intent: "your voice reply" };
  b.draft = draft;
  onChange(ownerId);

  transcribe(pcm)
    .then((text) => {
      if (!stillThere(ownerId, b, version) || b.draft !== draft) return;
      if (!text) {
        b.draft = { status: "failed", intent: "voice reply", voice: true };
        onChange(ownerId);
        return;
      }
      console.log(`Dictated for ${b.name}: ${text}`);
      writeDraft(ownerId, b, `"${text}"`, text);
    })
    .catch((e) => {
      console.error("Transcription failed:", e);
      if (stillThere(ownerId, b, version) && b.draft === draft) {
        b.draft = { status: "failed", intent: "voice reply", voice: true };
        onChange(ownerId);
      }
    });
}

function writeDraft(ownerId: number, b: Batch, intent: string, dictated?: string) {
  const version = b.version;
  const draft: Draft = { status: "writing", intent };
  b.draft = draft;
  onChange(ownerId);

  const { history, open } = contextOf(b);
  compose(b.name, history, open, intent, knowledgeOf(ownerId), dictated)
    .then((text) => {
      if (stillThere(ownerId, b, version) && b.draft === draft) b.draft = { status: "ready", intent, text };
    })
    .catch((e) => {
      console.error("Agent compose failed:", e);
      if (stillThere(ownerId, b, version) && b.draft === draft) b.draft = { status: "failed", intent };
    })
    .finally(() => onChange(ownerId));
}

export function discardDraft(ownerId: number, batchId: string) {
  const b = findBatch(ownerId, batchId);
  if (!b) return;
  b.draft = null;
  onChange(ownerId);
}

// What the glasses should show now.
export function snapshot(ownerId: number): { card: Card | null; waiting: number; chats: ChatSummary[] } {
  const q = queueOf(ownerId);

  // Closed (answered) → back to the list.
  const current = q.batches.find((b) => b.id === q.currentId);
  q.currentId = current?.id ?? null;

  const listed = q.batches.filter((b) => b.listed);
  const waiting = listed.filter((b) => b !== current).length;
  const chats = listed.map((b) => ({
    batchId: b.id,
    name: b.name,
    count: b.messages.length,
    preview: b.messages[b.messages.length - 1].text,
    collecting: !b.ready,
  }));
  if (!current) return { card: null, waiting, chats };

  return {
    card: {
      batchId: current.id,
      name: current.name,
      messages: current.messages.map((m) => m.text),
      collecting: !current.ready,
      agent: current.agent,
      draft: current.draft,
    },
    waiting,
    chats,
  };
}
