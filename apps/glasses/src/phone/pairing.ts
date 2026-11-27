import { BOT_USERNAME } from '../config'

// Pairing on the phone page: the button asks the server for a code, the dialog shows it
// with a countdown, and closes once the server says the glasses are paired.

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
  // Opens the bot with "/start <code>", which pairs right away.
  pairBotLink.href = `https://t.me/${BOT_USERNAME}?start=${code}`

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
