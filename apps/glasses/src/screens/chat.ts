import { ListItemContainerProperty } from '@evenrealities/even_hub_sdk'
import type { ItemView } from '@vyrse/protocol'
import { BRIGHTNESS } from '../config'
import type { Display } from '../display'
import { actions, body, counter, name } from '../layout/containers'
import { fitItem, fitMessages } from '../layout/fit'
import { LABELS } from '../layout/labels'
import { BODY_MAX_WIDTH, CARD_Y, DRAFT_LINES, NAME_MAX_WIDTH, SUMMARY_LINES, cardHeight, listHeight } from '../layout/sizes'
import { fitLines, textWidth } from '../layout/text'
import type { Entry } from './types'

// An open chat: the AI's summary and options, or the draft being prepared.

type ChatScreen = { title: string; lines: number; text: string; dim: boolean; entries: Entry[] }

export function chatScreen(item: ItemView): ChatScreen {
  const back: Entry = { label: LABELS.back, tap: { type: 'open', itemId: null } }
  const show: Entry = { label: LABELS.show, tap: { type: 'show' } }
  const ignore: Entry = { label: LABELS.ignore, tap: { type: 'dismiss', itemId: item.id } }

  if (item.draft) {
    const discard: Entry = { label: LABELS.back, tap: { type: 'discard', itemId: item.id } }
    const send: Entry = { label: LABELS.send, tap: { type: 'send', itemId: item.id } }
    const d = item.draft
    return {
      title: fitLines(`Reply to ${item.name}`, 1, NAME_MAX_WIDTH).text,
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
      entries: d.status === 'ready' ? [send, discard] : [discard],
    }
  }

  // Cut the name, never the message count.
  const n = item.messages.length
  const suffix = n > 1 ? ` · ${n} messages` : ''
  const title = fitLines(item.name, 1, NAME_MAX_WIDTH - textWidth(suffix)).text + suffix
  const a = item.analysis

  if (item.collecting) return { title, lines: SUMMARY_LINES, text: `${item.name} is typing…`, dim: true, entries: [show, ignore, back] }
  if (a.status === 'thinking') return { title, lines: SUMMARY_LINES, text: 'Reading the messages…', dim: true, entries: [show, ignore, back] }
  if (a.status === 'failed') return { title, lines: SUMMARY_LINES, text: fitMessages(item.messages, SUMMARY_LINES), dim: false, entries: [show, ignore, back] }

  const options: Entry[] = a.options.map((label, option) => ({
    label: fitItem(label),
    tap: { type: 'choose', itemId: item.id, option },
  }))
  return { title, lines: SUMMARY_LINES, text: fitLines(a.summary, SUMMARY_LINES, BODY_MAX_WIDTH).text, dim: false, entries: [...options, show, ignore, back] }
}

export async function drawChat(display: Display, item: ItemView): Promise<Entry[]> {
  const screen = chatScreen(item)

  name.content = screen.title
  name.textColor = BRIGHTNESS.bright
  counter.content = item.draft ? '' : LABELS.holdHint
  counter.textColor = BRIGHTNESS.dim
  body.height = cardHeight(screen.lines)
  body.content = screen.text
  body.textColor = screen.dim ? BRIGHTNESS.mid : BRIGHTNESS.bright
  body.isEventCapture = 0 // the list catches events

  actions.yPosition = CARD_Y + body.height + 4
  actions.height = listHeight(screen.entries.length, actions.yPosition)
  actions.itemContainer = new ListItemContainerProperty({
    itemCount: screen.entries.length,
    itemName: screen.entries.map((e) => e.label),
    isItemSelectBorderEn: 1,
  })
  await display.render([name, counter, body], [actions])
  return screen.entries
}
