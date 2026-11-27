import { Composer } from "grammy";
import { getOwner } from "../services/owners";
import { sendToServer } from "../services/server";

export const businessMessageHandler = new Composer();

businessMessageHandler.on("business_message", async (ctx) => {
  const { chat, from, business_connection_id, message_id, date } = ctx.businessMessage;
  if (!business_connection_id || chat.type !== "private" || !from) return;

  // The server delivers it only to the glasses paired with this account.
  const ownerId = await getOwner(ctx.api, business_connection_id);

  // Sent by us on the owner's behalf (glasses or secretary): the server already knows.
  if (ctx.businessMessage.sender_business_bot) return;

  // The owner wrote in this chat from their phone: the batch is answered.
  if (from.id === ownerId) {
    const text = (ctx.businessMessage.text ?? ctx.businessMessage.caption)?.trim();
    sendToServer({ type: "owner_reply", ownerId, connectionId: business_connection_id, chatId: chat.id, text });
    return;
  }

  const text = (ctx.businessMessage.text ?? ctx.businessMessage.caption)?.trim();
  if (from.id !== chat.id || !text) return;

  sendToServer({
    type: "message",
    ownerId,
    connectionId: business_connection_id,
    chat: { id: chat.id, name: chat.first_name },
    message: { id: message_id, text, date },
  });
});

// The contact edited a message: the glasses just show the new text, no notification.
businessMessageHandler.on("edited_business_message", async (ctx) => {
  const { chat, from, business_connection_id, message_id } = ctx.editedBusinessMessage;
  const text = (ctx.editedBusinessMessage.text ?? ctx.editedBusinessMessage.caption)?.trim();
  if (!business_connection_id || chat.type !== "private" || !from || from.id !== chat.id || !text) return;

  const ownerId = await getOwner(ctx.api, business_connection_id);
  sendToServer({ type: "message_edited", ownerId, connectionId: business_connection_id, chatId: chat.id, messageId: message_id, text });
});
