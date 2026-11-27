import type { ItemView } from '@vyrse/protocol'
import { describe, expect, it } from 'vitest'
import type { Display } from './display'
import { createGlassesUi } from './glasses'

// A display that remembers what was drawn last, instead of talking to the glasses.
function fakeDisplay() {
  const drawn = { texts: [] as string[], list: [] as string[] }
  let queue = Promise.resolve()
  const display = {
    async render(text: { content?: string }[], lists: { itemContainer?: { itemName?: string[] } }[]) {
      drawn.texts = text.map((t) => t.content ?? '')
      drawn.list = lists[0]?.itemContainer?.itemName ?? []
      return true
    },
    async setText() {},
    update(task: () => Promise<void>) {
      queue = queue.then(task)
      return queue
    },
  }
  return { display: display as unknown as Display, drawn, settled: () => queue }
}

const mike: ItemView = {
  id: 'm1',
  name: 'Mike',
  messages: ['hey', 'can we move the shoot to 14?'],
  collecting: false,
  analysis: { status: 'ready', summary: 'Mike asks to move the shoot to 14:00.', options: ['Agree to 14:00', 'Suggest 15:00'] },
  draft: null,
}

describe('glasses UI', () => {
  it('shows the chat list, opens a chat and sends the picked option', async () => {
    const { display, drawn, settled } = fakeDisplay()
    const ui = createGlassesUi(display)
    await ui.render()
    expect(drawn.texts).toContain('No new messages')

    await ui.setState([mike], null)
    expect(drawn.texts[0]).toBe('Chats · 1')
    expect(drawn.list[0]).toMatch(/^Mike \(2\): can we move/)

    // Opening a chat happens on the glasses only.
    expect(ui.tap('chats', 0)).toBeNull()
    await settled()
    expect(drawn.texts[0]).toBe('Mike · 2 messages')
    expect(drawn.list).toEqual(['Agree to 14:00', 'Suggest 15:00', 'Show messages', 'Ignore', 'Back'])

    expect(ui.tap('actions', 0)).toEqual({ type: 'choose', itemId: 'm1', option: 0 })
  })

  it('goes back to the list when the open chat is answered elsewhere', async () => {
    const { display, drawn, settled } = fakeDisplay()
    const ui = createGlassesUi(display)
    await ui.setState([mike], null)
    ui.tap('chats', 0)
    await settled()
    await ui.setState([], { since: 0 })
    expect(drawn.texts[0]).toBe('Vyrse')
    expect(drawn.texts[1]).toBe('Secretary')
  })

  it('shows the draft with Send and Back', async () => {
    const { display, drawn, settled } = fakeDisplay()
    const ui = createGlassesUi(display)
    await ui.setState([mike], null)
    ui.tap('chats', 0)
    await ui.setState([{ ...mike, draft: { status: 'ready', intent: 'Agree to 14:00', text: 'Yes, 14:00 works.' } }], null)
    await settled()
    expect(drawn.texts[0]).toBe('Reply to Mike')
    expect(drawn.list).toEqual(['Send', 'Back'])
    expect(ui.tap('actions', 0)).toEqual({ type: 'send', itemId: 'm1' })
  })
})
