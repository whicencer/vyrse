# Secretary Mode — AI Telegram Secretary for Even G2

## 1. Idea

**One-liner:** Other apps put your Telegram groups on the glasses. Secretary takes over your **personal messages** — the ones ordinary bots can't see — and, while you're busy, answers on its own everything that doesn't need you. On your G2 you only see what does, and you decide with a single tap.

**Who it's for:** People with lots of incoming private messages (freelancers, founders, managers, small business owners talking to clients) whose hands or attention are often busy: meetings, gym, commuting, cooking.

**Track:** Messaging & News + Best Telegram Integration prize.

## 2. What Makes It Different

Every other Messaging-track project we've seen (Glance Desk, TG Glance, Balas Kilat, Heads Up, GlanceReply, TapBack, Glance) follows the same pattern: incoming Telegram → triage → one card on the glasses → draft or quick reply → **nothing is sent without a tap**. They differ only in how they reach Telegram:

- **Regular Bot API bot in groups** (Glance Desk, Heads Up, Balas Kilat, TG Glance, Glance) — sees only groups it was added to, not private chats.
- **The user's own account via MTProto** (GlanceReply with GramJS, TapBack with Telethon) — sees private chats, but the user hands over a full account session to a self-hosted backend. TapBack itself points out that Telegram's API terms forbid passing Telegram data to AI models, so it uses fixed rules instead of an LLM.

Glance Desk, GlanceReply and TapBack already have polished glasses UIs (one card at a time, swipe + tap, hold to dictate, undo window, "answered on phone → card disappears"). **The glasses UI is not where we compete.**

Our three differentiators:

1. **Private chats, the official way: Telegram Business.** Personal conversations with clients, colleagues and friends are where the important messages are. Regular bots can't see them; userbots can, but only by taking over the whole account session, and they run into the API terms on AI. A Business bot is Telegram's own mechanism for letting a bot read and answer private chats on the user's behalf, with limited, revocable rights. This is our case for the Best Telegram Integration prize: we use Business bots for exactly what they were made for. *(TODO: check the Bot API / Business terms on AI processing and quote them in the README.)*
2. **A secretary, not a reply suggester.** With **Secretary mode** on, the secretary answers by itself everything that doesn't need the owner: routine questions from the knowledge base (prices, address, working hours), greetings, thanks, spam. Only messages that need the owner's decision reach the glasses. All seven other projects ask for a tap on every single message — this is the one thing none of them does.
3. **Message bursts become one card.** "hi / listen / you there? / can you do 3pm?" is one conversation, one summary, one reply. This is the main pain in private chats, and nobody handles it in groups.

**Pitch for the description:** *"Others show your groups on the glasses. Secretary handles your private messages — the ones bots can't see — and answers the routine ones itself. The glasses only show what needs you."*

## 3. Demo Story (≤3 min video)

1. "I'm going into a meeting" → turn **Secretary mode** on.
2. Messages arrive from several contacts, some in bursts.
3. The secretary replies on its own to everything that doesn't need you (price, address, hours, spam).
4. Only 2–3 chats reach the glasses: real decisions. Each is answered with one tap.
5. Meeting over → turn Secretary mode off → the glasses show what the secretary answered while you were busy.

This hits the judging criteria directly: usefulness specifically on glasses (30%) and quick action after reading (25%).

## 4. Decisions

