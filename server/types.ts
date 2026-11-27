// The server routes by owner, handles pairing and keeps each owner's queue of batches.
// So every hop has its own type:
//
//   Bot ── FromBot ──▶ Server ── ToGlasses ──▶ Glasses
//   Bot ◀── ToBot ──── Server ◀── FromGlasses ─ Glasses
//
// ownerId = Telegram id of the account that connected @VyrseBot
// (getBusinessConnection(id).user.id). Glasses never send it: the server adds it
// from the socket, so one pair of glasses can't reply into someone else's chats.

// One incoming message from a contact.
export type IncomingMessage = {
  id: number;
  text: string;
  // Telegram's message.date, unix seconds
  date: number;
};

// What the agent made of a batch (CONCEPT.md §7).
export type AgentView =
  | { status: "thinking" }
  // options = intents ("Agree to 14:00"), not message texts
  | { status: "ready"; summary: string; options: string[] }
  | { status: "failed" };

// The reply the agent wrote for the intent the owner picked; shown before sending.
// failed.voice: the voice reply wasn't understood (vs. the agent failing to write it).
export type Draft =
  | { status: "writing"; intent: string }
  | { status: "ready"; intent: string; text: string }
  | { status: "failed"; intent: string; voice?: boolean };

// What the glasses draw for the chat the user opened.
export type Card = {
  batchId: string;
  name: string;
  messages: string[];
  // Contact is writing again: the agent waits for the burst to end.
  collecting: boolean;
  agent: AgentView;
  draft: Draft | null;
};

// One line in the chat list (the glasses' home screen).
export type ChatSummary = {
  batchId: string;
  name: string;
  count: number;
  // Latest message, shown after the name.
  preview: string;
  collecting: boolean;
};

// Secretary mode is on (null when off): the secretary answers what doesn't need the owner and
// only the rest shows up on the glasses. Off: every message is shown.
export type ModeState = { since: number };

// When a mode ends: what the secretary answered by itself during it (CONCEPT.md §7.2).
export type Digest = {
  log: { name: string; asked: string; reply: string }[];
};

// Who a reply is from: the owner (tapped Send) or the secretary in secretary mode:
// "auto" settles the chat, "hold" only says the owner will get back (the chat stays open).
export type ReplyKind = "owner" | "auto" | "hold";

// Bot → Server
export type FromBot =
  | {
      type: "message";
      ownerId: number;
      connectionId: string;
      chat: { id: number; name: string };
      message: IncomingMessage;
    }
  // The contact edited one of their messages.
  | { type: "message_edited"; ownerId: number; connectionId: string; chatId: number; messageId: number; text: string }
  // The owner wrote to this chat from their phone: the batch is handled.
  | { type: "owner_reply"; ownerId: number; connectionId: string; chatId: number; text?: string }
  | { type: "reply_sent_status"; ownerId: number; batchId: string; kind: ReplyKind; text: string; isSuccess: boolean }
  // Bot commands: /mode, /demo
  | { type: "set_mode"; ownerId: number; on: boolean }
  | { type: "demo"; ownerId: number }
  // User sent "/pair <code>" (or opened t.me/VyrseBot?start=<code>)
  | { type: "pair"; code: string; userId: number; name: string };

// Server → Glasses
export type ToGlasses =
  // Sent on every queue change and on connect.
  // card = the chat the user opened (null → show the chat list).
  // chats = every unanswered chat, in queue order.
  // knowledge: the owner's knowledge base, shown and edited on the phone page.
  | { type: "queue"; card: Card | null; waiting: number; chats: ChatSummary[]; mode: ModeState | null; knowledge: string[] }
  // The mode was turned off: show what the secretary did.
  | { type: "digest"; digest: Digest }
  | { type: "reply_sent_status"; isSuccess: boolean }
  // Answer to "pair_request": show this code until it expires
  | { type: "code"; code: string; expiresInSec: number }
  // Pairing done: save the token, reconnect with ?token= next time
  | { type: "paired"; token: string; name: string };

// Glasses → Server
export type FromGlasses =
  // Picked an agent option: the agent writes a draft.
  | { type: "choose"; batchId: string; option: number }
  // Send the draft that is on screen.
  | { type: "send"; batchId: string }
  // Voice reply: raw mic audio (16 kHz, 16-bit mono PCM), base64.
  | { type: "voice"; batchId: string; audio: string }
  // Drop the draft, back to the options.
  | { type: "discard"; batchId: string }
  // Leave the chat unanswered: it disappears from the glasses.
  | { type: "dismiss"; batchId: string }
  // Picked a chat in the list (batchId) or went back to the list (null).
  | { type: "open"; batchId: string | null }
  // Phone page buttons
  | { type: "set_mode"; on: boolean }
  | { type: "demo" }
  // Knowledge base edits from the phone page
  | { type: "kb_add"; text: string }
  | { type: "kb_remove"; index: number }
  // User tapped "Pair glasses" on the phone page
  | { type: "pair_request" };

// Server → Bot
export type ToBot =
  | { type: "reply"; ownerId: number; batchId: string; chatId: number; connectionId: string; text: string; kind: ReplyKind }
  // A message from the bot to the owner (answers to commands, digest)
  | { type: "notify"; userId: number; text: string }
  // Answer to "pair", so the bot can tell the user "Glasses connected ✅" or "Code expired"
  | { type: "pair_result"; userId: number; ok: boolean };
