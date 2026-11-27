import type { Digest, ModeState } from "./types";

// The secretary's settings and what it did (CONCEPT.md §7.1, §7.2, §9). Memory only.
//
// Secretary mode: while it's on, the secretary answers what doesn't need the owner (see agent.ts)
// and logs what it said, so the owner can read it when the mode is turned off.

// What the agent did while the mode was on.
type Session = {
  startedAt: number;
  handled: { name: string; asked: string; reply: string }[];
};

const sessions = new Map<number, Session>();
const knowledge = new Map<number, string[]>();

export function modeOf(ownerId: number): ModeState | null {
  const s = sessions.get(ownerId);
  return s ? { since: s.startedAt } : null;
}

// Turns the mode on or off. Turning it off returns what the secretary answered, if anything.
export function setMode(ownerId: number, on: boolean): Digest | null {
  if (on) {
    if (!sessions.has(ownerId)) sessions.set(ownerId, { startedAt: Date.now(), handled: [] });
    return null;
  }
  const digest = digestOf(ownerId);
  sessions.delete(ownerId);
  return digest;
}

function digestOf(ownerId: number): Digest | null {
  const s = sessions.get(ownerId);
  if (!s?.handled.length) return null;
  return { log: s.handled };
}

// Owner's first name from Telegram (saved at pairing); the secretary speaks about them by it.
const ownerNames = new Map<number, string>();
export function setOwnerName(ownerId: number, name: string) {
  ownerNames.set(ownerId, name);
}
export function ownerNameOf(ownerId: number) {
  return ownerNames.get(ownerId) ?? "the owner";
}

// ── Knowledge base: facts the secretary may use on its own ─────────────────

export function knowledgeOf(ownerId: number) {
  return knowledge.get(ownerId) ?? [];
}

export function addKnowledge(ownerId: number, fact: string) {
  knowledge.set(ownerId, [...knowledgeOf(ownerId), fact.trim()]);
}

export function removeKnowledge(ownerId: number, index: number) {
  knowledge.set(ownerId, knowledgeOf(ownerId).filter((_, i) => i !== index));
}

export function setKnowledge(ownerId: number, facts: string[]) {
  knowledge.set(ownerId, facts);
}

// ── Session stats ────────────────────────────────────────────────────────────

export function logHandled(ownerId: number, entry: Session["handled"][number]) {
  sessions.get(ownerId)?.handled.push(entry);
}
