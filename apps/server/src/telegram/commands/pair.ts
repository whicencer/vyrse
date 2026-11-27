import { Composer, type Context } from "grammy";
import { confirmPairing } from "../../glasses/pairing";

export const pairCommand = new Composer();

// Used by "/pair <code>" and by the t.me/VyrseBot?start=<code> link ("/start <code>").
export async function pairGlasses(ctx: Context, code: string) {
  if (!ctx.from) return;

  if (!/^\d{6}$/.test(code)) {
    await ctx.reply("The code is 6 digits. Open Vyrse on your phone and tap <b>Pair glasses</b>.", { parse_mode: "HTML" });
    return;
  }

  const paired = confirmPairing(code, { id: ctx.from.id, name: ctx.from.first_name });
  await ctx.reply(
    paired
      ? "<b>👓 Glasses paired</b>\nNew messages from your chats will show up on them."
      : "<b>❌ Code is wrong or expired</b>\nTap <b>Pair glasses</b> in the Vyrse app to get a new one.",
    { parse_mode: "HTML" },
  );
}

pairCommand.command("pair", async (ctx) => {
  const code = ctx.match.trim();

  if (!code) {
    await ctx.reply("Send the code from the Vyrse app: <code>/pair 123456</code>", { parse_mode: "HTML" });
    return;
  }

  await pairGlasses(ctx, code);
});
