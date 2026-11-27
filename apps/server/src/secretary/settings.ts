import { changed, digestReady } from "../events";
import { notifyOwner } from "../telegram/notify";
import { addFact, logSince, modeSince, removeFact, setModeSince } from "./store";

// What the owner changes about the secretary: the mode and the knowledge base.
// Called from the bot (/mode) and from the phone page.

export function setMode(ownerId: number, on: boolean) {
  const since = modeSince(ownerId);

  if (on) {
    if (since !== null) return;
    setModeSince(ownerId, Date.now());
    void notifyOwner(ownerId, { kind: "mode_on" });
  } else {
    if (since === null) return;
    // What the secretary answered while the mode was on (docs/CONCEPT.md §7.2).
    const answered = logSince(ownerId, since);
    setModeSince(ownerId, null);
    void notifyOwner(ownerId, { kind: "mode_off", answered });
    if (answered.length) digestReady(ownerId, answered);
  }
  changed(ownerId);
}

export function addKnowledge(ownerId: number, text: string) {
  addFact(ownerId, text);
  changed(ownerId);
}

export function removeKnowledge(ownerId: number, factId: number) {
  removeFact(ownerId, factId);
  changed(ownerId);
}
