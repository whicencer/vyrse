import { Composer } from "grammy";
import { rememberOwner } from "../services/owners";

export const businessConnectionHandler = new Composer();

businessConnectionHandler.on("business_connection", async (ctx) => {
  const { id, user, user_chat_id, is_enabled } = ctx.businessConnection;
  rememberOwner(id, user.id);

  if (!is_enabled) {
    await ctx.api.sendMessage(user_chat_id, "<b>🔌 You disconnected me from your account</b>", { parse_mode: "HTML" });
  } else {
    await ctx.api.sendMessage(user_chat_id, "<b>✅ You connected me to your account</b>", { parse_mode: "HTML" });
  }
});
