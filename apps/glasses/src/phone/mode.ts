import type { ModeView } from '@vyrse/protocol'

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

export function showMode(mode: ModeView) {
  modeSwitch.checked = !!mode
  modeText.textContent = mode
    ? `On since ${new Date(mode.since).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}: messages that don't need you get answered for you; only the rest shows up on your glasses.`
    : 'Off: every message shows up on your glasses.'
}
