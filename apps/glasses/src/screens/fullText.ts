import type { DigestEntry } from '@vyrse/protocol'
import { BRIGHTNESS, CANVAS } from '../config'
import type { Display } from '../display'
import { backHint, fullText, name } from '../layout/containers'
import { paginate } from '../layout/fit'
import { LABELS } from '../layout/labels'
import { BACK_HINT_WIDTH, PADDING } from '../layout/sizes'
import { fitLines, textWidth } from '../layout/text'

// Text that doesn't fit a card, page by page: all messages of a chat, or the digest of
// what the secretary answered. Swipe for pages, double tap to go back.

export const messagePages = (messages: string[]) => paginate(messages)

export const digestPages = (entries: DigestEntry[]) =>
  // The summary usually starts with the name already ("Sarah asks…").
  paginate(entries.flatMap((e) => [e.asked.startsWith(e.contactName) ? e.asked : `${e.contactName}: ${e.asked}`, `→ ${e.reply}`]))

export async function drawFullText(display: Display, title: string, pages: string[], page: number) {
  const position = pages.length > 1 ? ` · ${page + 1}/${pages.length}` : ''
  name.content = fitLines(title, 1, CANVAS.width - BACK_HINT_WIDTH - 2 * PADDING - textWidth(position)).text + position
  name.textColor = BRIGHTNESS.bright
  backHint.content = LABELS.backHint
  backHint.textColor = BRIGHTNESS.dim
  fullText.content = pages[page] ?? ''
  fullText.textColor = BRIGHTNESS.bright
  await display.render([name, backHint, fullText], [])
}
