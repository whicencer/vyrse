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
3. The whole burst goes to the AI agent. It writes a short summary and two or three reply options.
4. The glasses show the summary, the reply options and how many chats are waiting. You can open the original messages.
5. You tap an option to send it, or hold to dictate your own reply. Vyrse sends it in that chat from your account.

### Secretary Mode

Turn it on in the phone app when you are busy. The agent then decides for each conversation whether it needs you:

- If it can answer from your knowledge base, it replies by itself.
- If it needs your decision, the conversation goes to your glasses.

The **knowledge base** is what the agent knows about you: working hours, prices, address, links and so on. You add it in the phone app. When you turn Secretary Mode off, the glasses show what the secretary answered while you were busy.

## Features

- AI summary of each conversation on the glasses, with the original messages one tap away
- Two or three AI-suggested replies, sent with one tap
- Voice replies: hold, speak, release; the text is transcribed and cleaned up before sending
- Message bursts from one contact grouped into one card
- One card at a time, with a counter of chats waiting
- Secretary Mode: routine messages answered automatically from the knowledge base, only important ones reach the glasses
- Summary of what the secretary answered, shown when Secretary Mode is turned off
- Replying from your phone removes the card from the glasses; edited messages update the card

## Controls on the glasses

| Gesture | Action |
|---|---|
| Swipe | Scroll through reply options |
| Tap | Send the selected reply, go to the next chat |
| Double tap | Skip, go to the next chat |
| Long press | Reply by voice |

## Architecture

```
Telegram ──▶ bot/ (grammY, Business bot) ──▶ server/ (WebSocket, queue, AI agent) ◀──▶ app/ (G2 app + phone app)
                                                        │
                                                        ▼
                                                   OpenAI API
```

- **`bot/`** receives `business_message` updates from the chats you allowed and sends replies on your behalf through the Business connection.
- **`server/`** groups messages into bursts, keeps a queue per owner, calls OpenAI for summaries, reply options and Secretary Mode decisions, and transcribes voice replies.
- **`app/`** is the Even Hub web app: the glasses UI and the phone app with pairing, Secretary Mode and the knowledge base.

Stack: TypeScript, Node.js, grammY, Even Hub SDK, OpenAI API (`gpt-6-luna` for the agent, `gpt-transcribe` for speech-to-text), Vite.

## Privacy and data

- Vyrse has no access to your Telegram account. It works as a Telegram Business bot, and you choose in Telegram which chats it may read. You can change this or disconnect the bot at any time.
- Only incoming messages from the chats you selected are read. They are sent to the OpenAI API to get a summary and reply suggestions. Voice replies are also sent to the OpenAI API for transcription.
- In this prototype, data is kept in memory on the server. A production version will move it to a proper database.

## Setup

Requirements: Node.js 22, pnpm 12, a Telegram bot token from [@BotFather](https://t.me/BotFather), an OpenAI API key.

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy `.env.example` to `.env` and fill it in:

   | Variable | Meaning |
   |---|---|
   | `BOT_TOKEN` | Telegram bot token |
   | `WS_PORT` | Server port (default `8080`) |
   | `WS_URL` | Server address for the bot (default `ws://localhost:8080`) |
   | `WS_CONNECTION_SECRET` | Shared secret for connections to the server |
   | `BATCH_SILENCE_SEC` | Seconds of silence before a burst of messages goes to the AI (default `10`) |
   | `OPENAI_API_KEY` | OpenAI API key |
   | `OPENAI_MODEL` | Model for the agent (default `gpt-6-luna`) |
   | `OPENAI_TRANSCRIBE_MODEL` | Model for voice replies (default `gpt-transcribe`) |

3. Start the server, the bot and the app (each in its own terminal):

   ```bash
   pnpm dev:server
   ```

   ```bash
   pnpm dev:bot
   ```

   ```bash
   pnpm dev:glasses
   ```

4. Open the app in the Even Hub simulator:

   ```bash
   pnpm sim
   ```

5. In the phone app, tap **Pair glasses**, copy the code and send it to your bot: `/pair <code>`.
6. In Telegram, connect the bot to your account through [Chat Automation](https://telegram.org/blog/ai-bot-revolution-11-new-features#chat-automation-in-profiles) and choose which chats it may read.
7. Add facts to the knowledge base and turn on Secretary Mode in the phone app if you want automatic replies.

## Built during the hackathon

Everything in this repository was built during the hackathon, from November 23. Before that there was only the idea and the concept. Open-source libraries and the APIs listed above are used as dependencies.

## Feature requests

- **Telegram Business bots:** let a Business bot message a contact first on the user's behalf, with the contact's permission. The user sends the contact a request; if the contact accepts, the bot can start conversations with them through the user's account.

## Author

[@whicencer](https://t.me/whicencer)
