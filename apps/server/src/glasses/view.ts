import type { AnalysisView, ItemView, ServerMessage } from "@vyrse/protocol";
import { contactMessagesOf, listItems } from "../inbox/store";
import type { Item } from "../inbox/types";
import { listKnowledge, modeSince } from "../secretary/store";

// What the glasses get: every chat waiting for the owner, the mode and the knowledge base.
// Only items that have been shown are included: a new burst stays hidden until it's
// complete, and in secretary mode until the secretary decides it needs the owner.

export function buildState(ownerId: number): Extract<ServerMessage, { type: "state" }> {
  const since = modeSince(ownerId);
  return {
    type: "state",
    items: listItems(ownerId).filter((item) => item.shown).map(toView),
    mode: since === null ? null : { since },
    knowledge: listKnowledge(ownerId),
  };
}

function toView(item: Item): ItemView {
  return {
    id: item.id,
    name: item.contactName,
    messages: contactMessagesOf(item.id),
    collecting: item.status === "collecting",
    analysis: analysisView(item),
    draft: item.draft,
  };
}

function analysisView(item: Item): AnalysisView {
  if (item.analysis === "failed") return { status: "failed" };
  if (item.analysis) return { status: "ready", ...item.analysis };
  return { status: "thinking" };
}
