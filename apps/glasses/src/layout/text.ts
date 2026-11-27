// Display-only text fitting for the G2 font. The SDK has no text measuring API,
// so glyph widths (px) were measured in the simulator and rounded up a little:
// a line that ends early is fine, one that the firmware wraps is not.

const WIDTHS: Record<string, number> = {}
const set = (chars: string, width: number) => {
  for (const ch of chars) WIDTHS[ch] = width
}

set(" iIjl.,:;'!|", 5)
set('"', 6)
set('frt1()[]', 7)
set('kzг', 9)
set('cesoEFк-', 10)
set('abdghnpquvxyCеёзопстухэя', 11)
set('абвдийлнрцчьBDGHJKLNOPRSTUVXYZЕЁЛНОРСТУХЦЧЬЭЯ023456789?', 12)
set('жфъAАБВГЗИЙКП', 13)
set('мшыюМ%', 14)
set('щДw', 15)
set('mMWШЩЖФЫЮ', 16)

const DEFAULT = 12
const DEFAULT_UPPER = 13

const ELLIPSIS = '…'

function charWidth(ch: string) {
  return WIDTHS[ch] ?? (/\p{Lu}/u.test(ch) ? DEFAULT_UPPER : DEFAULT)
}

export function textWidth(text: string) {
  let width = 0
  for (const ch of text) width += charWidth(ch)
  return width
}

// Splits text into lines the way the firmware wraps it: by words,
// breaking a word only when it's longer than a whole line.
export function wrap(text: string, maxWidth: number) {
  const lines: string[] = []

  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const word of paragraph.split(' ')) {
      const candidate = line ? `${line} ${word}` : word
      if (textWidth(candidate) <= maxWidth) {
        line = candidate
        continue
      }
      if (line) lines.push(line)
      line = ''
      // A word wider than the line: break it by characters.
      for (const ch of word) {
        if (textWidth(line + ch) > maxWidth) {
          lines.push(line)
          line = ''
        }
        line += ch
      }
    }
    lines.push(line)
  }

  return lines
}

// Fits text into `maxLines` lines of `maxWidth` px, ending with "…" if it was cut.
export function fitLines(text: string, maxLines: number, maxWidth: number) {
  const lines = wrap(text.trim(), maxWidth)
  if (lines.length <= maxLines) return { text: lines.join('\n'), cut: false }

  let last = lines[maxLines - 1] ?? ''
  while (last && textWidth(last + ELLIPSIS) > maxWidth) last = [...last].slice(0, -1).join('')
  return { text: [...lines.slice(0, maxLines - 1), last.trimEnd() + ELLIPSIS].join('\n'), cut: true }
}
