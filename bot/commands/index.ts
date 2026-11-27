import type { BotCommand } from "grammy/types";
import { startCommand } from "./start";
import { pairCommand } from "./pair";
import { secretaryCommands } from "./secretary";

export const commands = [
  startCommand,
  pairCommand,
  secretaryCommands,
];

// Shown in Telegram's command menu. Keep in sync with the handlers above.
export const commandList: BotCommand[] = [
  { command: "start", description: "Start the bot" },
  { command: "pair", description: "Pair glasses to bot" },
  { command: "mode", description: "Secretary mode: /mode on or /mode off" },
  { command: "demo", description: "Play a scripted demo on your glasses" },
];
