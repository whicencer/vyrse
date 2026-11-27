import { randomUUID } from "node:crypto";
import { db } from "../db";
import type { Author, ChatRef, Draft, Item, ItemStatus, Message } from "./types";

// All SQL for items and messages. The rest of the inbox works with Item and Message objects.

// ── Items ────────────────────────────────────────────────────────────────────

type ItemRow = {
  id: string;
  owner_id: number;
  channel: ChatRef["channel"];
  connection_id: string;
  chat_id: number;
  contact_name: string;
  status: ItemStatus;
  revision: number;
  summary: string | null;
  options: string | null;
  analysis_failed: number;
  draft_status: "writing" | "ready" | "failed" | "voice_failed" | null;
  draft_intent: string | null;
  draft_text: string | null;
  shown: number;
  hold_sent: number;
  auto_asked: string | null;
  opened_at: number;
};

function toItem(row: ItemRow): Item {
  return {
    id: row.id,
    ownerId: row.owner_id,
    chat: { channel: row.channel, connectionId: row.connection_id, chatId: row.chat_id },
    contactName: row.contact_name,
    status: row.status,
    revision: row.revision,
    analysis: row.analysis_failed
      ? "failed"
      : row.summary !== null && row.options !== null
        ? { summary: row.summary, options: JSON.parse(row.options) as string[] }
        : null,
    draft: toDraft(row),
    shown: row.shown === 1,
    holdSent: row.hold_sent === 1,
    autoAsked: row.auto_asked,
    openedAt: row.opened_at,
  };
}

function toDraft(row: ItemRow): Draft | null {
  const intent = row.draft_intent ?? "";
  switch (row.draft_status) {
    case "writing":
      return { status: "writing", intent };
    case "ready":
      return { status: "ready", intent, text: row.draft_text ?? "" };
    case "failed":
      return { status: "failed", intent, voice: false };
    case "voice_failed":
      return { status: "failed", intent, voice: true };
    default:
      return null;
  }
}

const ITEM_WHERE_CHAT = "owner_id = ? AND channel = ? AND connection_id = ? AND chat_id = ?";
const chatParams = (ownerId: number, chat: ChatRef) => [ownerId, chat.channel, chat.connectionId, chat.chatId] as const;

export function getItem(ownerId: number, itemId: string): Item | undefined {
  const row = db().prepare("SELECT * FROM items WHERE owner_id = ? AND id = ?").get(ownerId, itemId) as ItemRow | undefined;
  return row && toItem(row);
}

export function findItemForChat(ownerId: number, chat: ChatRef): Item | undefined {
  const row = db().prepare(`SELECT * FROM items WHERE ${ITEM_WHERE_CHAT}`).get(...chatParams(ownerId, chat)) as
    | ItemRow
    | undefined;
  return row && toItem(row);
}

// Every open item of an owner, oldest first.
export function listItems(ownerId: number): Item[] {
  const rows = db().prepare("SELECT * FROM items WHERE owner_id = ? ORDER BY opened_at, rowid").all(ownerId) as ItemRow[];
  return rows.map(toItem);
}

// Every open item of every owner (used once, after a restart).
export function listAllItems(): Item[] {
  return (db().prepare("SELECT * FROM items").all() as ItemRow[]).map(toItem);
}

export function createItem(ownerId: number, chat: ChatRef, contactName: string, openedAt: number): Item {
  const item: Item = {
    id: randomUUID(),
    ownerId,
    chat,
    contactName,
    status: "collecting",
    revision: 0,
    analysis: null,
    draft: null,
    shown: false,
    holdSent: false,
    autoAsked: null,
    openedAt,
  };
  db()
    .prepare(
      `INSERT INTO items (id, owner_id, channel, connection_id, chat_id, contact_name, status, opened_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(item.id, ownerId, chat.channel, chat.connectionId, chat.chatId, contactName, item.status, openedAt);
  return item;
}

// Writes every field that can change.
export function saveItem(item: Item) {
  const analysis = item.analysis;
  const draft = item.draft;
  db()
    .prepare(
      `UPDATE items SET
         contact_name = ?, status = ?, revision = ?,
         summary = ?, options = ?, analysis_failed = ?,
         draft_status = ?, draft_intent = ?, draft_text = ?,
         shown = ?, hold_sent = ?, auto_asked = ?
       WHERE id = ?`,
    )
    .run(
      item.contactName,
      item.status,
      item.revision,
      analysis && analysis !== "failed" ? analysis.summary : null,
      analysis && analysis !== "failed" ? JSON.stringify(analysis.options) : null,
      analysis === "failed" ? 1 : 0,
      draft ? (draft.status === "failed" && draft.voice ? "voice_failed" : draft.status) : null,
      draft?.intent ?? null,
      draft?.status === "ready" ? draft.text : null,
      item.shown ? 1 : 0,
      item.holdSent ? 1 : 0,
      item.autoAsked,
      item.id,
    );
}

// The item's messages stay in the history; they just no longer belong to an open item.
export function deleteItem(itemId: string) {
  db().prepare("DELETE FROM items WHERE id = ?").run(itemId);
}

// ── Messages ─────────────────────────────────────────────────────────────────

export function addMessage(
  ownerId: number,
  chat: ChatRef,
  message: { author: Author; text: string; itemId?: string; externalId?: number; at: number },
) {
  db()
    .prepare(
      `INSERT INTO messages (owner_id, channel, connection_id, chat_id, author, text, external_id, item_id, at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(...chatParams(ownerId, chat), message.author, message.text, message.externalId ?? null, message.itemId ?? null, message.at);
}

// The contact edited a message. Returns the item it belongs to, if it's still open.
export function editMessage(ownerId: number, chat: ChatRef, externalId: number, text: string): { itemId: string | null } | undefined {
  const row = db()
    .prepare(`SELECT id, item_id FROM messages WHERE ${ITEM_WHERE_CHAT} AND external_id = ? AND author = 'contact'`)
    .get(...chatParams(ownerId, chat), externalId) as { id: number; item_id: string | null } | undefined;
  if (!row) return undefined;
  db().prepare("UPDATE messages SET text = ? WHERE id = ?").run(text, row.id);
  return { itemId: row.item_id };
}

// The last `limit` messages of a chat, oldest first: the conversation the AI sees.
export function chatMessages(ownerId: number, chat: ChatRef, limit = 30): Message[] {
  const rows = db()
    .prepare(
      `SELECT id, author, text, item_id AS itemId FROM messages WHERE ${ITEM_WHERE_CHAT}
       ORDER BY id DESC LIMIT ?`,
    )
    .all(...chatParams(ownerId, chat), limit) as Message[];
  return rows.reverse();
}

// The contact's messages in an open item, oldest first: what the glasses show.
export function contactMessagesOf(itemId: string): string[] {
  const rows = db()
    .prepare("SELECT text FROM messages WHERE item_id = ? AND author = 'contact' ORDER BY id")
    .all(itemId) as { text: string }[];
  return rows.map((r) => r.text);
}

// Wipes an owner's demo chats before the demo runs again.
export function deleteDemoData(ownerId: number) {
  db().transaction(() => {
    db().prepare("DELETE FROM items WHERE owner_id = ? AND channel = 'demo'").run(ownerId);
    db().prepare("DELETE FROM messages WHERE owner_id = ? AND channel = 'demo'").run(ownerId);
  })();
}
