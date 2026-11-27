import { Bot, GrammyError, HttpError } from "grammy";
import { config } from "./config/env";
import { logger } from "./middlewares/logger";
import { commandList, commands } from "./commands";
import { handlers } from "./handlers";
import { connectToServer, onServerMessage, sendToServer } from "./services/server";
import { getOwner } from "./services/owners";

const bot = new Bot(config.BOT_TOKEN);

// Middlewares
bot.use(logger);

// Commands & handlers (order matters: commands before generic handlers)
bot.use(...commands);
bot.use(...handlers);

// Error handling
bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Error while handling update ${ctx.update.update_id}:`);
  const e = err.error;
  if (e instanceof GrammyError) {
    console.error("Error in request:", e.description);
  } else if (e instanceof HttpError) {
    console.error("Could not contact Telegram:", e);
  } else {
    console.error("Unknown error:", e);
  }
});

connectToServer();

onServerMessage(async (msg) => {
  switch (msg.type) {
    case "reply": {
      let isSuccess = false;
      try {
        // ownerId is set by the server from the glasses' socket: only reply
        // through a business connection that belongs to that account.
        if ((await getOwner(bot.api, msg.connectionId)) !== msg.ownerId) {
          throw new Error(`connection ${msg.connectionId} is not owned by ${msg.ownerId}`);
        }
        await bot.api.sendMessage(msg.chatId, msg.text, {
          business_connection_id: msg.connectionId,
        });
        isSuccess = true;
      } catch (e) {
        console.error("Reply failed:", e);
      }

      sendToServer({ type: "reply_sent_status", ownerId: msg.ownerId, batchId: msg.batchId, kind: msg.kind, text: msg.text, isSuccess });
      break;
    }

    case "notify":
      await bot.api
        .sendMessage(msg.userId, msg.text, { parse_mode: "HTML" })
        .catch((e) => console.error("Notify failed:", e));
      break;

    case "pair_result":
      await bot.api
        .sendMessage(
          msg.userId,
          msg.ok
            ? "<b>👓 Glasses paired</b>\nNew messages from your chats will show up on them."
            : "<b>❌ Code is wrong or expired</b>\nTap <b>Pair glasses</b> in the Vyrse app to get a new one.",
          { parse_mode: "HTML" },
        )
        .catch((e) => console.error("Pair result message failed:", e));
      break;
  }
});

await bot.api.setMyCommands(commandList);

bot.start({
  onStart: (me) => console.log(`Bot @${me.username} started`),
});

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down...`);
  await bot.stop();
  process.exit(0);
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
