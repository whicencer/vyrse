import { db } from "../db";

// All SQL for paired glasses. Glasses keep their token and connect with it next time.

export function saveDevice(token: string, ownerId: number) {
  db().transaction(() => {
    // One pair of glasses per account: pairing again revokes the old token.
    db().prepare("DELETE FROM devices WHERE owner_id = ?").run(ownerId);
    db().prepare("INSERT INTO devices (token, owner_id, created_at) VALUES (?, ?, ?)").run(token, ownerId, Date.now());
  })();
}

export function ownerOfDevice(token: string): number | undefined {
  const row = db().prepare("SELECT owner_id FROM devices WHERE token = ?").get(token) as { owner_id: number } | undefined;
  return row?.owner_id;
}
