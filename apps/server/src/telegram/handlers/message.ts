import { Composer } from "grammy";

export const messageHandler = new Composer();

// Known commands are handled earlier, so any command that reaches here is unknown.
messageHandler.on("message:text", async (ctx) => {
  if (ctx.message.text.startsWith("/")) {
    await ctx.reply("Unknown command. Send /start to see what I can do.");
    return;
  }
});
