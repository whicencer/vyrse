import type { ItemView } from '@vyrse/protocol'
import { BRIGHTNESS } from '../config'
import type { Display } from '../display'
import { body, counter, name } from '../layout/containers'
import { NAME_MAX_WIDTH, cardHeight } from '../layout/sizes'
import { fitLines } from '../layout/text'

// While the temple is held: a timer and "Release to send".

export const recordingText = (startedAt: number) =>
  `Recording… ${Math.floor((Date.now() - startedAt) / 1000)} s\nRelease to send`

export async function drawRecording(display: Display, item: ItemView, text: string) {
  name.content = fitLines(`Reply to ${item.name}`, 1, NAME_MAX_WIDTH).text
  name.textColor = BRIGHTNESS.bright
  counter.content = ''
  body.height = cardHeight(2)
  body.content = text
  body.textColor = BRIGHTNESS.bright
  body.isEventCapture = 1
  await display.render([name, counter, body], [])
}

// Only the seconds change while recording: update the text instead of rebuilding the page.
export const updateRecording = (display: Display, text: string) => display.setText(body, text)
