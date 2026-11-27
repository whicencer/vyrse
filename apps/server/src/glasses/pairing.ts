import { randomInt, randomUUID } from "node:crypto";
import type WebSocket from "ws";
import { getOwner, saveOwner, type Owner } from "../owners";
import { bind, send } from "./sessions";
import { ownerOfDevice, saveDevice } from "./store";

// Pairing glasses with a Telegram account:
//   1. the phone page asks for a code ("pair_request") and shows it;
//   2. the owner sends "/pair <code>" to the bot;
//   3. the server makes a device token and sends it to that socket ("paired").
// Next time the glasses connect with ?token= and are recognized right away.

export const CODE_TTL_SEC = 10 * 60;

// Codes waiting for "/pair". Memory only: after a restart the user just asks for a new code.
const pendingCodes = new Map<string, { ws: WebSocket; expiresAt: number }>();

export function newPairingCode(ws: WebSocket) {
  const now = Date.now();
  for (const [code, entry] of pendingCodes) {
    // One live code per socket, and drop expired ones while we're here.
    if (entry.ws === ws || entry.expiresAt <= now) pendingCodes.delete(code);
  }

  let code: string;
  do code = String(randomInt(100000, 1000000));
  while (pendingCodes.has(code));

  pendingCodes.set(code, { ws, expiresAt: now + CODE_TTL_SEC * 1000 });
  return code;
}

// "/pair <code>" from the bot. False if the code is unknown, expired or its glasses went away.
export function confirmPairing(code: string, owner: Owner): boolean {
  const entry = pendingCodes.get(code);
  pendingCodes.delete(code);
  if (!entry || entry.expiresAt <= Date.now() || entry.ws.readyState !== entry.ws.OPEN) return false;

  saveOwner(owner);
  const token = randomUUID();
  saveDevice(token, owner.id);
  send(entry.ws, { type: "paired", token, name: owner.name });
  bind(entry.ws, owner.id);
  return true;
}

// Glasses connected with a saved token: whose are they?
export function authenticate(ws: WebSocket, token: string): boolean {
  const ownerId = ownerOfDevice(token);
  const owner = ownerId === undefined ? undefined : getOwner(ownerId);
  if (!owner) return false;
  // Lets the phone page show who it's paired with after a reload.
  send(ws, { type: "paired", token, name: owner.name });
  bind(ws, owner.id);
  return true;
}

export function forgetSocket(ws: WebSocket) {
  for (const [code, entry] of pendingCodes) if (entry.ws === ws) pendingCodes.delete(code);
}