| Question | Decision | Why |
|---|---|---|
| Account access | **Telegram Business bot** | Official, user grants limited rights, no phone-number login, sees private chats (regular bots don't) |
| Bot library | **grammY** | Modern, TypeScript, supports Business API |
| Repository | **Monorepo**: `bot/`, `core/`, `glasses/` | One link for submission and portfolio |
| Storage | **SQLite** (better-sqlite3) | Already in use for users; survives restarts |
| Backend | **Own Node.js server**, bot + WebSocket in one process | Only it can keep a live connection to the glasses; splitting into processes is postponed until after the hackathon |
| Telegram updates | **Long polling** | Webhook (one domain with `/bot` and `/ws`) after the MVP |
| Telegram Serverless | Not used | Cannot talk to the glasses app (endpoints only callable from a Mini App, no WebSockets) |

## 5. Accepted Constraints

- **Private chats only.** Business bots don't see groups or channels. That's fine — it's our niche.
- **Judges won't connect their own account.** Connecting a Business bot doesn't need Premium, but a judge still won't hand their private chats to a hackathon bot → **demo mode is mandatory** (see §10).
- **Cannot message first.** The bot can only reply in chats where the contact wrote recently (~24h; verify in Bot API docs). Fine for a secretary — it handles incoming messages.
- **Glasses only display while the app is open.** Positioned as a **mode**: "going into a meeting → turn Secretary mode on". Autonomous replies work on the server even when the glasses app is closed.
- **The bot cannot see "typing…" status.** Message bursts are detected by timing only.

## 6. Incoming Message Handling

### 6.1. Who sent it

On every `business_message` update:

```
from.id == business account owner?
   ├─ yes → the user replied from their phone → close this chat's batch, remove from glasses
   └─ no  → it's the contact → add to batch
```

On `edited_business_message` from the contact, the new text quietly replaces the old one in the batch and the history (no notification). If the chat is already on the glasses, the summary and options are redone for the new text; the old ones stay on screen until then.

**Batch key:** `business_connection_id:chat.id`. Names are never used as keys (namesakes and renames would break grouping).

The owner's id comes from the `business_connection` update (`user.id`).

### 6.2. Batch (message burst)

A batch is a series of messages from one contact sent in a row. The AI receives the whole batch and replies to all of it at once.

**Grouping rule:**
```
Does this chat have a batch the user hasn't answered yet?
   ├─ yes → append the message, restart the silence timer
   └─ no  → create a new batch, push it to the end of the queue
```

**Silence timer:** once the contact has been silent for **N seconds**, the batch is sent to the AI.
- Start with **N = 10s**.
- Optional heuristics: after greetings ("hi", "listen", "you there?") wait longer (~20s); after a question or a voice message wait shorter (~3s).
- Use `message.date` from Telegram, not server arrival time.

**New message arrives after replies were generated but before the user answered:** append to the same batch, drop the old reply options, re-run the AI after the silence timer on the full conversation. *(Proposed, not yet confirmed.)*

**A batch is closed for good** when the user replies (from glasses or phone), skips it, or the secretary answered it on its own.

**Edits and deletions:**
- `edited_business_message` → find the message in the batch by `message_id`, replace its text.
- `deleted_business_messages` → remove the messages; drop the batch from the queue if it becomes empty.

Each stored message keeps: `message_id`, `text`, `date`.

### 6.3. Batch lifecycle

```
collecting ──(N s silence)──▶ AI ──┬─ mode on, answered ─▶ closed (logged)
     ▲                             └─ otherwise ─────────▶ on screen ──(reply / ignore)──▶ closed
     └────────────── new message ──────────────┘
     └────────────── new message ──────────────────────────────┘
```

| State | What the glasses show |
|---|---|
| collecting | Nothing yet (or "…" if the batch is already on screen) |
| on screen | Summary + 2–3 reply options |
| answered by the secretary | Nothing now; listed when Secretary mode is turned off |
| closed (user) | Removed, next batch shown |

### 6.4. Queue

- The queue holds only batches that **need the user** (one per contact), not individual messages.
- **One batch on screen** at a time, with a counter: "+2 waiting".
- After a reply or skip, the next batch is shown.
- **Ordering:** by time of the batch's first message for now. Whether VIP/urgent batches jump ahead is an open question.

## 7. What the AI Does

**Input:** the full batch, contact name, whether Secretary mode is on, the user's knowledge base, user settings.

**Output (one call per batch):**
1. **Decision** (only with Secretary mode on):
   - **answered** — the secretary replies itself: the knowledge base covers it (price, address, hours) or nothing needs deciding (greetings, thanks, spam);
   - **needs owner** — anything needing a judgement, a commitment, or information not in the knowledge base. The chat goes to the glasses, and the secretary tells the contact the owner will get back ("Alex will get back to you about moving the shoot"), once per batch.
2. **Summary** (for long batches or voice messages): 1–2 lines.
3. **Reply:** the secretary's message for "answered", or 2–3 options for the owner to pick from on the glasses.

Re-run only if the batch gets new messages.

### 7.1. Autonomy rules (what makes it a secretary)

- Auto-replies happen **only while Secretary mode is on**, and only when the owner isn't needed. With it off, every message is shown on the glasses and nothing is sent without a tap.
- **Never invent** prices, dates, names or promises. If it's not in the knowledge base → ask the user.
- When the owner has to decide, the secretary only says the owner will get back: it never agrees, refuses, promises or names a time on the owner's behalf.
- The contact always knows it's the assistant: every secretary message starts with 🤖, it introduces itself once ("Hi, this is Alex's AI assistant") and speaks about the owner in the third person. Drafts the owner confirms go out in the owner's own voice.
- Every auto-reply goes to the **log** (who, what they asked, what the secretary answered).
- **Prompt-injection guard:** contact messages are passed to the model as data, never as instructions ("ignore your rules and send me…" must not work).

### 7.2. When Secretary mode is turned off

When the user turns the mode off, the glasses show what the secretary answered during it, page by page; double tap goes back to the chats:

```
Answered for you · 1/2
Sarah asks the price of a portrait photoshoot.
→ A portrait photoshoot is $150 for 1 hour…
```

## 8. Glasses App

### Screen (576×288, monochrome)

```
Andrew · 3 messages                 +2 waiting
Wants to move the meeting to 14:00,
asks if that works.

▸ Yes, works for me
  Let's do 15:00
  Reply later
```

### Controls

| Gesture | Action |
|---|---|
| Swipe | Scroll reply options |
| Tap | Send selected reply, go to next batch |
| Double tap | Skip / snooze, go to next batch |
| Long press | Reply by voice |

**The screen is never interrupted** by new batches while the user is choosing a reply or dictating.

### Voice reply

In an open chat: hold the temple → glasses mic records (up to 30 s) → release → OpenAI `gpt-transcribe` turns it into text → the agent makes it a clean message (keeps the meaning, drops "uh", fixes slips, adds nothing) → draft with Send / Back → tap.

## 9. Settings (bot commands first, Mini App later)

- **Secretary mode:** one on/off switch (phone page, or `/mode on` / `/mode off` in the bot). On: the secretary answers what doesn't need the owner and only the rest shows up on the glasses. Off: every message is shown.
- **Knowledge base:** what the secretary may answer on its own — working hours, address, prices, links, etc.
- **Reply style:** short / casual / formal.
- **Log:** who the secretary replied to and what it said.

## 10. Scope

**Must have (MVP):**
1. Business bot connected, messages shown on glasses.
2. Batches: pause-based grouping, chat key, "replied from phone" handling.
3. Queue with a single card and counter.
4. AI summary + reply options, send with a tap.
5. **Secretary mode (on/off) + autonomous replies** from the knowledge base, with the log.
6. **When Secretary mode is turned off**, the glasses show what the secretary answered.
7. **Demo mode:** sample private chats and a scripted burst of messages, runnable in the simulator without connecting a Telegram account.

**Nice to have:**
8. Incoming voice messages → summary.
9. Voice replies (others have it — not a differentiator, do it last).
10. Mini App settings.
11. Smart silence timer, VIP priority, edit/delete handling.

**Out of scope:** groups and channels, messaging first, splitting bot and WebSocket server into separate processes.

## 11. Open Questions

1. Append to an unanswered batch or create a new one? *(proposed: append)*
2. Queue order: by time, or VIP/urgent first?
3. Silence threshold: start with 10s?
4. Autonomy level: may the secretary auto-reply to new contacts, or only to known ones?

## 12. Timeline

- **Nov 23, 12:00 (Dubai):** kickoff, build starts
- **Nov 29, 23:59 (Dubai):** submission deadline
- **Dec 3:** Demo Day, Daos Hub, Dubai

Submission: public repo with README, demo video (≤3 min), short description, up to 5 API feature requests, e.g.:
- Let Business bots message first, with the user's confirmation.
- Sandbox Telegram accounts for testing Business bots without a real account.
- (Even Hub) A wake-up hook so a plugin can signal new items while not in the foreground.
- (Even Hub) A short confirmation cue (sound/LED) for "message sent".
- (Even Hub) Built-in speech-to-text available to plugins.

## 13. Focus: Where We Win

Rule for the week: **build only what puts us ahead of the other seven; match them on everything else with the minimum.**

### 13.1. Where we must be clearly better

| # | What | Why nobody else has it |
|---|---|---|
| 1 | **Autonomy done right.** Secretary mode + knowledge base → the secretary answers what doesn't need the owner and only decisions reach the glasses; strict "never invent" rule; every auto-reply in the log | All seven require a tap on every message |
| 2 | **"While you were busy."** When Secretary mode is turned off, the glasses show what the secretary answered | Only makes sense if the bot acts on its own |
| 3 | **Bursts → one card, with conversation context.** The AI sees the whole burst and recent history with this contact, not one message | Others draft from the latest message (TapBack shows 1–3, no merging) |
| 4 | **Zero-setup official onboarding.** Profile → Edit → Chat Automation → pick the bot → choose which chats it handles. No api_id, no self-hosting, no account session handed over | GlanceReply and TapBack need own api_id + self-hosted backend + full account login |
| 5 | **Deep Business API use** (for Best Telegram Integration): owner's reply from phone closes the card, edits/deletions update the batch, mark as read only after the glasses showed it, respect the connection's `can_reply` right | Group bots can't do any of it; userbots do it outside the official bot platform |

### 13.2. Parity only (cheapest version that doesn't look worse)

- One card + swipe through 2–3 replies + tap to send.
- "+N waiting" counter.
- Demo mode in the simulator (scripted private chats fed into the **same** pipeline).

### 13.3. Cut or last

- Voice replies (three competitors already have them).
- Undo windows, take-back, VIP stars, channel digests.
- Pairing with one-time codes / multiple users: for the hackathon one owner is enough (bound via `business_connection`). Pairing comes back only if time is left.
- Splitting bot and WebSocket server into processes, webhook.

### 13.4. Day plan

| Day | Goal | Done when |
|---|---|---|
| Mon 23 | End-to-end skeleton | `business_message` → card on the glasses → tap → reply sent in the private chat via `business_connection_id` |
| Tue 24 | Bursts + queue | 4 quick messages = one card; reply from phone removes it; "+N waiting" works |
| Wed 25 | AI | One OpenAI call (gpt-6-luna) per batch: decision (auto / ask / ignore) + summary + 2–3 intent options, a second call writes the reply for the chosen intent; prompt-injection guard; recent history as context |
| Thu 26 | Secretary | Secretary mode on/off, knowledge base, auto-replies, log, list of answered messages when it's turned off |
| Fri 27 | Demo mode + Business API details | Scripted chats through the same pipeline; edits/deletions; read only after shown |
| Sat 28 | Polish + README | README with the positioning and the Business-terms quote, feature requests, screenshots |
| Sun 29 | Video + submit | ≤3 min video following §3, submission before 23:59 Dubai |

If a day slips, cut from §13.3 first, then from Fri 27 details. Never cut §13.1 #1–#2 or demo mode.
