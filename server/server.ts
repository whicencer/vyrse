import "dotenv/config";
import http from "http";
import fs from "fs";
import path from "path";
import { randomInt, randomUUID } from "crypto";
import WebSocket, { WebSocketServer } from "ws";
import type { Digest, FromBot, FromGlasses, ReplyKind, ToBot, ToGlasses } from "./types";
import {
  addMessage, autoFailed, editMessage, chooseOption, closeChat, discardDraft, dismissBatch, findBatch,
  dictate, onQueueChange, onSendReply, openBatch, replied, snapshot,
} from "./queue";
import { addKnowledge, knowledgeOf, modeOf, removeKnowledge, setMode, setOwnerName } from "./secretary";
import { DEMO_CONNECTION, startDemo } from "./demo";
import { MAX_SECONDS, secondsOf } from "./voice";

const server = http.createServer();
const wss = new WebSocketServer({ noServer: true });

let bot: WebSocket | null = null;

// Paired glasses, one per Telegram account (a new pairing replaces the old socket).
const glassesByOwner = new Map<number, WebSocket>();
const ownerBySocket = new Map<WebSocket, number>();

function bindGlasses(ws: WebSocket, ownerId: number, name: string) {
  // The secretary introduces itself as "<name>'s AI assistant".
  setOwnerName(ownerId, name);
  const old = glassesByOwner.get(ownerId);
  if (old && old !== ws) ownerBySocket.delete(old);
  glassesByOwner.set(ownerId, ws);
  ownerBySocket.set(ws, ownerId);
  pushQueue(ownerId);
}

function pushQueue(ownerId: number) {
  send(glassesByOwner.get(ownerId), {
    type: "queue",
    ...snapshot(ownerId),
    mode: modeOf(ownerId),
    knowledge: knowledgeOf(ownerId),
  });
}
onQueueChange(pushQueue);

// ── Replies ─────────────────────────────────────────────────────────────────
// Every reply goes through here: the owner's (Send on the glasses) and the secretary's own. Demo chats aren't in Telegram, so their replies "succeed" locally.

onSendReply(replySender);

function replySender(ownerId: number, batch: { id: string; chatId: number; connectionId: string }, text: string, kind: ReplyKind) {
  if (batch.connectionId === DEMO_CONNECTION) {
    setTimeout(() => onReplyStatus(ownerId, batch.id, kind, text, true), 400);
    return;
  }
  send(bot, { type: "reply", ownerId, batchId: batch.id, chatId: batch.chatId, connectionId: batch.connectionId, text, kind });
}

function onReplyStatus(ownerId: number, batchId: string, kind: ReplyKind, text: string, isSuccess: boolean) {
  // Only the owner's own Send gets the "Sent" confirmation on the glasses.
  if (kind === "owner") send(glassesByOwner.get(ownerId), { type: "reply_sent_status", isSuccess });
  if (isSuccess) replied(ownerId, batchId, text, kind);
  else if (kind === "auto") autoFailed(ownerId, batchId);
}

// ── Secretary: modes, knowledge base, digest ────────────────────────────────

