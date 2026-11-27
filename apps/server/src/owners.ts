import { db } from "./db";

// Owners (Telegram accounts using Vyrse) and their Telegram Business connections.

export type Owner = { id: number; name: string };

// Creates the owner on first contact and keeps their name current.
export function saveOwner(owner: Owner) {
  db()
    .prepare("INSERT INTO owners (id, name) VALUES (?, ?) ON CONFLICT (id) DO UPDATE SET name = excluded.name")
    .run(owner.id, owner.name);
}

export function getOwner(id: number): Owner | undefined {
  return db().prepare("SELECT id, name FROM owners WHERE id = ?").get(id) as Owner | undefined;
}

// The secretary speaks about the owner by this name ("Alex will get back to you").
export function ownerName(id: number) {
  return getOwner(id)?.name ?? "the owner";
}

export function saveConnection(connectionId: string, ownerId: number, enabled: boolean) {
  db()
    .prepare(
      `INSERT INTO connections (id, owner_id, enabled) VALUES (?, ?, ?)
      ON CONFLICT (id) DO UPDATE SET owner_id = excluded.owner_id, enabled = excluded.enabled`,
    )
    .run(connectionId, ownerId, enabled ? 1 : 0);
}

// Owner of a Business connection, or undefined if the server hasn't seen it yet.
export function ownerOfConnection(connectionId: string): number | undefined {
  const row = db().prepare("SELECT owner_id FROM connections WHERE id = ?").get(connectionId) as
    | { owner_id: number }
    | undefined;
  return row?.owner_id;
}
