import type { Message } from "./types";

// Turns a chat's stored messages into what the AI reads. Pure functions, no database.

// "assistant" is the secretary: the prompts call it that.
export type Turn = { from: "contact" | "owner" | "assistant"; text: string };

// What the AI gets for an item:
//   history  — the conversation before this item;
//   open     — this item as it happened: the contact's messages, plus any notes the
//              secretary already sent in between ("Alex will get back to you");
//   toAnswer — the contact's messages after the last reply: the only ones the secretary
//              should respond to now.
export type AgentContext = { history: Turn[]; open: Turn[]; toAnswer: string[] };

export function contextOf(messages: Message[], itemId: string): AgentContext {
  const turns = messages.map(toTurn);
  const first = messages.findIndex((m) => m.itemId === itemId);
  const start = first === -1 ? turns.length : first;

  let lastReply = turns.length;
  while (lastReply > start && turns[lastReply - 1]!.from === "contact") lastReply--;

  return {
    history: turns.slice(0, start),
    open: turns.slice(start),
    toAnswer: turns.slice(lastReply).map((t) => t.text),
  };
}

function toTurn(m: Message): Turn {
  return { from: m.author === "secretary" ? "assistant" : m.author, text: m.text };
}
