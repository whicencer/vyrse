import { changed } from "../events";
import { closeItem, receiveMessage } from "../inbox/incoming";
import { deleteDemoData, listItems } from "../inbox/store";
import type { ChatRef } from "../inbox/types";
import { isModeOn, replaceKnowledge, setModeSince } from "../secretary/store";
import { notifyOwner } from "../telegram/notify";

// Demo mode (docs/CONCEPT.md §10): scripted private chats fed into the same pipeline as
// real Telegram messages, so judges can see the secretary without connecting an account.
// The chats use the "demo" channel: replies to them are not sent anywhere (see send.ts).

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

const CONTACTS = [...new Set(SCRIPT.map(([, name]) => name))];
// Demo chat ids are negative, so they never clash with real Telegram chats.
const demoChat = (name: string): ChatRef => ({ channel: "demo", connectionId: "demo", chatId: -(CONTACTS.indexOf(name) + 1) });

const running = new Map<number, NodeJS.Timeout[]>();
let messageId = 1;

// Turns secretary mode on with the demo knowledge base and plays the script from the start.
export function startDemo(ownerId: number) {
  for (const timer of running.get(ownerId) ?? []) clearTimeout(timer);
  for (const item of listItems(ownerId)) if (item.chat.channel === "demo") closeItem(item.id);
  deleteDemoData(ownerId);

  replaceKnowledge(ownerId, KNOWLEDGE);
  if (!isModeOn(ownerId)) setModeSince(ownerId, Date.now());
  void notifyOwner(ownerId, { kind: "demo_started" });
  changed(ownerId);

  running.set(
    ownerId,
    SCRIPT.map(([at, name, text]) =>
      setTimeout(() => {
        receiveMessage(ownerId, demoChat(name), name, { externalId: messageId++, text, at: Date.now() });
      }, at * 1000),
    ),
  );
}
