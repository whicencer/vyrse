import type { AnalyzeResult } from "../ai/analyze";

// The secretary's rules (docs/CONCEPT.md §7.1). A pure function: the AI only proposes,
// this decides what actually happens with an item.

// Put in front of every secretary message, so the contact sees it's the AI assistant writing.
export const AI_MARK = "🤖 ";

export type Decision =
  // The secretary answers and the item is settled.
  | { kind: "answer"; text: string }
  // The owner decides. hold: tell the contact the owner will get back (once per item).
  | { kind: "owner"; hold: string | null };

export function decide(input: {
  analysis: AnalyzeResult;
  modeOn: boolean;
  // How many facts are in the knowledge base: the AI may only cite those.
  knowledgeCount: number;
  holdSent: boolean;
}): Decision {
  const { analysis, modeOn, knowledgeCount, holdSent } = input;
  const reply = analysis.reply.trim();

  // Mode off: nothing is ever sent without the owner.
  if (!modeOn || !reply) return { kind: "owner", hold: null };

  // Every fact the reply relies on must really be in the knowledge base. Otherwise the
  // AI may have made it up, so the secretary says nothing at all.
  const grounded = analysis.facts.every((i) => Number.isInteger(i) && i >= 0 && i < knowledgeCount);
  if (!grounded) return { kind: "owner", hold: null };

  if (analysis.decision === "answered") return { kind: "answer", text: AI_MARK + reply };
  return { kind: "owner", hold: holdSent ? null : AI_MARK + reply };
}
