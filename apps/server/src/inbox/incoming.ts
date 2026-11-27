import { config } from "../config";
import { changed } from "../events";
import { isModeOn } from "../secretary/store";
import { refreshOptions, triage } from "../secretary/triage";
import { addMessage, createItem, deleteItem, editMessage, findItemForChat, getItem, listAllItems, saveItem } from "./store";
import type { ChatRef } from "./types";

// What happens in the owner's chats: the contact writes or edits, the owner answers
// from the phone. Called by the bot and by the demo.

// Silence timers: once the contact has been quiet this long, the burst goes to the AI.
// Memory only; after a restart recover() starts them again.
const timers = new Map<string, NodeJS.Timeout>();

export function receiveMessage(
  ownerId: number,
  chat: ChatRef,
  contactName: string,
  message: { externalId: number; text: string; at: number },
) {
  // One open item per chat: a new message joins it, even if it's already on the glasses.
  const item = findItemForChat(ownerId, chat) ?? createItem(ownerId, chat, contactName, message.at);

  item.contactName = contactName;
  item.status = "collecting";
  item.revision++;
  // The options and the draft were for the older messages.
  item.analysis = null;
  item.draft = null;
  saveItem(item);
  addMessage(ownerId, chat, { author: "contact", text: message.text, externalId: message.externalId, itemId: item.id, at: message.at });

  restartTimer(ownerId, item.id);
  // A brand-new burst stays hidden until it's complete; one already on the glasses shows "typing".
  if (item.shown) changed(ownerId);
}

// The contact edited a message: the new text quietly replaces the old one.
export function receiveEdit(ownerId: number, chat: ChatRef, externalId: number, text: string) {
  const edited = editMessage(ownerId, chat, externalId, text);
  if (!edited?.itemId) return;

  const item = getItem(ownerId, edited.itemId);
  if (!item) return;
  // Still collecting: the AI reads the new text when the burst ends. Already on the glasses:
  // redo the summary and options (never answers by itself, an edit isn't a new message).
  if (item.status === "needs_owner" && item.shown) void refreshOptions(ownerId, item.id);
  changed(ownerId);
}

// The owner wrote in this chat from their phone: whatever was waiting is answered.
export function ownerRepliedElsewhere(ownerId: number, chat: ChatRef, text?: string) {
  if (text) addMessage(ownerId, chat, { author: "owner", text, at: Date.now() });
  const item = findItemForChat(ownerId, chat);
  if (!item) return;
  closeItem(item.id);
  changed(ownerId);
}

// Deletes an item and forgets its timer. Its messages stay in the history.
export function closeItem(itemId: string) {
  clearTimeout(timers.get(itemId));
  timers.delete(itemId);
  deleteItem(itemId);
}

function restartTimer(ownerId: number, itemId: string, delayMs = config.inbox.silenceMs) {
  clearTimeout(timers.get(itemId));
  timers.set(
    itemId,
    setTimeout(() => {
      timers.delete(itemId);
      burstComplete(ownerId, itemId);
    }, delayMs),
  );
}

function burstComplete(ownerId: number, itemId: string) {
  const item = getItem(ownerId, itemId);
  if (!item) return;
  item.status = "thinking";
  // In secretary mode the secretary may answer it itself, so it shows up only once the AI decides.
  if (!isModeOn(ownerId)) item.shown = true;
  saveItem(item);
  changed(ownerId);
  void triage(ownerId, itemId);
}

// After a restart: finish what was in flight when the server stopped.
export function recover() {
  for (const item of listAllItems()) {
    if (item.draft?.status === "writing") item.draft = null;
    // We don't know if the secretary's answer went out: let the owner look at it.
    if (item.status === "auto_replying") {
      item.status = "needs_owner";
      item.shown = true;
      item.autoAsked = null;
    }
    saveItem(item);
    // The AI never finished: run it again shortly.
    if (item.status === "collecting" || item.status === "thinking") restartTimer(item.ownerId, item.id, 1000);
  }
}
