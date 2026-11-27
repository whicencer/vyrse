import { ListItemContainerProperty } from '@evenrealities/even_hub_sdk'
import { BRIGHTNESS, CANVAS } from '../config'
import { listContainer, textContainer, type Display } from '../display'
import { fitLines, textWidth, wrap } from '../text'
import type { Card, ChatSummary, Digest, ModeState } from '../../../server/types'

const LINE_HEIGHT = 27 // measured in the simulator
const PADDING = 4
const HEADER_Y = 4
const HEADER_HEIGHT = 36

const CARD_Y = HEADER_Y + HEADER_HEIGHT
const CARD_PADDING = 10
const CARD_BORDER = 1
// Lines in the card: the summary on the chat screen, the message on the draft screen.
// Both are sized so the list under them shows at least two items without scrolling.
const SUMMARY_LINES = 3
const DRAFT_LINES = 4
const cardHeight = (lines: number) => lines * LINE_HEIGHT + 2 * (CARD_PADDING + CARD_BORDER)

// The firmware centers list items vertically, so lists are sized to their items.
const LIST_ITEM_HEIGHT = 40 // measured in the simulator
// Whole items only: a list taller than its items shows half an item at the bottom.
const listHeight = (items: number, top: number) => {
  const fit = Math.floor((CANVAS.height - top - 2 * PADDING) / LIST_ITEM_HEIGHT)
  return Math.min(items, fit) * LIST_ITEM_HEIGHT + 2 * PADDING
}

// Containers can't align text right, so the counter sits at a fixed spot
// sized for the longest value it shows.
// Top-right label: the voice hint on a chat, the mode on the chat list.
const HOLD_HINT = 'Hold to reply'
// Measured widths run a little short here, so leave a margin or the hint wraps.
const COUNTER_WIDTH = Math.max(textWidth(HOLD_HINT), textWidth('Secretary')) + 2 * PADDING + 16
const counter = textContainer({
  containerID: 2,
  containerName: 'counter',
  xPosition: CANVAS.width - COUNTER_WIDTH,
  yPosition: HEADER_Y,
  width: COUNTER_WIDTH,
  height: HEADER_HEIGHT,
})

const name = textContainer({
  containerID: 1,
  containerName: 'name',
  yPosition: HEADER_Y,
  width: CANVAS.width - COUNTER_WIDTH,
  height: HEADER_HEIGHT,
})

const body = textContainer({
  containerID: 3,
  containerName: 'body',
  yPosition: CARD_Y,
  width: CANVAS.width,
  height: cardHeight(SUMMARY_LINES),
  paddingLength: CARD_PADDING,
  borderWidth: CARD_BORDER,
  borderColor: 6,
  borderRadius: 10,
  // The SDK expects exactly one container per page to capture events.
  isEventCapture: 0,
})

// Only for the short "Sent" confirmation.
const hint = textContainer({
  containerID: 4,
  containerName: 'hint',
  yPosition: CANVAS.height / 2 - HEADER_HEIGHT / 2,
  width: CANVAS.width,
  height: HEADER_HEIGHT,
})

const actions = listContainer({
  containerID: 5,
  containerName: 'actions',
  width: CANVAS.width,
})

const chatList = listContainer({
  // Not 2: the counter (mode label) is on the same page.
  containerID: 6,
  containerName: 'chats',
  yPosition: CARD_Y,
  width: CANVAS.width,
})

const BACK = 'Back'
const SEND = 'Send'
const SHOW = 'Show messages'
// Header label while secretary mode is on.
const SECRETARY = 'Secretary'
const IGNORE = 'Ignore'

// Full text screen: header + one page of text that fills the rest of the display.
const BACK_HINT = 'Double tap: back'
const BACK_HINT_WIDTH = textWidth(BACK_HINT) + 2 * PADDING
const backHint = textContainer({
  containerID: 2,
  containerName: 'back-hint',
  xPosition: CANVAS.width - BACK_HINT_WIDTH,
  yPosition: HEADER_Y,
  width: BACK_HINT_WIDTH,
  height: HEADER_HEIGHT,
})
const fullText = textContainer({
  containerID: 3,
  containerName: 'full-text',
  yPosition: CARD_Y,
  width: CANVAS.width,
  height: CANVAS.height - CARD_Y,
  // Catches swipes (pages) and the double tap (back).
  isEventCapture: 1,
})
const PAGE_LINES = Math.floor((CANVAS.height - CARD_Y - 2 * PADDING) / LINE_HEIGHT)
const PAGE_WIDTH = CANVAS.width - 2 * PADDING - 10
// The firmware caps a text container at 999 bytes.
const PAGE_MAX_BYTES = 999
// Keeps the list short enough to scroll through on the glasses.
const MAX_CHATS = 20

