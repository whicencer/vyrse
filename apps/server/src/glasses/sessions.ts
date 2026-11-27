import type { ServerMessage } from "@vyrse/protocol";
import WebSocket from "ws";
import { buildState } from "./view";

// Open sockets of paired glasses (and phone pages), by owner. Memory only.

const socketsByOwner = new Map<number, Set<WebSocket>>();
const ownerBySocket = new Map<WebSocket, number>();

// The socket belongs to this owner from now on, and gets their current state.
export function bind(ws: WebSocket, ownerId: number) {
  unbind(ws);
  ownerBySocket.set(ws, ownerId);
  let sockets = socketsByOwner.get(ownerId);
  if (!sockets) socketsByOwner.set(ownerId, (sockets = new Set()));
  sockets.add(ws);
  send(ws, buildState(ownerId));
}

export function unbind(ws: WebSocket) {
  const ownerId = ownerBySocket.get(ws);
  if (ownerId === undefined) return;
  ownerBySocket.delete(ws);
  socketsByOwner.get(ownerId)?.delete(ws);
}

export const ownerOf = (ws: WebSocket) => ownerBySocket.get(ws);

export function send(ws: WebSocket, message: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

export function sendToOwner(ownerId: number, message: ServerMessage) {
  for (const ws of socketsByOwner.get(ownerId) ?? []) send(ws, message);
}

// Several changes in a row (e.g. an item is saved, then its draft) become one push.
const pending = new Set<number>();
export function pushState(ownerId: number) {
  if (!socketsByOwner.get(ownerId)?.size || pending.has(ownerId)) return;
  pending.add(ownerId);
  queueMicrotask(() => {
    pending.delete(ownerId);
    sendToOwner(ownerId, buildState(ownerId));
  });
}
