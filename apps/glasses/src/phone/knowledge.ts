import type { Fact } from '@vyrse/protocol'

// Knowledge base: the server sends the list with every update; edits go back to it.

const kbList = document.getElementById('kb-list')!
const kbEmpty = document.getElementById('kb-empty')!
const kbCount = document.getElementById('kb-count')!
const kbForm = document.getElementById('kb-form') as HTMLFormElement
const kbInput = document.getElementById('kb-input') as HTMLInputElement

let shownFacts = ''

export function onKnowledgeEdit(add: (text: string) => void, remove: (factId: number) => void) {
  kbForm.addEventListener('submit', (e) => {
    e.preventDefault()
    const text = kbInput.value.trim()
    if (!text) return
    add(text)
    kbInput.value = ''
  })
  kbList.addEventListener('click', (e) => {
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>('.kb-remove')
    if (button) remove(Number(button.dataset.id))
  })
}

export function showKnowledge(facts: Fact[]) {
  const key = JSON.stringify(facts)
  if (key === shownFacts) return
  shownFacts = key

  kbList.replaceChildren(
    ...facts.map((fact) => {
      const item = document.createElement('li')
      const text = document.createElement('span')
      text.className = 'fact'
      text.textContent = fact.text
      const remove = document.createElement('button')
      remove.type = 'button'
      remove.className = 'kb-remove'
      remove.dataset.id = String(fact.id)
      remove.setAttribute('aria-label', `Remove "${fact.text}"`)
      remove.textContent = '×'
      item.append(text, remove)
      return item
    }),
  )
  kbEmpty.hidden = facts.length > 0
  kbCount.hidden = facts.length === 0
  kbCount.textContent = String(facts.length)
}
