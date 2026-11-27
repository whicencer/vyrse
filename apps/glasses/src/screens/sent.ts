import { BRIGHTNESS } from '../config'
import type { Display } from '../display'
import { hint } from '../layout/containers'

// The brief "Sent" confirmation after the owner's reply.
export async function drawSent(display: Display, ok: boolean) {
  hint.content = ok ? 'Sent' : 'Not sent, try again'
  hint.textColor = BRIGHTNESS.bright
  await display.render([hint], [])
}
