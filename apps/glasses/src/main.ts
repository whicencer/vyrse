import { OsEventTypeList, waitForEvenAppBridge } from '@evenrealities/even_hub_sdk'
import './style.css'
import {
  onDemoClick, onKnowledgeEdit, onModeClick, onPairClick, setConnected, setModeState, setPaired,
  showKnowledge, showPairCode,
} from './phone'
import { createDisplay } from './display'
import { createMessageScreen } from './screens/message'
import { connectToServer, sendToServer, setToken } from './services/server'
import { createRecorder } from './voice'

// In the simulator this resolves immediately; on hardware it waits
// for the WebView to initialize the SDK bridge.
const bridge = await waitForEvenAppBridge()

bridge.onEvenHubEvent((event) => {
  if (event.audioEvent) return recorder.add(event.audioEvent.audioPcm)

  const source = event.listEvent ?? event.textEvent ?? event.sysEvent
  if (!source) return
  // CLICK_EVENT is 0, so it often comes without eventType at all.
  const type = source.eventType ?? OsEventTypeList.CLICK_EVENT

  if (type === OsEventTypeList.LONG_PRESS_EVENT) return startVoiceReply()
  if (type === OsEventTypeList.LONG_PRESS_RELEASE_EVENT) return finishVoiceReply()
  if (type === OsEventTypeList.DOUBLE_CLICK_EVENT) return messageScreen.doubleTap()
  if (type === OsEventTypeList.SCROLL_BOTTOM_EVENT) return messageScreen.scroll('down')
  if (type === OsEventTypeList.SCROLL_TOP_EVENT) return messageScreen.scroll('up')

  const list = event.listEvent
  if (type !== OsEventTypeList.CLICK_EVENT || !list?.containerName) return
  const action = messageScreen.click(list.containerName, list.currentSelectItemIndex ?? 0)
  if (action) sendToServer(action)
})

const display = createDisplay(bridge)
const messageScreen = createMessageScreen(display)
await messageScreen.render()

// Voice reply: hold the temple in an open chat, speak, release.
const recorder = createRecorder(bridge)
let voice: { batchId: string; timer: number } | null = null

async function startVoiceReply() {
  if (voice) return
  const batchId = messageScreen.startRecording()
  if (!batchId) return
  voice = { batchId, timer: window.setInterval(() => messageScreen.tickRecording(), 1000) }
  if (!(await recorder.start())) await finishVoiceReply()
}

async function finishVoiceReply() {
  if (!voice) return
  const { batchId, timer } = voice
  voice = null
  clearInterval(timer)
  messageScreen.stopRecording()
  const { audio, seconds } = await recorder.stop()
  // A tap that turned into a short hold isn't a reply.
  if (seconds >= 0.5) sendToServer({ type: 'voice', batchId, audio })
}

onPairClick(() => sendToServer({ type: 'pair_request' }))
onModeClick((on) => sendToServer({ type: 'set_mode', on }))
onDemoClick(() => sendToServer({ type: 'demo' }))
onKnowledgeEdit(
  (text) => sendToServer({ type: 'kb_add', text }),
  (index) => sendToServer({ type: 'kb_remove', index }),
)

// Stored through the bridge: it survives app restarts on the glasses too.
const TOKEN_KEY = 'vyrse.token'
setToken(await bridge.getLocalStorage(TOKEN_KEY).catch(() => ''))

connectToServer(
  (msg) => {
    switch (msg.type) {
      case 'queue':
        messageScreen.setQueue(msg.card, msg.chats, msg.mode)
        setModeState(msg.mode)
        showKnowledge(msg.knowledge)
        break;
      case 'digest':
        messageScreen.showDigest(msg.digest)
        break;
      case 'reply_sent_status':
        messageScreen.sent(msg.isSuccess)
        break;
      case 'code':
        showPairCode(msg.code, msg.expiresInSec)
        break;
      case 'paired':
        setToken(msg.token)
        bridge.setLocalStorage(TOKEN_KEY, msg.token)
        setPaired(msg.name)
        break;
    }
  },
  setConnected,
)
