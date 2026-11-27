import type { DigestEntry, Fact } from "@vyrse/protocol";
import { db } from "../db";

// All SQL for secretary mode, the knowledge base and the secretary's log.

// ── Mode ─────────────────────────────────────────────────────────────────────

// When secretary mode was turned on, or null when it's off.
export function modeSince(ownerId: number): number | null {
  const row = db().prepare("SELECT mode_since FROM owners WHERE id = ?").get(ownerId) as { mode_since: number | null } | undefined;
  return row?.mode_since ?? null;
}

export const isModeOn = (ownerId: number) => modeSince(ownerId) !== null;

export function setModeSince(ownerId: number, since: number | null) {
  db().prepare("UPDATE owners SET mode_since = ? WHERE id = ?").run(since, ownerId);
}

// ── Knowledge base ───────────────────────────────────────────────────────────

export function listKnowledge(ownerId: number): Fact[] {
  return db().prepare("SELECT id, text FROM knowledge WHERE owner_id = ? ORDER BY id").all(ownerId) as Fact[];
}

export function addFact(ownerId: number, text: string) {
  db().prepare("INSERT INTO knowledge (owner_id, text, created_at) VALUES (?, ?, ?)").run(ownerId, text, Date.now());
}

export function removeFact(ownerId: number, factId: number) {
  db().prepare("DELETE FROM knowledge WHERE owner_id = ? AND id = ?").run(ownerId, factId);
}

export function replaceKnowledge(ownerId: number, facts: string[]) {
  db().transaction(() => {
    db().prepare("DELETE FROM knowledge WHERE owner_id = ?").run(ownerId);
    for (const fact of facts) addFact(ownerId, fact);
  })();
}

// ── Log: what the secretary answered by itself ───────────────────────────────

export function logAnswer(ownerId: number, entry: DigestEntry) {
  db()
    .prepare("INSERT INTO secretary_log (owner_id, contact_name, asked, reply, at) VALUES (?, ?, ?, ?, ?)")
    .run(ownerId, entry.contactName, entry.asked, entry.reply, Date.now());
}

export function logSince(ownerId: number, since: number): DigestEntry[] {
  return db()
    .prepare(
      `SELECT contact_name AS contactName, asked, reply FROM secretary_log
       WHERE owner_id = ? AND at >= ? ORDER BY id`,
    )
    .all(ownerId, since) as DigestEntry[];
}
