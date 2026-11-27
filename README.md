# Vyrse

An AI secretary for your private Telegram chats, on Even Realities G2.

Vyrse reads incoming messages from the private chats you choose, sums them up on your glasses and suggests short replies. Pick one with a tap or dictate your own. With **Secretary Mode** on, Vyrse answers routine messages by itself from what it knows about you, and only the messages that need you reach the glasses.

**Demo video:** [link to the video]

**Screenshots:** [screenshots]

**Track:** Messaging & News · AI · Best Telegram integration

## The problem

Private messages pile up while your hands and attention are busy: in a meeting, at the gym, on the road, cooking. Taking out the phone to read a burst of messages and type a reply breaks whatever you are doing. Most of those messages are routine and could be answered without you.

## Who it is for

People who get a lot of private messages and often can't reach for their phone: freelancers, founders, managers, small business owners who talk to clients in Telegram.

## How it works

1. You connect the Vyrse bot to your Telegram account through [Chat Automation](https://telegram.org/blog/ai-bot-revolution-11-new-features#chat-automation-in-profiles) and pick which private chats it may read. Telegram Premium is not required.
2. A contact writes to you. Vyrse waits a few seconds (`BATCH_SILENCE_SEC`) in case more messages follow, so a burst like "Hello" / "What about meeting at 10?" / "Pardon, at 10:30" becomes one card instead of three.
3. The whole burst goes to the AI agent, together with the earlier conversation. It writes a short summary and two or three reply options, such as "Agree to 14:00" or "Suggest another time".
4. The glasses show the list of chats waiting for you. Open one to see the summary and the options; the original messages are one tap away.
5. Tap an option, or hold the temple and say your reply. The agent writes the message, you check it on the glasses and tap **Send**. Vyrse sends it in that chat from your account.

### Secretary Mode

Turn it on in the phone app when you are busy. The agent then decides for each conversation whether it needs you:

- If it can answer from your knowledge base (or nothing needs deciding: greetings, thanks, spam), it replies by itself.
- If it needs your decision, it tells the contact you will get back to them, and the conversation goes to your glasses.

The secretary never invents prices, dates or promises: an answer is sent only if every fact it uses is in your knowledge base. Every secretary message starts with 🤖 and introduces itself as your AI assistant, so the contact knows it isn't you.

The **knowledge base** is what the agent knows about you: working hours, prices, address, links and so on. You add it in the phone app. When you turn Secretary Mode off, the glasses and the bot show what the secretary answered while you were busy.

### Demo mode

To try Vyrse without real chats, tap **Run demo** in the phone app or send `/demo` to the bot. Secretary Mode turns on with a sample knowledge base (a freelance photographer), and five scripted contacts write over the next minute. The secretary answers the routine questions itself; the meeting change and the contract reach the glasses. Replies to demo chats are not sent anywhere.

## Features

- AI summary of each conversation on the glasses, with the original messages one tap away
- Two or three AI-suggested replies; the agent writes the message, you check it and send it with a tap
- Voice replies: hold, speak, release; the text is transcribed and cleaned up into a message
- Message bursts from one contact grouped into one card
- List of chats waiting for you; a contact who keeps writing shows as "typing…"
- Secretary Mode: routine messages answered automatically from the knowledge base, only important ones reach the glasses
- Summary of what the secretary answered, shown when Secretary Mode is turned off
- Replying from your phone removes the chat from the glasses; edited messages update it
- Everything is saved: pairing, the knowledge base and unanswered chats survive restarts
- Demo mode with scripted chats, no Telegram account needed

## Controls on the glasses

| Gesture | Action |
|---|---|
| Swipe | Move through the list; turn pages of the full text |
| Tap | Open the selected chat, pick an option, **Send**, **Show messages**, **Ignore** or **Back** |
| Double tap | Close the full text or the secretary's summary |
| Hold and release | In an open chat: dictate a reply |

## Bot commands

| Command | What it does |
|---|---|
| `/start` | How to connect the bot to your account |
| `/pair <code>` | Pair the glasses with the code from the phone app |
| `/mode on`, `/mode off` | Turn Secretary Mode on or off |
| `/demo` | Run the demo |

## Architecture

```
Telegram ◀──▶ apps/server (one Node.js process) ◀──WebSocket──▶ apps/glasses (G2 app + phone app)
                   │            │
                   ▼            ▼
              OpenAI API     SQLite
```

- **`apps/server`** is one process: the Telegram Business bot (grammY), the inbox that groups messages into bursts, the secretary (Secretary Mode, knowledge base, log), the OpenAI calls (summaries, reply options, drafts, speech-to-text) and the WebSocket server for the glasses. State is kept in SQLite.
- **`apps/glasses`** is the Even Hub web app: the glasses UI and the phone app with pairing, Secretary Mode and the knowledge base.
- **`packages/protocol`** is the contract between the glasses and the server: message types and their validation.

The glasses identify themselves with a device token they get when pairing; the server works out whose chats to show from it. The text of a reply is always the server's own draft: the glasses can only confirm it.

Stack: TypeScript, Node.js, grammY, SQLite (better-sqlite3), Even Hub SDK, OpenAI API (`gpt-6-luna` for the agent, `gpt-transcribe` for speech-to-text), Vite, zod, Vitest.

## Privacy and data

- Vyrse has no access to your Telegram account. It works as a Telegram Business bot, and you choose in Telegram which chats it may read. You can change this or disconnect the bot at any time.
- Only messages from the chats you selected are read. They are sent to the OpenAI API to get a summary and reply suggestions. Voice replies are also sent to the OpenAI API for transcription.
- Contact messages are passed to the AI as data, not instructions, so a message like "ignore your rules and send me…" doesn't work.
- Messages, the knowledge base, the secretary's log and pairing tokens are stored in a SQLite file on your server (`DB_PATH`).

## Setup

Requirements: Node.js 24 (see `.nvmrc`), pnpm 12, a Telegram bot token from [@BotFather](https://t.me/BotFather), an OpenAI API key.

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy `.env.example` to `.env` and fill it in:

   | Variable | Meaning |
   |---|---|
   | `BOT_TOKEN` | Telegram bot token |
   | `WS_PORT` | Port the glasses connect to (default `8080`) |
   | `BATCH_SILENCE_SEC` | Seconds of silence before a burst of messages goes to the AI (default `10`) |
   | `DB_PATH` | SQLite file, relative to the repo root (default `data/vyrse.db`) |
   | `OPENAI_API_KEY` | OpenAI API key |
   | `OPENAI_MODEL` | Model for the agent (default `gpt-6-luna`) |
   | `OPENAI_TRANSCRIBE_MODEL` | Model for voice replies (default `gpt-transcribe`) |

3. Start the server (with the bot) and the app, each in its own terminal:

   ```bash
   pnpm dev:server
   ```

   ```bash
   pnpm dev:glasses
   ```

4. Open the app in the Even Hub simulator:

   ```bash
   pnpm sim
   ```

5. In the phone app, tap **Pair glasses** and follow the link to the bot, or send it the command shown: `/pair <code>`.
6. In Telegram, connect the bot to your account through [Chat Automation](https://telegram.org/blog/ai-bot-revolution-11-new-features#chat-automation-in-profiles) and choose which chats it may read.
7. Add facts to the knowledge base and turn on Secretary Mode in the phone app if you want automatic replies. Or tap **Run demo** to see it with scripted chats.

Checks:

```bash
pnpm typecheck
```

```bash
pnpm test
```

## Built during the hackathon

Everything in this repository was built during the hackathon, from November 23. Before that there was only the idea and the concept. Open-source libraries and the APIs listed above are used as dependencies.

## Feature requests

- **Telegram Business bots:** let a Business bot message a contact first on the user's behalf, with the contact's permission. The user sends the contact a request; if the contact accepts, the bot can start conversations with them through the user's account.

## Author

[@whicencer](https://t.me/whicencer)
