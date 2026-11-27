import { clientMessage, type ClientMessage } from "@vyrse/protocol";
import type WebSocket from "ws";
import { MAX_VOICE_SECONDS, secondsOf } from "../ai/transcribe";
import { startDemo } from "../demo/demo";
import { chooseOption, dictate, discardDraft, dismissItem, sendDraft } from "../inbox/replies";
import { addKnowledge, removeKnowledge, setMode } from "../secretary/settings";
import { CODE_TTL_SEC, newPairingCode } from "./pairing";
import { ownerOf, send } from "./sessions";

// One message from the glasses (or the phone page) → one call into the server.

export async function handleMessage(ws: WebSocket, raw: string) {
  let message: ClientMessage;
  try {
    message = clientMessage.parse(JSON.parse(raw));
  } catch {
    console.warn("Ignored a malformed message from the glasses");
    return;
  }

  // The only thing unpaired glasses can do.
  if (message.type === "pair_request") {
    send(ws, { type: "code", code: newPairingCode(ws), expiresInSec: CODE_TTL_SEC });
    return;
  }

  // Everything else acts on the owner's data; the owner comes from the socket, never the message.
  const ownerId = ownerOf(ws);
  if (ownerId === undefined) return;

  switch (message.type) {
    case "choose":
      return chooseOption(ownerId, message.itemId, message.option);
    case "voice": {
      const pcm = Buffer.from(message.audio, "base64");
      // Too short to be speech, or longer than a reply should be: ignore.
      const seconds = secondsOf(pcm);
      if (seconds < 0.5 || seconds > MAX_VOICE_SECONDS + 1) return;
      return dictate(ownerId, message.itemId, pcm);
    }
    case "send":
      return send(ws, { type: "sent", ok: await sendDraft(ownerId, message.itemId) });
    case "discard":
      return discardDraft(ownerId, message.itemId);
    case "dismiss":
      return dismissItem(ownerId, message.itemId);
    case "set_mode":
      return setMode(ownerId, message.on);
    case "kb_add":
      return addKnowledge(ownerId, message.text);
    case "kb_remove":
      return removeKnowledge(ownerId, message.id);
    case "demo":
      return startDemo(ownerId);
  }
}
