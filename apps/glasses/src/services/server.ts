// Type-only import: keeps server code out of the glasses bundle.
import type { FromGlasses, ToGlasses } from '@vyrse/protocol/legacy'
import { WS_CONNECTION_SECRET, WS_URL } from '../config'

const RECONNECT_MS = 2000

let socket: WebSocket | null = null
// Pairing token from the server; sent on every (re)connect once we have it.
let token = ''

export function setToken(value: string) {
  token = value
}

export function connectToServer(
  onMessage: (msg: ToGlasses) => void,
  onStatus?: (connected: boolean) => void,
) {
  const url = new URL(WS_URL)
  url.searchParams.set('role', 'glasses')
  url.searchParams.set('secret', WS_CONNECTION_SECRET)
  if (token) url.searchParams.set('token', token)

  const ws = new WebSocket(url)
  socket = ws

  ws.onopen = () => {
    console.log('Glasses connected to server!')
    onStatus?.(true)
  }

  ws.onmessage = (e) => {
    onMessage(JSON.parse(e.data))
  }

  ws.onclose = () => {
    socket = null
    onStatus?.(false)
    setTimeout(() => connectToServer(onMessage, onStatus), RECONNECT_MS)
  }
}

export function sendToServer(msg: FromGlasses) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(msg))
  }
}
