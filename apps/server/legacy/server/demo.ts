import { addMessage } from "./queue";
import { setKnowledge, setMode } from "./secretary";

// Demo mode (CONCEPT.md §10, §13.2): scripted private chats fed into the same pipeline
// as real Telegram messages, so judges can see the secretary without connecting an account.
// Chats use the "demo" connection: replies to them are not sent anywhere.

export const DEMO_CONNECTION = "demo";

// The owner is a freelance photographer; the secretary may use these facts on its own.
const KNOWLEDGE = [
  "Working hours: Monday to Friday, 10:00–19:00. Closed on weekends.",
  "Studio address: 24 Marina Walk, Dubai Marina, 3rd floor.",
  "Portrait photoshoot: 1 hour, $150, includes 20 edited photos.",
  "Booking link: cal.example.com/alex",
];

// [seconds from start, contact, message]
const SCRIPT: [number, string, string][] = [
  [2, "Sarah", "Hi! How much is a portrait photoshoot?"],
  [5, "Mike", "hey"],
  [6.5, "Mike", "are you around?"],
  [8, "Mike", "can we move tomorrow's shoot from 11 to 14? the client is running late"],
  [11, "Lena", "What's the address of your studio?"],
  [17, "Tom", "Are you open on Saturday?"],
  [20, "Anna", "I sent you the contract for the wedding shoot. Can you sign it by tomorrow? The client is waiting"],
  [34, "Sarah", "Great, how do I book?"],
];

const chatIds = new Map<string, number>();
const chatIdOf = (name: string) => {
  if (!chatIds.has(name)) chatIds.set(name, -(chatIds.size + 1));
  return chatIds.get(name)!;
};

const running = new Map<number, NodeJS.Timeout[]>();
let messageId = 1;

// Turns secretary mode on with the demo knowledge base and plays the script.
export function startDemo(ownerId: number) {
  for (const t of running.get(ownerId) ?? []) clearTimeout(t);

  setKnowledge(ownerId, KNOWLEDGE);
  setMode(ownerId, true);

  running.set(
    ownerId,
    SCRIPT.map(([at, name, text]) =>
      setTimeout(() => {
        addMessage(ownerId, DEMO_CONNECTION, { id: chatIdOf(name), name }, {
          id: messageId++,
          text,
          date: Math.floor(Date.now() / 1000),
        });
      }, at * 1000),
    ),
  );
}
