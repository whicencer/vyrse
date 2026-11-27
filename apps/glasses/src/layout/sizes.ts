import { CANVAS } from '../config'
import { LABELS } from './labels'
import { textWidth } from './text'

// Sizes and limits of the G2 display, measured in the simulator.

export const LINE_HEIGHT = 27
export const PADDING = 4
export const HEADER_Y = 4
export const HEADER_HEIGHT = 36

export const CARD_Y = HEADER_Y + HEADER_HEIGHT
export const CARD_PADDING = 10
export const CARD_BORDER = 1
// Lines in the card: the summary on the chat screen, the message on the draft screen.
// Both are sized so the list under them shows at least two items without scrolling.
export const SUMMARY_LINES = 3
export const DRAFT_LINES = 4
export const cardHeight = (lines: number) => lines * LINE_HEIGHT + 2 * (CARD_PADDING + CARD_BORDER)

// The firmware centers list items vertically, so lists are sized to their items.
const LIST_ITEM_HEIGHT = 40
// Whole items only: a list taller than its items shows half an item at the bottom.
export const listHeight = (items: number, top: number) => {
  const fit = Math.floor((CANVAS.height - top - 2 * PADDING) / LIST_ITEM_HEIGHT)
  return Math.min(items, fit) * LIST_ITEM_HEIGHT + 2 * PADDING
}

// Containers can't align text right, so the top-right label (the voice hint on a chat,
// the mode on the chat list) sits at a fixed spot sized for the longest value it shows.
// Measured widths run a little short here, so leave a margin or the hint wraps.
export const COUNTER_WIDTH = Math.max(textWidth(LABELS.holdHint), textWidth(LABELS.secretary)) + 2 * PADDING + 16
export const BACK_HINT_WIDTH = textWidth(LABELS.backHint) + 2 * PADDING

// Full text screen: one page of text under the header.
export const PAGE_LINES = Math.floor((CANVAS.height - CARD_Y - 2 * PADDING) / LINE_HEIGHT)
export const PAGE_WIDTH = CANVAS.width - 2 * PADDING - 10
// The firmware caps a text container at 999 bytes.
export const PAGE_MAX_BYTES = 999

// Keeps the chat list short enough to scroll through on the glasses.
export const MAX_CHATS = 20

export const NAME_MAX_WIDTH = CANVAS.width - COUNTER_WIDTH - 2 * PADDING
export const BODY_MAX_WIDTH = CANVAS.width - 2 * (CARD_PADDING + CARD_BORDER)
// A list item: one line and at most 63 bytes; leave room for the selection border.
export const ITEM_MAX_WIDTH = BODY_MAX_WIDTH - 20
export const MAX_ITEM_BYTES = 63
