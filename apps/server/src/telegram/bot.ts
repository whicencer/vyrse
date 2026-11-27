import { Bot } from "grammy";
import { config } from "../config";

// The bot instance, on its own so that sending (send.ts, notify.ts) doesn't import the
// update handlers. Handlers are attached and polling starts in index.ts.
export const bot = new Bot(config.telegram.botToken);
