import type { ClientMessage, ServerMessage } from '@vyrse/protocol'

// WebSocket to the server, reconnecting on its own. Once paired, the device token is sent
// on every (re)connect: that's how the server knows whose glasses these are.

const RECONNECT_MS = 2000
// Same host the app is served from: localhost in the simulator, the computer's IP on a phone.
const serverUrl = () => `ws://${location.hostname}:8080`

let socket: WebSocket | null = null
let token = ''

export function setToken(value: string) {
  token = value
}

export function connect(onMessage: (message: ServerMessage) => void, onStatus: (connected: boolean) => void) {
  const url = new URL(serverUrl())
  if (token) url.searchParams.set('token', token)

  const ws = new WebSocket(url)
  socket = ws

  ws.onopen = () => onStatus(true)
  ws.onmessage = (e) => onMessage(JSON.parse(e.data) as ServerMessage)
  ws.onclose = () => {
    socket = null
    onStatus(false)
    setTimeout(() => connect(onMessage, onStatus), RECONNECT_MS)
  }
}

export function sendToServer(message: ClientMessage) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
}
