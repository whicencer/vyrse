import WebSocket from "ws";
import { config } from "../config/env";
import type { FromBot, ToBot } from "@vyrse/protocol/legacy";

const RECONNECT_MS = 2000;

let socket: WebSocket | null = null;
let handler: (msg: ToBot) => void | Promise<void> = () => {};

export function connectToServer() {
  const url = new URL(config.WS_URL);
  url.searchParams.set("role", "bot");
  url.searchParams.set("secret", config.WS_CONNECTION_SECRET);

  const ws = new WebSocket(url);
  socket = ws;

  ws.on("open", () => console.log("Bot connected to server!"));

  ws.on("message", (raw) => {
    try {
      handler(JSON.parse(raw.toString()));
    } catch (e) {
      console.error("Bad message from server:", e);
    }
  });
  
  ws.on("error", () => {});

  ws.on("close", () => {
    socket = null;
    setTimeout(connectToServer, RECONNECT_MS);
  });
}

// Returns false when the server isn't connected, so callers can tell the user.
export function sendToServer(msg: FromBot) {
  if (socket?.readyState !== WebSocket.OPEN) return false;
  socket.send(JSON.stringify(msg));
  return true;
}

export function onServerMessage(fn: (msg: ToBot) => void | Promise<void>) {
  handler = fn;
}
