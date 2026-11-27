// Same host the app is served from: localhost in the simulator, the computer's IP on a phone.
export const WS_URL = `ws://${location.hostname}:8080`
// Sent as ?secret= when connecting; the server rejects connections without it.
export const WS_CONNECTION_SECRET = __WS_CONNECTION_SECRET__

// Bot the user sends the pairing code to.
export const BOT_USERNAME = 'VyrseBot'

// Visible area of the G2 display.
export const CANVAS = { width: 576, height: 288 } as const

// Text brightness levels accepted by `textColor` (0..4).
export const BRIGHTNESS = { dim: 1, mid: 2, bright: 4 } as const
