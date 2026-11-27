import { Composer } from "grammy";
import type { Message } from "grammy/types";
import { ownerRepliedElsewhere, receiveEdit, receiveMessage } from "../../inbox/incoming";
import type { ChatRef } from "../../inbox/types";
import { resolveOwner } from "../services/owners";

export const businessMessageHandler = new Composer();

const textOf = (message: Message) => (message.text ?? message.caption)?.trim() || undefined;
const chatRef = (connectionId: string, chatId: number): ChatRef => ({ channel: "telegram", connectionId, chatId });

businessMessageHandler.on("business_message", async (ctx) => {
  const message = ctx.businessMessage;
  const { chat, from, business_connection_id: connectionId } = message;
  if (!connectionId || chat.type !== "private" || !from) return;

  // Sent by us on the owner's behalf (glasses or secretary): the server already knows.
  if (message.sender_business_bot) return;

  const ownerId = await resolveOwner(ctx.api, connectionId);
  const text = textOf(message);

  // The owner wrote in this chat from their phone: the item is answered.
  if (from.id === ownerId) {
    ownerRepliedElsewhere(ownerId, chatRef(connectionId, chat.id), text);
    return;
  }

  // Only the contact's own text messages.
  if (from.id !== chat.id || !text) return;
  receiveMessage(ownerId, chatRef(connectionId, chat.id), chat.first_name, {
    externalId: message.message_id,
    text,
    at: message.date * 1000,
  });
});

// The contact edited a message: the glasses just show the new text, no notification.
businessMessageHandler.on("edited_business_message", async (ctx) => {
  const message = ctx.editedBusinessMessage;
  const { chat, from, business_connection_id: connectionId } = message;
  const text = textOf(message);
  if (!connectionId || chat.type !== "private" || !from || from.id !== chat.id || !text) return;

  const ownerId = await resolveOwner(ctx.api, connectionId);
  receiveEdit(ownerId, chatRef(connectionId, chat.id), message.message_id, text);
});
