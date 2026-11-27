import { Composer } from "grammy";
import { saveConnection, saveOwner } from "../../owners";

export const businessConnectionHandler = new Composer();

// The owner connected (or disconnected) the bot in Telegram's Chat Automation settings.
businessConnectionHandler.on("business_connection", async (ctx) => {
  const { id, user, user_chat_id, is_enabled } = ctx.businessConnection;
  saveOwner({ id: user.id, name: user.first_name });
  saveConnection(id, user.id, is_enabled);

  await ctx.api.sendMessage(
    user_chat_id,
    is_enabled ? "<b>✅ You connected me to your account</b>" : "<b>🔌 You disconnected me from your account</b>",
    { parse_mode: "HTML" },
  );
});