const NAME_MAX_WIDTH = CANVAS.width - COUNTER_WIDTH - 2 * PADDING
const BODY_MAX_WIDTH = CANVAS.width - 2 * (CARD_PADDING + CARD_BORDER)

// As many of the latest messages as fit. Used when the agent couldn't read the chat.
function fitMessages(messages: string[], lines: number) {
  let text = ''
  for (let k = 1; k <= messages.length; k++) {
    const fitted = fitLines(messages.slice(-k).join('\n'), lines, BODY_MAX_WIDTH)
    if (fitted.cut) break
    text = fitted.text
  }
  return text || fitLines(messages[messages.length - 1], lines, BODY_MAX_WIDTH).text
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const MAX_ITEM_BYTES = 63
const encoder = new TextEncoder()
const utf8Length = (s: string) => encoder.encode(s).length
// Leave room for the list's own padding and selection border.
const ITEM_MAX_WIDTH = BODY_MAX_WIDTH - 20

function chatLabel(c: ChatSummary) {
  const head = `${fitLines(c.name, 1, ITEM_MAX_WIDTH / 2).text}${c.count > 1 ? ` (${c.count})` : ''}: `
  let preview = c.collecting ? 'typing…' : c.preview.replace(/\s+/g, ' ')
  preview = fitLines(preview, 1, ITEM_MAX_WIDTH - textWidth(head)).text
  while (utf8Length(head + preview) > MAX_ITEM_BYTES) preview = [...preview].slice(0, -2).join('') + '…'
  return head + preview
}

// One list item: one line and at most 63 bytes.
function fitItem(text: string) {
  let item = fitLines(text.replace(/\s+/g, ' '), 1, ITEM_MAX_WIDTH).text
  while (utf8Length(item) > MAX_ITEM_BYTES) item = [...item].slice(0, -2).join('') + '…'
  return item
}

// What a tap on a list item means.
export type Action =
  | { type: 'open'; batchId: string | null }
  | { type: 'choose'; batchId: string; option: number }
  | { type: 'send'; batchId: string }
  | { type: 'discard'; batchId: string }
  | { type: 'dismiss'; batchId: string }

// 'show' is handled on the glasses: it only switches to the full text.
type Item = { label: string; action: Action | 'show' }

// Splits all messages into pages that fit the full text screen.
function paginate(messages: string[]) {
  const lines = messages.flatMap((m) => wrap(m.trim(), PAGE_WIDTH))
  const pages: string[] = []
  let page: string[] = []
  for (const line of lines) {
    const next = [...page, line]
    if (page.length && (next.length > PAGE_LINES || utf8Length(next.join('\n')) > PAGE_MAX_BYTES)) {
      pages.push(page.join('\n'))
      page = [line]
    } else page = next
  }
  pages.push(page.join('\n'))
  return pages
}

export function createMessageScreen(display: Display) {
  // Latest state from the server. card = the chat the user opened, null = chat list.
  let card: Card | null = null
  let chats: ChatSummary[] = []
  // Redraw only when this changes, so background updates don't reset the selection.
  let drawnKey: string | null = null
  // Items of the list on screen, so a tap maps to what it showed.
  let shownItems: Item[] = []
  // Full text of the opened chat is on screen (local to the glasses), and which page.
  let reading: { batchId: string; page: number } | null = null
  let mode: ModeState | null = null
  // What the secretary answered in the mode that just ended, and which page.
  let digest: { data: Digest; page: number } | null = null
  // Voice reply being recorded for this chat (held temple).
  let recording: { batchId: string; startedAt: number } | null = null

  const listedChats = () => chats.slice(0, MAX_CHATS)

  // What the opened chat shows: the agent's summary and options, or the draft.
  const cardView = (c: Card) => {
    const back: Item = { label: BACK, action: { type: 'open', batchId: null } }
    const show: Item = { label: SHOW, action: 'show' }
    const ignore: Item = { label: IGNORE, action: { type: 'dismiss', batchId: c.batchId } }
    const n = c.messages.length

    if (c.draft) {
      const discard: Item = { label: BACK, action: { type: 'discard', batchId: c.batchId } }
      const d = c.draft
      return {
        title: fitLines(`Reply to ${c.name}`, 1, NAME_MAX_WIDTH).text,
        lines: DRAFT_LINES,
        text:
          d.status === 'ready'
            ? fitLines(d.text, DRAFT_LINES, BODY_MAX_WIDTH).text
            : d.status === 'writing'
              ? `Writing: ${d.intent}…`
              : d.voice
              ? "Couldn't hear you.\nHold the temple and say it again."
              : "Couldn't write the reply. Try again.",
        dim: d.status !== 'ready',
        items: d.status === 'ready' ? [{ label: SEND, action: { type: 'send', batchId: c.batchId } } as Item, discard] : [discard],
      }
    }

    // Cut the name, never the message count.
    const suffix = n > 1 ? ` · ${n} messages` : ''
    const title = fitLines(c.name, 1, NAME_MAX_WIDTH - textWidth(suffix)).text + suffix
    const a = c.agent

    if (c.collecting) return { title, lines: SUMMARY_LINES, text: `${c.name} is typing…`, dim: true, items: [show, ignore, back] }
    if (a.status === 'thinking') return { title, lines: SUMMARY_LINES, text: 'Reading the messages…', dim: true, items: [show, ignore, back] }
    if (a.status === 'failed') return { title, lines: SUMMARY_LINES, text: fitMessages(c.messages, SUMMARY_LINES), dim: false, items: [show, ignore, back] }

    const options: Item[] = a.options.map((label, option) => ({
      label: fitItem(label),
      action: { type: 'choose', batchId: c.batchId, option },
    }))
    return { title, lines: SUMMARY_LINES, text: fitLines(a.summary, SUMMARY_LINES, BODY_MAX_WIDTH).text, dim: false, items: [...options, show, ignore, back] }
  }

  const drawEmpty = async () => {
    shownItems = []
    name.content = 'Vyrse'
    name.textColor = BRIGHTNESS.dim
    counter.content = mode ? SECRETARY : ''
    body.height = cardHeight(SUMMARY_LINES)
    body.content = mode
      ? 'Secretary mode is on.\nMessages that don\'t need you get answered for you; the rest shows up here.'
      : 'No new messages'
    body.textColor = BRIGHTNESS.mid
    body.isEventCapture = 1
    await display.render([name, counter, body], [])
  }

  const drawCard = async (c: Card) => {
    const view = cardView(c)
    shownItems = view.items

    name.content = view.title
    name.textColor = BRIGHTNESS.bright
    counter.content = c.draft ? '' : HOLD_HINT
    counter.textColor = BRIGHTNESS.dim
    body.height = cardHeight(view.lines)
    body.content = view.text
    body.textColor = view.dim ? BRIGHTNESS.mid : BRIGHTNESS.bright
    body.isEventCapture = 0 // the list catches events

    actions.yPosition = CARD_Y + body.height + 4
    actions.height = listHeight(view.items.length, actions.yPosition)
    actions.itemContainer = new ListItemContainerProperty({
      itemCount: view.items.length,
      itemName: view.items.map((i) => i.label),
      isItemSelectBorderEn: 1,
    })
    await display.render([name, counter, body], [actions])
  }

  const recordingText = () =>
    `Recording… ${Math.floor((Date.now() - recording!.startedAt) / 1000)} s\nRelease to send`

  const drawRecording = async (c: Card, text: string) => {
    shownItems = []
    name.content = fitLines(`Reply to ${c.name}`, 1, NAME_MAX_WIDTH).text
    name.textColor = BRIGHTNESS.bright
    counter.content = ''
    body.height = cardHeight(2)
    body.content = text
    body.textColor = BRIGHTNESS.bright
    body.isEventCapture = 1
    await display.render([name, counter, body], [])
  }

  const drawFullText = async (title: string, pages: string[], page: number) => {
    shownItems = []
    const position = pages.length > 1 ? ` · ${page + 1}/${pages.length}` : ''
    name.content = fitLines(title, 1, CANVAS.width - BACK_HINT_WIDTH - 2 * PADDING - textWidth(position)).text + position
    name.textColor = BRIGHTNESS.bright
    backHint.content = BACK_HINT
    backHint.textColor = BRIGHTNESS.dim
    fullText.content = pages[page]
    fullText.textColor = BRIGHTNESS.bright
    await display.render([name, backHint, fullText], [])
  }

  const digestLog = (d: Digest) =>
    // The summary usually starts with the name already ("Sarah asks…").
    paginate(d.log.flatMap((h) => [h.asked.startsWith(h.name) ? h.asked : `${h.name}: ${h.asked}`, `→ ${h.reply}`]))

  const drawChats = async () => {
    const listed = listedChats()
    shownItems = listed.map((c) => ({ label: chatLabel(c), action: { type: 'open', batchId: c.batchId } }))

    name.content = `Chats · ${chats.length}`
    name.textColor = BRIGHTNESS.bright
    // The mode, if one is on, sits where the counter goes.
    counter.content = mode ? SECRETARY : ''
    chatList.height = listHeight(shownItems.length, CARD_Y)
    chatList.itemContainer = new ListItemContainerProperty({
      itemCount: shownItems.length,
      itemName: shownItems.map((i) => i.label),
      isItemSelectBorderEn: 1,
    })
    await display.render([name, counter], [chatList])
  }

  const draw = async (force = false) => {
    // Reading stops when the chat is closed, answered or another one is opened.
    if (reading && reading.batchId !== card?.batchId) reading = null

    let key: string
    if (digest) {
      const pages = digestLog(digest.data)
      digest.page = Math.min(digest.page, pages.length - 1)
      key = `digest:${digest.page}:${pages.join('|')}`
      if (key === drawnKey && !force) return
      drawnKey = key
      return drawFullText('Answered for you', pages, digest.page)
    }
    if (card && recording?.batchId === card.batchId) {
      const text = recordingText()
      // Only the seconds change while recording: update the text instead of rebuilding the page.
      if (drawnKey === `rec:${card.batchId}` && !force) return display.setText(body, text)
      drawnKey = `rec:${card.batchId}`
      return drawRecording(card, text)
    }
    if (card && reading) {
      const pages = paginate(card.messages)
      reading.page = Math.min(reading.page, pages.length - 1)
      key = `read:${card.batchId}:${reading.page}:${pages.join('|')}`
      if (key === drawnKey && !force) return
      drawnKey = key
      return drawFullText(card.name, pages, reading.page)
    }
    if (card) {
      const v = cardView(card)
      key = `card:${card.batchId}:${v.title}:${v.text}:${v.items.map((i) => i.label).join('|')}`
    } else if (chats.length) {
      key = `chats:${!!mode}:${listedChats().map(chatLabel).join('|')}`
    } else {
      key = `empty:${!!mode}`
    }

    if (key === drawnKey && !force) return
    drawnKey = key
    if (card) return drawCard(card)
    return chats.length ? drawChats() : drawEmpty()
  }

  return {
    render: () => display.update(() => draw(true)),

    setQueue: (next: Card | null, nextChats: ChatSummary[], nextMode: ModeState | null) => {
      card = next
      chats = nextChats
      mode = nextMode
      return display.update(() => draw())
    },

    // A mode ended: show what the secretary did.
    showDigest: (d: Digest) => {
      digest = { data: d, page: 0 }
      return display.update(() => draw())
    },

    // Tap on a list item. Returns what to send to the server; it answers with the new state.
    click: (containerName: string, index: number): Action | null => {
      if (containerName !== 'chats' && containerName !== 'actions') return null
      const action = shownItems[index]?.action
      if (action === 'show') {
        if (card) reading = { batchId: card.batchId, page: 0 }
        display.update(() => draw())
        return null
      }
      return action ?? null
    },

    // Swipe on the full text: next or previous page.
    scroll: (direction: 'up' | 'down') => {
      const step = direction === 'down' ? 1 : -1
      if (digest) digest.page = Math.max(0, digest.page + step)
      else if (reading) reading.page = Math.max(0, reading.page + step)
      else return
      display.update(() => draw())
    },

    // Voice reply: only from an open chat's options screen. Returns the chat it's for.
    startRecording: (): string | null => {
      // A failed voice reply can be retried right away by holding again.
      const draftBlocks = card?.draft && !(card.draft.status === 'failed' && card.draft.voice)
      if (!card || draftBlocks || reading || digest || recording) return null
      recording = { batchId: card.batchId, startedAt: Date.now() }
      display.update(() => draw())
      return card.batchId
    },

    // Called every second while recording, to update the timer.
    tickRecording: () => {
      if (recording) display.update(() => draw())
    },

    // Released: back to the chat; the server answers with the draft ("Writing…").
    stopRecording: () => {
      if (!recording) return
      recording = null
      display.update(() => draw(true))
    },

    // Double tap: from the full text back to the options.
    doubleTap: () => {
      if (digest) digest = null
      else if (reading) reading = null
      else return
      display.update(() => draw())
    },

    // Brief confirmation, then whatever the queue says now (the chat list).
    sent: (isSuccess: boolean) =>
      display.update(async () => {
        hint.content = isSuccess ? 'Sent' : 'Not sent, try again'
        hint.textColor = BRIGHTNESS.bright
        await display.render([hint], [])
        await sleep(1000)
        await draw(true)
      }),
  }
}
