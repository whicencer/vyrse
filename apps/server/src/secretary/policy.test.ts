import { describe, expect, it } from "vitest";
import type { AnalyzeResult } from "../ai/analyze";
import { decide } from "./policy";

const analysis = (patch: Partial<AnalyzeResult>): AnalyzeResult => ({
  summary: "Sarah asks the price",
  options: ["Tell the price"],
  decision: "answered",
  reply: "A portrait shoot is $150.",
  facts: [0],
  ...patch,
});

describe("decide", () => {
  it("answers by itself in secretary mode when the facts are in the knowledge base", () => {
    expect(decide({ analysis: analysis({}), modeOn: true, knowledgeCount: 1, holdSent: false })).toEqual({
      kind: "answer",
      text: "🤖 A portrait shoot is $150.",
    });
  });

  it("never sends anything when secretary mode is off", () => {
    expect(decide({ analysis: analysis({}), modeOn: false, knowledgeCount: 1, holdSent: false })).toEqual({ kind: "owner", hold: null });
  });

  it("stays silent when the reply cites a fact that isn't in the knowledge base", () => {
    expect(decide({ analysis: analysis({ facts: [3] }), modeOn: true, knowledgeCount: 1, holdSent: false })).toEqual({ kind: "owner", hold: null });
  });

  it("tells the contact the owner will get back, only once", () => {
    const needsOwner = analysis({ decision: "needs_owner", reply: "Alex will get back to you.", facts: [] });
    expect(decide({ analysis: needsOwner, modeOn: true, knowledgeCount: 0, holdSent: false })).toEqual({
      kind: "owner",
      hold: "🤖 Alex will get back to you.",
    });
    expect(decide({ analysis: needsOwner, modeOn: true, knowledgeCount: 0, holdSent: true })).toEqual({ kind: "owner", hold: null });
  });
});
