import { ListItemContainerProperty } from '@evenrealities/even_hub_sdk'
import type { ItemView, ModeView } from '@vyrse/protocol'
import { BRIGHTNESS } from '../config'
import type { Display } from '../display'
import { body, chatList, counter, name } from '../layout/containers'
import { fitBytes, utf8Length } from '../layout/fit'
import { LABELS } from '../layout/labels'
import { CARD_Y, ITEM_MAX_WIDTH, MAX_CHATS, MAX_ITEM_BYTES, SUMMARY_LINES, cardHeight, listHeight } from '../layout/sizes'
import { fitLines, textWidth } from '../layout/text'
import type { Entry } from './types'

// Home screen: every chat waiting for the owner, or a short note when there are none.

// "Mike (3): can we move tomorrow's…"
export function chatLabel(item: ItemView) {
  const n = item.messages.length
  const head = `${fitLines(item.name, 1, ITEM_MAX_WIDTH / 2).text}${n > 1 ? ` (${n})` : ''}: `
  const latest = item.messages[n - 1] ?? ''
  const preview = fitLines(item.collecting ? 'typing…' : latest.replace(/\s+/g, ' '), 1, ITEM_MAX_WIDTH - textWidth(head)).text
  return head + fitBytes(preview, MAX_ITEM_BYTES - utf8Length(head))
}

export const listedItems = (items: ItemView[]) => items.slice(0, MAX_CHATS)

export async function drawList(display: Display, items: ItemView[], mode: ModeView): Promise<Entry[]> {
  const entries: Entry[] = listedItems(items).map((item) => ({ label: chatLabel(item), tap: { type: 'open', itemId: item.id } }))

  name.content = `Chats · ${items.length}`
  name.textColor = BRIGHTNESS.bright
  // The mode, if it's on, sits where the counter goes.
  counter.content = mode ? LABELS.secretary : ''
  chatList.height = listHeight(entries.length, CARD_Y)
  chatList.itemContainer = new ListItemContainerProperty({
    itemCount: entries.length,
    itemName: entries.map((e) => e.label),
    isItemSelectBorderEn: 1,
  })
  await display.render([name, counter], [chatList])
  return entries
}

export async function drawEmpty(display: Display, mode: ModeView): Promise<Entry[]> {
  name.content = 'Vyrse'
  name.textColor = BRIGHTNESS.dim
  counter.content = mode ? LABELS.secretary : ''
  body.height = cardHeight(SUMMARY_LINES)
  body.content = mode
    ? "Secretary mode is on.\nMessages that don't need you get answered for you; the rest shows up here."
    : 'No new messages'
  body.textColor = BRIGHTNESS.mid
  body.isEventCapture = 1
  await display.render([name, counter, body], [])
  return []
}
