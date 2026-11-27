import { describe, expect, it } from "vitest";
import { contextOf } from "./history";
import type { Message } from "./types";

let id = 0;
const msg = (author: Message["author"], text: string, itemId: string | null = null): Message => ({ id: ++id, author, text, itemId });

describe("contextOf", () => {
  it("splits the chat into history, the open item and what still needs an answer", () => {
    const messages = [
      msg("contact", "old question"),
      msg("owner", "old answer"),
      msg("contact", "can we move the shoot?", "i1"),
      msg("secretary", "Alex will get back to you", "i1"),
      msg("contact", "also, where is the studio?", "i1"),
    ];
    const context = contextOf(messages, "i1");
    expect(context.history.map((t) => t.text)).toEqual(["old question", "old answer"]);
    expect(context.open.map((t) => t.from)).toEqual(["contact", "assistant", "contact"]);
    expect(context.toAnswer).toEqual(["also, where is the studio?"]);
  });

  it("answers the whole burst when nobody has replied yet", () => {
    const messages = [msg("contact", "hey", "i2"), msg("contact", "you there?", "i2")];
    expect(contextOf(messages, "i2").toAnswer).toEqual(["hey", "you there?"]);
  });
});
