import type { DigestEntry } from "@vyrse/protocol";

// The only two events in the server. Everything else is a direct function call.
//
//   changed(ownerId)        something the glasses show has changed for this owner
//   digestReady(ownerId, …) secretary mode was turned off: show what it answered
//
// glasses/server.ts listens to both and pushes updates to the owner's glasses.

type ChangedListener = (ownerId: number) => void;
type DigestListener = (ownerId: number, entries: DigestEntry[]) => void;

const changedListeners: ChangedListener[] = [];
const digestListeners: DigestListener[] = [];

export function changed(ownerId: number) {
  for (const listener of changedListeners) listener(ownerId);
}

export function onChanged(listener: ChangedListener) {
  changedListeners.push(listener);
}

export function digestReady(ownerId: number, entries: DigestEntry[]) {
  for (const listener of digestListeners) listener(ownerId, entries);
}

export function onDigest(listener: DigestListener) {
  digestListeners.push(listener);
}
