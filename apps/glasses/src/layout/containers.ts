import { CANVAS } from '../config'
import { listContainer, textContainer } from '../display'
import {
  BACK_HINT_WIDTH, CARD_BORDER, CARD_PADDING, CARD_Y, COUNTER_WIDTH, HEADER_HEIGHT, HEADER_Y, SUMMARY_LINES, cardHeight,
} from './sizes'

// Every container the screens draw with. Screens change their content and size, then render.
// The SDK expects exactly one container per page to capture events.

// Header: the chat name or the screen title.
export const name = textContainer({
  containerID: 1,
  containerName: 'name',
  yPosition: HEADER_Y,
  width: CANVAS.width - COUNTER_WIDTH,
  height: HEADER_HEIGHT,
})

// Top-right label: the voice hint on a chat, the mode on the chat list.
export const counter = textContainer({
  containerID: 2,
  containerName: 'counter',
  xPosition: CANVAS.width - COUNTER_WIDTH,
  yPosition: HEADER_Y,
  width: COUNTER_WIDTH,
  height: HEADER_HEIGHT,
})

// The card under the header: summary, draft or status text.
export const body = textContainer({
  containerID: 3,
  containerName: 'body',
  yPosition: CARD_Y,
  width: CANVAS.width,
  height: cardHeight(SUMMARY_LINES),
  paddingLength: CARD_PADDING,
  borderWidth: CARD_BORDER,
  borderColor: 6,
  borderRadius: 10,
  isEventCapture: 0,
})

// Only for the short "Sent" confirmation.
export const hint = textContainer({
  containerID: 4,
  containerName: 'hint',
  yPosition: CANVAS.height / 2 - HEADER_HEIGHT / 2,
  width: CANVAS.width,
  height: HEADER_HEIGHT,
})

// Options under the card on a chat.
export const actions = listContainer({
  containerID: 5,
  containerName: 'actions',
  width: CANVAS.width,
})

// The chat list. Not id 2: the counter (mode label) is on the same page.
export const chatList = listContainer({
  containerID: 6,
  containerName: 'chats',
  yPosition: CARD_Y,
  width: CANVAS.width,
})

// Full text screen: header + one page of text that fills the rest of the display.
export const backHint = textContainer({
  containerID: 2,
  containerName: 'back-hint',
  xPosition: CANVAS.width - BACK_HINT_WIDTH,
  yPosition: HEADER_Y,
  width: BACK_HINT_WIDTH,
  height: HEADER_HEIGHT,
})

export const fullText = textContainer({
  containerID: 3,
  containerName: 'full-text',
  yPosition: CARD_Y,
  width: CANVAS.width,
  height: CANVAS.height - CARD_Y,
  // Catches swipes (pages) and the double tap (back).
  isEventCapture: 1,
})
