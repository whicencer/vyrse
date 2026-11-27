import { businessConnectionHandler } from "./businessConnection";
import { businessMessageHandler } from "./businessMessage";
import { messageHandler } from "./message";

export const handlers = [
  messageHandler,
  businessConnectionHandler,
  businessMessageHandler,
];
