import { Composer } from "grammy";
import { startDemo } from "../../demo/demo";
import { saveOwner } from "../../owners";
import { setMode } from "../../secretary/settings";

// /mode, /demo. The result comes back as a notification (see notify.ts), the same way as
// when the mode is switched on the phone page.
export const secretaryCommands = new Composer();

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
  saveOwner({ id: ctx.from.id, name: ctx.from.first_name });
  setMode(ctx.from.id, arg === "on");
});

secretaryCommands.command("demo", (ctx) => {
  if (!ctx.from) return;
  saveOwner({ id: ctx.from.id, name: ctx.from.first_name });
  startDemo(ctx.from.id);
});
