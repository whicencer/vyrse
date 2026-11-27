import type { ChatRef } from "./inbox/types";
import { sendBusinessMessage } from "./telegram/send";

// Every message to a contact goes out through here: the owner's replies and the secretary's.
// Demo chats aren't in Telegram, so sending to them only pretends (and logs it).
// Throws if the message didn't go out.

const DEMO_DELAY_MS = 400;

export async function sendToChat(chat: ChatRef, text: string): Promise<void> {
  if (chat.channel === "demo") {
    await new Promise((resolve) => setTimeout(resolve, DEMO_DELAY_MS));
    console.log(`[demo chat ${chat.chatId}] ← ${text}`);
    return;
  }
  await sendBusinessMessage(chat.connectionId, chat.chatId, text);
}
