import { analyze, type AnalyzeResult } from "../ai/analyze";
import { changed } from "../events";
import { contextOf } from "../inbox/history";
import { addMessage, chatMessages, deleteItem, getItem, saveItem } from "../inbox/store";
import type { Item } from "../inbox/types";
import { ownerName } from "../owners";
import { sendToChat } from "../send";
import { AI_MARK, decide } from "./policy";
import { isModeOn, listKnowledge, logAnswer } from "./store";

// An item is ready (the contact stopped writing): ask the AI what it is about, let the
// policy decide, then either the secretary answers by itself or the item goes to the glasses.

export async function triage(ownerId: number, itemId: string) {
  await run(ownerId, itemId, { optionsOnly: false });
}

// Redo only the summary and options of an item already on the glasses (after an edit, or
// after the secretary answered part of it). Never sends anything.
export async function refreshOptions(ownerId: number, itemId: string) {
  await run(ownerId, itemId, { optionsOnly: true });
}

async function run(ownerId: number, itemId: string, { optionsOnly }: { optionsOnly: boolean }) {
  const item = getItem(ownerId, itemId);
  if (!item) return;
  const revision = item.revision;
  const modeOn = !optionsOnly && isModeOn(ownerId);
  const knowledge = listKnowledge(ownerId).map((f) => f.text);

  let analysis: AnalyzeResult;
  try {
    analysis = await analyze({
      contact: item.contactName,
      context: contextOf(chatMessages(ownerId, item.chat), item.id),
      secretary: { on: modeOn, owner: ownerName(ownerId), knowledge },
    });
  } catch (e) {
    console.error(`AI analyze failed for ${item.contactName}:`, e);
    const current = stillCurrent(ownerId, itemId, revision);
    if (!current) return;
    // Nobody answered it: the owner has to see it, mode or not.
    current.analysis = "failed";
    current.status = "needs_owner";
    current.shown = true;
    saveItem(current);
    changed(ownerId);
    return;
  }

  // The contact wrote again while the AI was thinking: this answer is out of date.
  const current = stillCurrent(ownerId, itemId, revision);
  if (!current) return;

  current.analysis = analysis.options.length ? { summary: analysis.summary, options: analysis.options } : "failed";
  const decision = decide({ analysis, modeOn, knowledgeCount: knowledge.length, holdSent: current.holdSent });

  if (decision.kind === "answer") {
    current.status = "auto_replying";
    current.autoAsked = analysis.summary;
    saveItem(current);
    changed(ownerId);
    await sendAnswer(current, decision.text);
    return;
  }

  current.status = "needs_owner";
  current.shown = true;
  if (decision.hold) current.holdSent = true;
  saveItem(current);
  changed(ownerId);
  if (decision.hold) await sendHold(current, decision.hold);
}

// The secretary's own answer: on success it's logged and the item is closed.
async function sendAnswer(item: Item, text: string) {
  const { ownerId } = item;
  try {
    await sendToChat(item.chat, text);
  } catch (e) {
    console.error(`Secretary answer to ${item.contactName} failed:`, e);
    // It didn't go out: the owner has to see the chat after all.
    const current = getItem(ownerId, item.id);
    if (!current) return;
    current.status = "needs_owner";
    current.shown = true;
    current.autoAsked = null;
    saveItem(current);
    changed(ownerId);
    return;
  }

  console.log(`Secretary → ${item.contactName}: ${text}`);
  addMessage(ownerId, item.chat, { author: "secretary", text, itemId: item.id, at: Date.now() });
  // The glasses font may not have the emoji, so the log keeps the text without the mark.
  logAnswer(ownerId, { contactName: item.contactName, asked: item.autoAsked ?? "", reply: text.replace(AI_MARK, "") });

  const current = getItem(ownerId, item.id);
  if (!current) return;
  // The contact wrote again meanwhile: the item is collecting again, leave it be.
  if (current.revision !== item.revision) return;

  if (current.holdSent) {
    // An earlier part of this chat still waits for the owner: keep the chat on the glasses,
    // and redo its options so they skip what the secretary just answered.
    current.status = "needs_owner";
    current.autoAsked = null;
    saveItem(current);
    changed(ownerId);
    await refreshOptions(ownerId, item.id);
    return;
  }

  deleteItem(item.id);
  changed(ownerId);
}

// "Alex will get back to you": doesn't answer anything, the item stays on the glasses.
async function sendHold(item: Item, text: string) {
  try {
    await sendToChat(item.chat, text);
    console.log(`Secretary → ${item.contactName} (hold): ${text}`);
    addMessage(item.ownerId, item.chat, { author: "secretary", text, itemId: item.id, at: Date.now() });
  } catch (e) {
    console.error(`Secretary hold message to ${item.contactName} failed:`, e);
  }
}

function stillCurrent(ownerId: number, itemId: string, revision: number) {
  const item = getItem(ownerId, itemId);
  return item && item.revision === revision ? item : undefined;
}
