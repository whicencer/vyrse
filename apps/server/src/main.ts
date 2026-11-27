import { config } from "./config";
import { openDb } from "./db";
import { startGlassesServer } from "./glasses/server";
import { recover } from "./inbox/incoming";
import { startBot, stopBot } from "./telegram";

// Entry point: one process with the database, the Telegram bot and the glasses server.

openDb(config.dbPath);
recover();
const glasses = startGlassesServer(config.port);
await startBot();

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`);
  await stopBot();
  glasses.close();
  process.exit(0);
}
process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
