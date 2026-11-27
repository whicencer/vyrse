import type { ClientMessage, DigestEntry, ItemView, ModeView } from '@vyrse/protocol'
import type { Display } from './display'
import { chatLabel, drawEmpty, drawList, listedItems } from './screens/list'
import { chatScreen, drawChat } from './screens/chat'
import { digestPages, drawFullText, messagePages } from './screens/fullText'
import { drawRecording, recordingText, updateRecording } from './screens/recording'
import { drawSent } from './screens/sent'
import type { Entry } from './screens/types'

// What the glasses show and how taps, swipes and holds move between screens.
//
// Data comes from the server (items, mode). Navigation is local: which chat is open, whether
// its full text or the digest is on screen, and the voice recording in progress.

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function createGlassesUi(display: Display) {
  // From the server.
  let items: ItemView[] = []
  let mode: ModeView = null
  // Local navigation.
  let openId: string | null = null
  let reading: { page: number } | null = null
  let digest: { entries: DigestEntry[]; page: number } | null = null
  let recording: { itemId: string; startedAt: number } | null = null

  // Redraw only when this changes, so background updates don't reset the list selection.
  let drawnKey: string | null = null
  // Entries of the list on screen, so a tap maps to what it showed.
  let entries: Entry[] = []

  const openItem = () => items.find((i) => i.id === openId) ?? null

  const draw = async (force = false) => {
    const item = openItem()
    // The open chat was answered or closed (maybe from the phone): back to the list.
    if (!item) {
      openId = null
      reading = null
    }

    let key: string
    if (digest) {
      const pages = digestPages(digest.entries)
      digest.page = Math.min(digest.page, pages.length - 1)
      key = `digest:${digest.page}:${pages.join('|')}`
      if (key === drawnKey && !force) return
      drawnKey = key
      entries = []
      return drawFullText(display, 'Answered for you', pages, digest.page)
    }
    if (item && recording?.itemId === item.id) {
      const text = recordingText(recording.startedAt)
      if (drawnKey === `rec:${item.id}` && !force) return updateRecording(display, text)
      drawnKey = `rec:${item.id}`
      entries = []
      return drawRecording(display, item, text)
    }
    if (item && reading) {
      const pages = messagePages(item.messages)
      reading.page = Math.min(reading.page, pages.length - 1)
      key = `read:${item.id}:${reading.page}:${pages.join('|')}`
      if (key === drawnKey && !force) return
      drawnKey = key
      entries = []
      return drawFullText(display, item.name, pages, reading.page)
    }

    if (item) {
      const screen = chatScreen(item)
      key = `chat:${item.id}:${screen.title}:${screen.text}:${screen.entries.map((e) => e.label).join('|')}`
    } else if (items.length) {
      key = `list:${!!mode}:${listedItems(items).map(chatLabel).join('|')}`
    } else {
      key = `empty:${!!mode}`
    }
    if (key === drawnKey && !force) return
    drawnKey = key
    if (item) entries = await drawChat(display, item)
    else entries = items.length ? await drawList(display, items, mode) : await drawEmpty(display, mode)
  }

  const redraw = (force = false) => display.update(() => draw(force))

  return {
    render: () => redraw(true),

    // New state from the server.
    setState: (nextItems: ItemView[], nextMode: ModeView) => {
      items = nextItems
      mode = nextMode
      return redraw()
    },

    // Secretary mode was turned off: show what the secretary did.
    showDigest: (digestEntries: DigestEntry[]) => {
      digest = { entries: digestEntries, page: 0 }
      return redraw()
    },

    // Tap on a list item. Returns what to send to the server, if anything.
    tap: (containerName: string, index: number): ClientMessage | null => {
      if (containerName !== 'chats' && containerName !== 'actions') return null
      const tap = entries[index]?.tap
      if (!tap) return null
      if (tap.type === 'open') {
        openId = tap.itemId
        reading = null
        redraw()
        return null
      }
      if (tap.type === 'show') {
        reading = { page: 0 }
        redraw()
        return null
      }
      return tap
    },

    // Swipe on the full text: next or previous page.
    scroll: (direction: 'up' | 'down') => {
      const step = direction === 'down' ? 1 : -1
      if (digest) digest.page = Math.max(0, digest.page + step)
      else if (reading) reading.page = Math.max(0, reading.page + step)
      else return
      redraw()
    },

    // Double tap: from the full text back to where it was opened.
    doubleTap: () => {
      if (digest) digest = null
      else if (reading) reading = null
      else return
      redraw()
    },

    // Voice reply: only from an open chat's options screen. Returns the chat it's for.
    startRecording: (): string | null => {
      const item = openItem()
      // A failed voice reply can be retried right away by holding again.
      const draftBlocks = item?.draft && !(item.draft.status === 'failed' && item.draft.voice)
      if (!item || draftBlocks || reading || digest || recording) return null
      recording = { itemId: item.id, startedAt: Date.now() }
      redraw()
      return item.id
    },

    // Called every second while recording, to update the timer.
    tickRecording: () => {
      if (recording) redraw()
    },

    // Released: back to the chat; the server answers with the draft ("Writing…").
    stopRecording: () => {
      if (!recording) return
      recording = null
      redraw(true)
    },

    // Brief confirmation, then whatever the state says now.
    sent: (ok: boolean) =>
      display.update(async () => {
        await drawSent(display, ok)
        await sleep(1000)
        await draw(true)
      }),
  }
}
