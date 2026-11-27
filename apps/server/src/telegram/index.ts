import { GrammyError, HttpError } from "grammy";
import { bot } from "./bot";
import { commandList, commands } from "./commands";
import { handlers } from "./handlers";
import { logger } from "./middlewares/logger";

// Starts the Telegram side: commands from the owner and Business updates from their chats.

export async function startBot() {
  bot.use(logger);
  // Order matters: commands before the generic handlers.
  bot.use(...commands);
  bot.use(...handlers);

  bot.catch((err) => {
    console.error(`Error while handling update ${err.ctx.update.update_id}:`);
    const e = err.error;
    if (e instanceof GrammyError) console.error("Error in request:", e.description);
    else if (e instanceof HttpError) console.error("Could not contact Telegram:", e);
    else console.error("Unknown error:", e);
  });

  await bot.api.setMyCommands(commandList);
  // Long polling. Not awaited: it only resolves when the bot stops.
  void bot.start({
    allowed_updates: ["message", "business_connection", "business_message", "edited_business_message"],
    onStart: (me) => console.log(`Bot @${me.username} started`),
  });
}

export const stopBot = () => bot.stop();
