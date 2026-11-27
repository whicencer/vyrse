import { BODY_MAX_WIDTH, ITEM_MAX_WIDTH, MAX_ITEM_BYTES, PAGE_LINES, PAGE_MAX_BYTES, PAGE_WIDTH } from './sizes'
import { fitLines, wrap } from './text'

// Fitting texts into the containers' size and byte limits.

const encoder = new TextEncoder()
export const utf8Length = (s: string) => encoder.encode(s).length

// Shortens to fit in `maxBytes`, ending with "…".
export function fitBytes(text: string, maxBytes: number) {
  let result = text
  while (utf8Length(result) > maxBytes) result = [...result].slice(0, -2).join('') + '…'
  return result
}

// One list item: one line and at most 63 bytes.
export function fitItem(text: string) {
  return fitBytes(fitLines(text.replace(/\s+/g, ' '), 1, ITEM_MAX_WIDTH).text, MAX_ITEM_BYTES)
}

// As many of the latest messages as fit. Used when the AI couldn't read the chat.
export function fitMessages(messages: string[], lines: number) {
  let text = ''
  for (let k = 1; k <= messages.length; k++) {
    const fitted = fitLines(messages.slice(-k).join('\n'), lines, BODY_MAX_WIDTH)
    if (fitted.cut) break
    text = fitted.text
  }
  return text || fitLines(messages[messages.length - 1] ?? '', lines, BODY_MAX_WIDTH).text
}

// Splits texts into pages that fit the full text screen.
export function paginate(texts: string[]) {
  const lines = texts.flatMap((t) => wrap(t.trim(), PAGE_WIDTH))
  const pages: string[] = []
  let page: string[] = []
  for (const line of lines) {
    const next = [...page, line]
    if (page.length && (next.length > PAGE_LINES || utf8Length(next.join('\n')) > PAGE_MAX_BYTES)) {
      pages.push(page.join('\n'))
      page = [line]
    } else page = next
  }
  pages.push(page.join('\n'))
  return pages
}
