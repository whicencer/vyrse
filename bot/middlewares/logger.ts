import type { Context, NextFunction } from "grammy";

export async function logger(ctx: Context, next: NextFunction) {
  const start = Date.now();
  await next();
  console.log(`[update ${ctx.update.update_id}] handled in ${Date.now() - start}ms`);
}