function notify(userId: number, text: string) {
  send(bot, { type: "notify", userId, text });
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function digestText(d: Digest) {
  const log = d.log
    .map((h) => `• ${h.asked.startsWith(h.name) ? escape(h.asked) : `<b>${escape(h.name)}</b>: ${escape(h.asked)}`}\n  → ${escape(h.reply)}`)
    .join("\n");
  return `<b>Secretary mode is off. Answered for you:</b>\n${log}`;
}

function changeMode(ownerId: number, on: boolean) {
  const wasOn = !!modeOf(ownerId);
  const digest = setMode(ownerId, on);
  if (digest) {
    send(glassesByOwner.get(ownerId), { type: "digest", digest });
    notify(ownerId, digestText(digest));
  } else if (on !== wasOn) {
    notify(
      ownerId,
      on
        ? "<b>🤖 Secretary mode is on</b>\nI'll answer what doesn't need you myself. Only messages that need your decision show up on your glasses."
        : "<b>Secretary mode is off.</b> Every message shows up on your glasses.",
    );
  }
  pushQueue(ownerId);
}

function runDemo(ownerId: number) {
  startDemo(ownerId);
  notify(ownerId, "<b>▶️ Demo started</b>\nSecretary mode is on with a sample knowledge base. Scripted chats will arrive over the next minute.");
  pushQueue(ownerId);
}

function send(ws: WebSocket | null | undefined, msg: ToGlasses | ToBot) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

// ── Tokens ──────────────────────────────────────────────────────────────────
// token → owner. Glasses keep the token and connect with ?token=.
// Saved to a file so restarting the server doesn't unpair everyone.

const TOKENS_FILE = path.resolve("data/pairs.json");
type Pair = { ownerId: number; name: string };

const tokens = new Map<string, Pair>(
  fs.existsSync(TOKENS_FILE) ? Object.entries(JSON.parse(fs.readFileSync(TOKENS_FILE, "utf8"))) : [],
);

// Names are known right away, even before the glasses connect (e.g. /demo from the bot).
for (const { ownerId, name } of tokens.values()) setOwnerName(ownerId, name);

function saveTokens() {
  fs.mkdirSync(path.dirname(TOKENS_FILE), { recursive: true });
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(Object.fromEntries(tokens), null, 2));
}

// ── Pairing codes ───────────────────────────────────────────────────────────
// Codes waiting for "/pair <code>" in the bot. Memory only: a server
// restart just means asking for a new code.

const CODE_TTL_SEC = 10 * 60;
const pendingCodes = new Map<string, { ws: WebSocket; expiresAt: number }>();

function newPairCode(ws: WebSocket) {
  const now = Date.now();
  for (const [code, entry] of pendingCodes) {
    // One live code per glasses, and drop expired ones while we're here.
    if (entry.ws === ws || entry.expiresAt <= now) pendingCodes.delete(code);
  }

  let code: string;
  do code = String(randomInt(100000, 1000000));
  while (pendingCodes.has(code));

  pendingCodes.set(code, { ws, expiresAt: now + CODE_TTL_SEC * 1000 });
  return code;
}

function pair(code: string, ownerId: number, name: string) {
  const entry = pendingCodes.get(code);
  pendingCodes.delete(code);
  if (!entry || entry.expiresAt <= Date.now() || entry.ws.readyState !== WebSocket.OPEN) return false;

  // One token per account: re-pairing revokes the old one.
  for (const [token, p] of tokens) if (p.ownerId === ownerId) tokens.delete(token);
  const token = randomUUID();
  tokens.set(token, { ownerId, name });
  saveTokens();

  bindGlasses(entry.ws, ownerId, name);
  send(entry.ws, { type: "paired", token, name });
  return true;
}

// ── Messages ────────────────────────────────────────────────────────────────

function onBotMessage(msg: FromBot) {
  switch (msg.type) {
    case "message":
      addMessage(msg.ownerId, msg.connectionId, msg.chat, msg.message);
      break;
    case "message_edited":
      editMessage(msg.ownerId, msg.connectionId, msg.chatId, msg.messageId, msg.text);
      break;
    case "owner_reply":
      closeChat(msg.ownerId, msg.connectionId, msg.chatId, msg.text);
      break;
    case "reply_sent_status":
      onReplyStatus(msg.ownerId, msg.batchId, msg.kind, msg.text, msg.isSuccess);
      break;
    case "set_mode":
      changeMode(msg.ownerId, msg.on);
      break;
    case "demo":
      runDemo(msg.ownerId);
      break;
    case "pair":
      send(bot, { type: "pair_result", userId: msg.userId, ok: pair(msg.code, msg.userId, msg.name) });
      break;
  }
}

