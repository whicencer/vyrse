import { z } from "zod";

// Messages between the glasses app and the server.
//
// The server owns the data: on every change it sends the whole `state`.
// The glasses own the navigation: which chat is open is decided on the glasses, never sent.
// The owner is never sent either: the server knows it from the device token of the socket.

// ── Server → glasses ─────────────────────────────────────────────────────────

// What the AI made of a chat: a short summary and 2–3 intents ("Agree to 14:00").
export type AnalysisView =
  | { status: "thinking" }
  | { status: "ready"; summary: string; options: string[] }
  | { status: "failed" };

// The reply being prepared for the intent the owner picked (or dictated).
// failed.voice: the voice reply wasn't understood, as opposed to the AI failing to write it.
export type DraftView =
  | { status: "writing"; intent: string }
  | { status: "ready"; intent: string; text: string }
  | { status: "failed"; intent: string; voice: boolean };

// One chat waiting for the owner.
export type ItemView = {
  id: string;
  name: string;
  // The contact's messages in this burst, oldest first.
  messages: string[];
  // The contact is still writing: the AI waits until they stop.
  collecting: boolean;
  analysis: AnalysisView;
  draft: DraftView | null;
};

export type ModeView = { since: number } | null;

export type Fact = { id: number; text: string };

// What the secretary answered by itself while secretary mode was on.
export type DigestEntry = { contactName: string; asked: string; reply: string };

export type ServerMessage =
  // Sent on connect and after every change. items: every chat waiting for the owner, oldest first.
  | { type: "state"; items: ItemView[]; mode: ModeView; knowledge: Fact[] }
  // Secretary mode was turned off: show what the secretary answered.
  | { type: "digest"; entries: DigestEntry[] }
  // Result of "send".
  | { type: "sent"; ok: boolean }
  // Answer to "pair_request": show this code until it expires.
  | { type: "code"; code: string; expiresInSec: number }
  // Pairing done (or reconnected with a saved token): keep the token, reconnect with it.
  | { type: "paired"; token: string; name: string };

// ── Glasses → server ─────────────────────────────────────────────────────────

const itemId = z.string().min(1).max(64);

// 30 s of 16 kHz 16-bit mono PCM is 960 KB, about 1.3 MB in base64.
const MAX_AUDIO_BASE64 = 1_400_000;

export const clientMessage = z.discriminatedUnion("type", [
  // Picked one of the AI's options: the server writes a draft for it.
  z.object({ type: z.literal("choose"), itemId, option: z.number().int().min(0).max(9) }),
  // Voice reply: raw microphone audio (16 kHz, 16-bit mono PCM), base64.
  z.object({ type: z.literal("voice"), itemId, audio: z.string().max(MAX_AUDIO_BASE64) }),
  // Send the draft that is on screen. The text is the server's own draft, never sent by the glasses.
  z.object({ type: z.literal("send"), itemId }),
  // Drop the draft, back to the options.
  z.object({ type: z.literal("discard"), itemId }),
  // Leave the chat unanswered: it disappears from the glasses.
  z.object({ type: z.literal("dismiss"), itemId }),
  // Phone page.
  z.object({ type: z.literal("set_mode"), on: z.boolean() }),
  z.object({ type: z.literal("kb_add"), text: z.string().trim().min(1).max(500) }),
  z.object({ type: z.literal("kb_remove"), id: z.number().int() }),
  z.object({ type: z.literal("demo") }),
  z.object({ type: z.literal("pair_request") }),
]);

export type ClientMessage = z.infer<typeof clientMessage>;
