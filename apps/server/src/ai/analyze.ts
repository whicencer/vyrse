import type { AgentContext } from "../inbox/history";
import { askJson } from "./client";
import { ANALYZE_PROMPT } from "./prompts";

// First AI call for an item: what the contact wants, what the owner could answer,
// and (in secretary mode) whether the secretary can answer by itself.
// It only proposes; secretary/policy.ts decides what actually happens.

export type AnalyzeInput = {
  contact: string;
  context: AgentContext;
  // on: secretary mode. owner: the owner's first name. knowledge: facts the secretary may use.
  secretary: { on: boolean; owner: string; knowledge: string[] };
};

export type AnalyzeResult = {
  summary: string;
  options: string[];
  // "answered": the secretary can settle it itself; "needs_owner": the owner has to decide.
  decision: "answered" | "needs_owner";
  // The secretary's message: the answer, or "Alex will get back to you". Empty when mode is off.
  reply: string;
  // Indexes of the knowledge items the reply relies on (checked by the policy).
  facts: number[];
};

const SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    options: { type: "array", items: { type: "string" } },
    decision: { type: "string", enum: ["answered", "needs_owner"] },
    reply: { type: "string" },
    facts: { type: "array", items: { type: "integer" } },
  },
  required: ["summary", "options", "decision", "reply", "facts"],
  additionalProperties: false,
};

export async function analyze({ contact, context, secretary }: AnalyzeInput): Promise<AnalyzeResult> {
  const result = await askJson<AnalyzeResult>(ANALYZE_PROMPT, { contact, ...context, secretary }, "analysis", SCHEMA);
  return {
    summary: result.summary.trim(),
    options: result.options.map((o) => o.trim()).filter(Boolean).slice(0, 3),
    decision: result.decision === "answered" ? "answered" : "needs_owner",
    reply: secretary.on ? result.reply.trim() : "",
    facts: result.facts,
  };
}