function onGlassesMessage(ws: WebSocket, msg: FromGlasses) {
  switch (msg.type) {
    case "pair_request":
      send(ws, { type: "code", code: newPairCode(ws), expiresInSec: CODE_TTL_SEC });
      break;
    case "open": {
      const ownerId = ownerBySocket.get(ws);
      if (ownerId !== undefined) openBatch(ownerId, msg.batchId);
      break;
    }
    case "choose": {
      const ownerId = ownerBySocket.get(ws);
      if (ownerId !== undefined) chooseOption(ownerId, msg.batchId, msg.option);
      break;
    }
    case "voice": {
      const ownerId = ownerBySocket.get(ws);
      if (ownerId === undefined) break;
      const pcm = Buffer.from(msg.audio, "base64");
      // Too short to be speech, or longer than a reply should be: ignore.
      if (secondsOf(pcm) < 0.5 || secondsOf(pcm) > MAX_SECONDS + 1) break;
      dictate(ownerId, msg.batchId, pcm);
      break;
    }
    case "discard": {
      const ownerId = ownerBySocket.get(ws);
      if (ownerId !== undefined) discardDraft(ownerId, msg.batchId);
      break;
    }
    case "dismiss": {
      const ownerId = ownerBySocket.get(ws);
      if (ownerId !== undefined) dismissBatch(ownerId, msg.batchId);
      break;
    }
    case "send": {
      // The owner comes from the socket, and the text from the server's own draft:
      // the glasses can only confirm what the agent wrote.
      const ownerId = ownerBySocket.get(ws);
      if (ownerId === undefined) break;
      const batch = findBatch(ownerId, msg.batchId);
      // Already closed (e.g. answered from the phone a moment ago) or no draft yet.
      if (!batch || batch.draft?.status !== "ready") {
        send(ws, { type: "reply_sent_status", isSuccess: false });
        pushQueue(ownerId);
        break;
      }
      // Same path as the secretary's replies (demo chats included).
      replySender(ownerId, batch, batch.draft.text, "owner");
      break;
    }
    case "set_mode": {
      const ownerId = ownerBySocket.get(ws);
      if (ownerId !== undefined) changeMode(ownerId, msg.on);
      break;
    }
    case "demo": {
      const ownerId = ownerBySocket.get(ws);
      if (ownerId !== undefined) runDemo(ownerId);
      break;
    }
    // Knowledge base edits from the phone page.
    case "kb_add": {
      const ownerId = ownerBySocket.get(ws);
      const text = msg.text.trim().slice(0, 500);
      if (ownerId === undefined || !text) break;
      addKnowledge(ownerId, text);
      pushQueue(ownerId);
      break;
    }
    case "kb_remove": {
      const ownerId = ownerBySocket.get(ws);
      if (ownerId === undefined) break;
      removeKnowledge(ownerId, msg.index);
      pushQueue(ownerId);
      break;
    }
  }
}

wss.on("connection", (ws, request) => {
  const params = new URL(request.url ?? "/", "http://x").searchParams;
  const role = params.get("role");

  if (role === "bot") bot = ws;
  else if (role === "glasses") {
    const saved = tokens.get(params.get("token") ?? "");
    if (saved) {
      bindGlasses(ws, saved.ownerId, saved.name);
      // Lets the phone page show who it's paired with after a reload.
      send(ws, { type: "paired", token: params.get("token")!, name: saved.name });
    }
  } else return ws.close(1008, "unknown role");

  ws.on("error", console.error);

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (role === "bot") onBotMessage(msg);
    else onGlassesMessage(ws, msg);
  });

  ws.on("close", () => {
    if (bot === ws) bot = null;

    const ownerId = ownerBySocket.get(ws);
    ownerBySocket.delete(ws);
    if (ownerId !== undefined && glassesByOwner.get(ownerId) === ws) glassesByOwner.delete(ownerId);

    for (const [code, entry] of pendingCodes) if (entry.ws === ws) pendingCodes.delete(code);
  });
});

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url ?? "/", "http://x");
  if (url.searchParams.get("secret") !== process.env.WS_CONNECTION_SECRET) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, function done(ws) {
    wss.emit("connection", ws, request);
  });
});

server.listen(Number(process.env.WS_PORT) || 8080);
