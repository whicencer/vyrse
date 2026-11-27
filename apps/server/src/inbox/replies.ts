import { compose } from "../ai/compose";
import { transcribe } from "../ai/transcribe";
import { changed } from "../events";
import { listKnowledge } from "../secretary/store";
import { sendToChat } from "../send";
import { contextOf } from "./history";
import { closeItem } from "./incoming";
import { addMessage, chatMessages, getItem, saveItem } from "./store";
import type { Item } from "./types";

// What the owner does with an item on the glasses: pick an option or dictate, check the
// draft, send it or drop it, or ignore the chat.

// Picked one of the AI's options: write the message for it.
export async function chooseOption(ownerId: number, itemId: string, option: number) {
  const item = getItem(ownerId, itemId);
  if (!item || item.status !== "needs_owner" || !item.analysis || item.analysis === "failed") return;
  const intent = item.analysis.options[option];
  if (intent) await writeDraft(item, intent);
}

// Voice reply: transcribe what the owner said, then the AI turns it into the message
// (the same draft screen: Send / Back).
export async function dictate(ownerId: number, itemId: string, pcm: Buffer) {
  const item = getItem(ownerId, itemId);
  if (!item) return;

  const intent = "your voice reply";
  item.draft = { status: "writing", intent };
  saveItem(item);
  changed(ownerId);

  let text = "";
  try {
    text = await transcribe(pcm);
  } catch (e) {
    console.error("Transcription failed:", e);
  }

  const current = draftStillWanted(item, intent);
  if (!current) return;
  if (!text) {
    current.draft = { status: "failed", intent: "voice reply", voice: true };
    saveItem(current);
    changed(ownerId);
    return;
  }
  console.log(`Dictated for ${item.contactName}: ${text}`);
  await writeDraft(current, `"${text}"`, text);
}

export function discardDraft(ownerId: number, itemId: string) {
  const item = getItem(ownerId, itemId);
  if (!item) return;
  item.draft = null;
  saveItem(item);
  changed(ownerId);
}

// Sends the draft on screen. The text is always the server's own draft.
// Returns false if there was nothing to send or it didn't go out.
export async function sendDraft(ownerId: number, itemId: string): Promise<boolean> {
  const item = getItem(ownerId, itemId);
  // Already closed (answered from the phone a moment ago) or the draft isn't ready.
  if (!item || item.draft?.status !== "ready") return false;
  const text = item.draft.text;

  try {
    await sendToChat(item.chat, text);
  } catch (e) {
    console.error(`Reply to ${item.contactName} failed:`, e);
    return false;
  }

  addMessage(ownerId, item.chat, { author: "owner", text, itemId: item.id, at: Date.now() });
  closeItem(item.id);
  changed(ownerId);
  return true;
}

// The owner tapped "Ignore": close the item without answering. The messages stay in the history.
export function dismissItem(ownerId: number, itemId: string) {
  if (!getItem(ownerId, itemId)) return;
  closeItem(itemId);
  changed(ownerId);
}

async function writeDraft(item: Item, intent: string, dictated?: string) {
  const { ownerId } = item;
  item.draft = { status: "writing", intent };
  saveItem(item);
  changed(ownerId);

  try {
    const text = await compose({
      contact: item.contactName,
      context: contextOf(chatMessages(ownerId, item.chat), item.id),
      intent,
      knowledge: listKnowledge(ownerId).map((f) => f.text),
      dictated,
    });
    const current = draftStillWanted(item, intent);
    if (!current) return;
    current.draft = { status: "ready", intent, text };
    saveItem(current);
  } catch (e) {
    console.error("AI compose failed:", e);
    const current = draftStillWanted(item, intent);
    if (!current) return;
    current.draft = { status: "failed", intent, voice: false };
    saveItem(current);
  }
  changed(ownerId);
}

// The draft being written is still the one on screen: same item, no new messages since,
// and the owner hasn't dropped it or picked something else.
function draftStillWanted(item: Item, intent: string) {
  const current = getItem(item.ownerId, item.id);
  if (!current || current.revision !== item.revision) return undefined;
  if (current.draft?.status !== "writing" || current.draft.intent !== intent) return undefined;
  return current;
}
