import type { AgentContext } from "../inbox/history";
import { askJson } from "./client";
import { COMPOSE_PROMPT } from "./prompts";

// Second AI call: writes the owner's message for the intent they picked on the glasses,
// or turns what they dictated into a clean message.

export type ComposeInput = {
  contact: string;
  context: AgentContext;
  intent: string;
  knowledge: string[];
  // The owner's own words from a voice reply; then `intent` is only a label.
  dictated?: string;
};

const SCHEMA = {
  type: "object",
  properties: { text: { type: "string" } },
  required: ["text"],
  additionalProperties: false,
};

export async function compose({ contact, context, intent, knowledge, dictated }: ComposeInput): Promise<string> {
  const input = { contact, history: context.history, open: context.open, intent, knowledge, dictated: dictated ?? null };
  const result = await askJson<{ text: string }>(COMPOSE_PROMPT, input, "reply", SCHEMA);
  return result.text.trim();
}
