import { Composer } from "grammy";
import { sendToServer } from "../services/server";

// /mode, /demo. The server keeps the state and answers with a "notify" message (see bot.ts).
export const secretaryCommands = new Composer();

const offline = "Vyrse server is offline right now, try again in a minute.";

secretaryCommands.command("mode", async (ctx) => {
  if (!ctx.from) return;
  const arg = ctx.match.trim().toLowerCase();

  if (arg !== "on" && arg !== "off") {
    await ctx.reply(
      "<b>Secretary mode</b>\n<code>/mode on</code>: I answer routine questions from your knowledge base myself.\n<code>/mode off</code>: every message shows up on your glasses.",
      { parse_mode: "HTML" },
    );
    return;
  }
  if (!sendToServer({ type: "set_mode", ownerId: ctx.from.id, on: arg === "on" })) await ctx.reply(offline);
});

secretaryCommands.command("demo", async (ctx) => {
  if (!ctx.from) return;
  if (!sendToServer({ type: "demo", ownerId: ctx.from.id })) await ctx.reply(offline);
});
