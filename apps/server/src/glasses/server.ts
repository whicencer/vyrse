import http from "node:http";
import { WebSocketServer } from "ws";
import { onChanged, onDigest } from "../events";
import { handleMessage } from "./handlers";
import { authenticate, forgetSocket } from "./pairing";
import { pushState, sendToOwner, unbind } from "./sessions";

// HTTP server: the glasses connect over WebSocket (any path), /health answers "ok".
// Glasses connect with ?token=<device token> once paired; without one they can only pair.

export function startGlassesServer(port: number) {
  const server = http.createServer((req, res) => {
    res.writeHead(req.url === "/health" ? 200 : 404).end(req.url === "/health" ? "ok" : "");
  });
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws, request) => {
    const token = new URL(request.url ?? "/", "http://localhost").searchParams.get("token");
    if (token) authenticate(ws, token);

    ws.on("message", (raw) => {
      handleMessage(ws, raw.toString()).catch((e) => console.error("Glasses message failed:", e));
    });
    ws.on("close", () => {
      unbind(ws);
      forgetSocket(ws);
    });
    ws.on("error", console.error);
  });

  // Whatever changed for an owner, their glasses get the new state.
  onChanged(pushState);
  onDigest((ownerId, entries) => sendToOwner(ownerId, { type: "digest", entries }));

  server.listen(port, () => console.log(`Glasses server on port ${port}`));
  return server;
}
