// What the inbox works with.

export type Channel = "telegram" | "demo";

// Address of one private chat. Demo chats are not in Telegram: replies to them go nowhere.
export type ChatRef = { channel: Channel; connectionId: string; chatId: number };

export type Author = "contact" | "owner" | "secretary";

// One message of a conversation, as stored.
export type Message = {
  id: number;
  author: Author;
  text: string;
  // The open item this message belongs to; null once that item is closed.
  itemId: string | null;
};

// An item goes collecting → thinking → needs_owner (on the glasses) or auto_replying
// (the secretary answers itself). When it's answered or dismissed it's deleted.
export type ItemStatus = "collecting" | "thinking" | "needs_owner" | "auto_replying";

export type Analysis = { summary: string; options: string[] };

export type Draft =
  | { status: "writing"; intent: string }
  | { status: "ready"; intent: string; text: string }
  | { status: "failed"; intent: string; voice: boolean };

// A burst of messages from one contact that hasn't been answered yet. At most one per chat.
export type Item = {
  id: string;
  ownerId: number;
  chat: ChatRef;
  contactName: string;
  status: ItemStatus;
  // Bumped on every new message: an AI answer that started before it is out of date.
  revision: number;
  // null: not analyzed yet; "failed": the AI couldn't read it.
  analysis: Analysis | "failed" | null;
  draft: Draft | null;
  // Has been on the glasses: then it stays there, even while the contact writes again.
  shown: boolean;
  // The secretary already told the contact the owner will get back (once per item).
  holdSent: boolean;
  // What the contact asked, while the secretary's own answer is being sent (for its log).
  autoAsked: string | null;
  openedAt: number;
};
