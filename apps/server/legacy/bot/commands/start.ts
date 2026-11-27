import { Composer } from "grammy";
import { pairGlasses } from "./pair";

export const startCommand = new Composer();

startCommand.command("start", async (ctx) => {
  // Opened through t.me/VyrseBot?start=<code> from the pairing dialog.
  const code = ctx.match.trim();
  if (code) return pairGlasses(ctx, code);

  return ctx.reply(
    [
      `<b>👋 Hi, ${ctx.from?.first_name ?? "there"}! I'm Vyrse, your AI secretary.</b>`,
      "",
      "<b>Connect me to your account:</b>",
      "1. Open Telegram <b>Settings</b> → <b>Chat Automation</b>",
      `2. Enter <code>@${ctx.me.username}</code> as the bot`,
      "3. Choose which private chats I may read and reply to",
      "",
      "I'll send a message here once the connection is set up.",
      "",
      "<b>Then pair your glasses:</b> open Vyrse on your phone, tap <b>Pair glasses</b> and follow the link.",
    ].join("\n"),
    { parse_mode: "HTML" },
  );
});
