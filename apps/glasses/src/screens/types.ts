import type { ClientMessage } from '@vyrse/protocol'

// What a tap on a list item does: something handled on the glasses (open a chat, show the
// full text) or a message to the server.
export type Tap =
  | { type: 'open'; itemId: string | null }
  | { type: 'show' }
  | Extract<ClientMessage, { type: 'choose' | 'send' | 'discard' | 'dismiss' }>

export type Entry = { label: string; tap: Tap }
