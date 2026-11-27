import { bot } from "./bot";

// Sends a message into one of the owner's private chats, on the owner's behalf.
// Throws if Telegram refuses (e.g. the chat is no longer allowed for the bot).
export async function sendBusinessMessage(connectionId: string, chatId: number, text: string) {
  await bot.api.sendMessage(chatId, text, { business_connection_id: connectionId });
}
