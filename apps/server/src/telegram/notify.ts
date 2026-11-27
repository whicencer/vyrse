import type { DigestEntry } from "@vyrse/protocol";
import { bot } from "./bot";

// Messages from the bot to the owner about what the server did. The rest of the server
// passes plain data; the wording lives here.

export type OwnerNotification =
  | { kind: "mode_on" }
  // answered: what the secretary answered while the mode was on.
  | { kind: "mode_off"; answered: DigestEntry[] }
  | { kind: "demo_started" };

// Failures are only logged: a notification is never worth failing the action for.
export async function notifyOwner(ownerId: number, notification: OwnerNotification) {
  await bot.api.sendMessage(ownerId, textOf(notification), { parse_mode: "HTML" }).catch((e) => {
    console.error(`Notify ${ownerId} failed:`, e instanceof Error ? e.message : e);
  });
}

function textOf(n: OwnerNotification) {
  switch (n.kind) {
    case "mode_on":
      return "<b>🤖 Secretary mode is on</b>\nI'll answer what doesn't need you myself. Only messages that need your decision show up on your glasses.";
    case "mode_off":
      return n.answered.length
        ? `<b>Secretary mode is off. Answered for you:</b>\n${n.answered.map(digestLine).join("\n")}`
        : "<b>Secretary mode is off.</b> Every message shows up on your glasses.";
    case "demo_started":
      return "<b>▶️ Demo started</b>\nSecretary mode is on with a sample knowledge base. Scripted chats will arrive over the next minute.";
  }
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function digestLine(e: DigestEntry) {
  // The summary often starts with the name already ("Sarah asks…").
  const asked = e.asked.startsWith(e.contactName) ? escape(e.asked) : `<b>${escape(e.contactName)}</b>: ${escape(e.asked)}`;
  return `• ${asked}\n  → ${escape(e.reply)}`;
}
