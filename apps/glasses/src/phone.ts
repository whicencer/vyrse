import type { ModeState } from '@vyrse/protocol/legacy'
import { BOT_USERNAME } from './config'

// The phone-side page (what the user sees in the Even app, or the simulator's browser window).

const status = document.getElementById('status')!
const statusText = document.getElementById('status-text')!

export function setConnected(connected: boolean) {
  status.dataset.state = connected ? 'connected' : 'disconnected'
  statusText.textContent = connected ? 'Connected' : 'Reconnecting…'
}

// Pairing: the button asks the server for a code, the dialog shows it with a countdown.

const pairButton = document.getElementById('pair-button')!
const pairState = document.getElementById('pair-state')!
const pairDialog = document.getElementById('pair-dialog') as HTMLDialogElement
const pairBotLink = document.getElementById('pair-bot-link') as HTMLAnchorElement
const pairCode = document.getElementById('pair-code')!
const pairCommand = document.getElementById('pair-command')!
const pairCommandText = document.getElementById('pair-command-text')!
const pairCopyLabel = document.getElementById('pair-copy-label')!
const pairExpiry = document.getElementById('pair-expiry')!
const pairRenew = document.getElementById('pair-renew')!

let currentCode = ''
let countdown: number | undefined

function setPairLoading() {
  clearInterval(countdown)
  currentCode = ''
  pairDialog.dataset.state = 'loading'
  pairCode.textContent = '······'
  pairCommandText.textContent = '/pair ······'
  pairCopyLabel.textContent = 'Copy'
  pairBotLink.textContent = `@${BOT_USERNAME}`
  pairBotLink.href = `https://t.me/${BOT_USERNAME}`
  pairExpiry.textContent = 'Getting a code…'
  pairRenew.hidden = true
}

export function onPairClick(requestCode: () => void) {
  const request = () => {
    setPairLoading()
    requestCode()
  }
  pairButton.addEventListener('click', () => {
    pairDialog.showModal()
    request()
  })
  pairRenew.addEventListener('click', request)
}

export function showPairCode(code: string, expiresInSec: number) {
  currentCode = code
  pairDialog.dataset.state = 'ready'
  pairCode.textContent = `${code.slice(0, 3)} ${code.slice(3)}`
  pairCommandText.textContent = `/pair ${code}`
  pairBotLink.href = `https://t.me/${BOT_USERNAME}?pair=${code}`

  const expiresAt = Date.now() + expiresInSec * 1000
  const tick = () => {
    const left = Math.max(0, Math.round((expiresAt - Date.now()) / 1000))
    if (left === 0) {
      clearInterval(countdown)
      pairDialog.dataset.state = 'expired'
      pairExpiry.textContent = 'This code has expired'
      pairRenew.hidden = false
      return
    }
    const min = Math.floor(left / 60)
    const sec = String(left % 60).padStart(2, '0')
    pairExpiry.textContent = `Expires in ${min}:${sec}`
  }
  clearInterval(countdown)
  tick()
  countdown = window.setInterval(tick, 1000)
}

pairCommand.addEventListener('click', async () => {
  if (pairDialog.dataset.state !== 'ready') return
  try {
    await navigator.clipboard.writeText(`/pair ${currentCode}`)
    pairCopyLabel.textContent = 'Copied'
  } catch {
    pairCopyLabel.textContent = 'Copy failed'
  }
  setTimeout(() => (pairCopyLabel.textContent = 'Copy'), 1500)
})

pairDialog.addEventListener('close', () => clearInterval(countdown))

export function setPaired(name: string) {
  pairState.textContent = `Paired with ${name}`
  pairButton.textContent = 'Re-pair'
  pairButton.classList.add('button-secondary')

  if (!pairDialog.open) return
  clearInterval(countdown)
  pairDialog.dataset.state = 'paired'
  pairCode.textContent = 'Paired ✓'
  pairExpiry.textContent = `Your glasses are linked to ${name}`
  setTimeout(() => pairDialog.close(), 1500)
}

// Secretary mode switch plus the demo button.

const modeSwitch = document.getElementById('mode-switch') as HTMLInputElement
const modeText = document.getElementById('mode-text')!
const demoButton = document.getElementById('demo-button')!

export function onModeClick(setMode: (on: boolean) => void) {
  // The switch shows what the server says: it flips back until the server confirms.
  modeSwitch.addEventListener('change', () => {
    const on = modeSwitch.checked
    modeSwitch.checked = !on
    setMode(on)
  })
}

export function onDemoClick(run: () => void) {
  demoButton.addEventListener('click', run)
}

export function setModeState(mode: ModeState | null) {
  modeSwitch.checked = !!mode
  modeText.textContent = mode
    ? `On since ${new Date(mode.since).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}: messages that don't need you get answered for you; only the rest shows up on your glasses.`
    : 'Off: every message shows up on your glasses.'
}

// Knowledge base: the server sends the list with every update; edits go back to it.

const kbList = document.getElementById('kb-list')!
const kbEmpty = document.getElementById('kb-empty')!
const kbCount = document.getElementById('kb-count')!
const kbForm = document.getElementById('kb-form') as HTMLFormElement
const kbInput = document.getElementById('kb-input') as HTMLInputElement

let shownFacts = ''

export function onKnowledgeEdit(add: (text: string) => void, remove: (index: number) => void) {
  kbForm.addEventListener('submit', (e) => {
    e.preventDefault()
    const text = kbInput.value.trim()
    if (!text) return
    add(text)
    kbInput.value = ''
  })
  kbList.addEventListener('click', (e) => {
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>('.kb-remove')
    if (button) remove(Number(button.dataset.index))
  })
}

export function showKnowledge(facts: string[]) {
  const key = JSON.stringify(facts)
  if (key === shownFacts) return
  shownFacts = key

  kbList.replaceChildren(
    ...facts.map((fact, index) => {
      const item = document.createElement('li')
      const text = document.createElement('span')
      text.className = 'fact'
      text.textContent = fact
      const remove = document.createElement('button')
      remove.type = 'button'
      remove.className = 'kb-remove'
      remove.dataset.index = String(index)
      remove.setAttribute('aria-label', `Remove "${fact}"`)
      remove.textContent = '×'
      item.append(text, remove)
      return item
    }),
  )
  kbEmpty.hidden = facts.length > 0
  kbCount.hidden = facts.length === 0
  kbCount.textContent = String(facts.length)
}
