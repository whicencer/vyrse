import { OsEventTypeList, waitForEvenAppBridge } from '@evenrealities/even_hub_sdk'
import './style.css'
import { connect, sendToServer, setToken } from './connection'
import { createDisplay } from './display'
import { createGlassesUi } from './glasses'
import { showKnowledge, onKnowledgeEdit } from './phone/knowledge'
import { onDemoClick, onModeClick, showMode } from './phone/mode'
import { onPairClick, setPaired, showPairCode } from './phone/pairing'
import { setConnected } from './phone/status'
import { loadValue, saveValue } from './storage'
import { createRecorder } from './voice'

// In the simulator this resolves immediately; on hardware it waits
// for the WebView to initialize the SDK bridge.
const bridge = await waitForEvenAppBridge()

const display = createDisplay(bridge)
const ui = createGlassesUi(display)
await ui.render()

// ── Glasses input ────────────────────────────────────────────────────────────

bridge.onEvenHubEvent((event) => {
  if (event.audioEvent) return recorder.add(event.audioEvent.audioPcm)

  const source = event.listEvent ?? event.textEvent ?? event.sysEvent
  if (!source) return
  // CLICK_EVENT is 0, so it often comes without eventType at all.
  const type = source.eventType ?? OsEventTypeList.CLICK_EVENT

  if (type === OsEventTypeList.LONG_PRESS_EVENT) return startVoiceReply()
  if (type === OsEventTypeList.LONG_PRESS_RELEASE_EVENT) return finishVoiceReply()
  if (type === OsEventTypeList.DOUBLE_CLICK_EVENT) return ui.doubleTap()
  if (type === OsEventTypeList.SCROLL_BOTTOM_EVENT) return ui.scroll('down')
  if (type === OsEventTypeList.SCROLL_TOP_EVENT) return ui.scroll('up')

  const list = event.listEvent
  if (type !== OsEventTypeList.CLICK_EVENT || !list?.containerName) return
  const message = ui.tap(list.containerName, list.currentSelectItemIndex ?? 0)
  if (message) sendToServer(message)
})

// Voice reply: hold the temple in an open chat, speak, release.
const recorder = createRecorder(bridge)
let voice: { itemId: string; timer: number } | null = null

async function startVoiceReply() {
  if (voice) return
  const itemId = ui.startRecording()
  if (!itemId) return
  voice = { itemId, timer: window.setInterval(() => ui.tickRecording(), 1000) }
  if (!(await recorder.start())) await finishVoiceReply()
}

async function finishVoiceReply() {
  if (!voice) return
  const { itemId, timer } = voice
  voice = null
  clearInterval(timer)
  ui.stopRecording()
  const { audio, seconds } = await recorder.stop()
  // A tap that turned into a short hold isn't a reply.
  if (seconds >= 0.5) sendToServer({ type: 'voice', itemId, audio })
}

// ── Phone page ───────────────────────────────────────────────────────────────

onPairClick(() => sendToServer({ type: 'pair_request' }))
onModeClick((on) => sendToServer({ type: 'set_mode', on }))
onDemoClick(() => sendToServer({ type: 'demo' }))
onKnowledgeEdit(
  (text) => sendToServer({ type: 'kb_add', text }),
  (id) => sendToServer({ type: 'kb_remove', id }),
)

// ── Server ───────────────────────────────────────────────────────────────────

// The device token from pairing: without it the server doesn't know whose glasses these are.
const TOKEN_KEY = 'vyrse.token'
setToken(await loadValue(bridge, TOKEN_KEY))

connect((message) => {
  switch (message.type) {
    case 'state':
      ui.setState(message.items, message.mode)
      showMode(message.mode)
      showKnowledge(message.knowledge)
      break
    case 'digest':
      ui.showDigest(message.entries)
      break
    case 'sent':
      ui.sent(message.ok)
      break
    case 'code':
      showPairCode(message.code, message.expiresInSec)
      break
    case 'paired':
      setToken(message.token)
      saveValue(bridge, TOKEN_KEY, message.token)
      setPaired(message.name)
      break
  }
}, setConnected)
