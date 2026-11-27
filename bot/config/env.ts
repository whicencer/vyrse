import "dotenv/config";

const BOT_TOKEN = process.env.BOT_TOKEN;
const WS_CONNECTION_SECRET = process.env.WS_CONNECTION_SECRET;

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN is not set. Add it to your .env file.");
}
if (!WS_CONNECTION_SECRET) {
  throw new Error("WS_CONNECTION_SECRET is not set. Add it to your .env file.");
}

export const config = {
  BOT_TOKEN,
  WS_URL: process.env.WS_URL || "ws://localhost:8080",
  // Sent as ?secret= when connecting; the server rejects connections without it.
  WS_CONNECTION_SECRET,
} as const;
