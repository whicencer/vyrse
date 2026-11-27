import { Composer, type Context } from "grammy";
import { sendToServer } from "../services/server";

export const pairCommand = new Composer();

// Used by "/pair <code>" and by the t.me/VyrseBot?start=<code> link ("/start <code>").
// The result comes back from the server as "pair_result" (see bot.ts).
export async function pairGlasses(ctx: Context, code: string) {
  if (!ctx.from) return;

  if (!/^\d{6}$/.test(code)) {
    await ctx.reply("The code is 6 digits. Open Vyrse on your phone and tap <b>Pair glasses</b>.", { parse_mode: "HTML" });
    return;
  }

  const sent = sendToServer({
    type: "pair",
    code,
    userId: ctx.from.id,
    name: ctx.from.first_name,
  });

  if (!sent) await ctx.reply("Vyrse server is offline right now, try again in a minute.");
}

pairCommand.command("pair", async (ctx) => {
  const code = ctx.match.trim();

  if (!code) {
    await ctx.reply("Send the code from the Vyrse app: <code>/pair 123456</code>", { parse_mode: "HTML" });
    return;
  }

  await pairGlasses(ctx, code);
});
