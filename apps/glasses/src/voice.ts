import { AudioInputSource, type EvenAppBridge } from '@evenrealities/even_hub_sdk'

// Records a voice reply from the glasses microphone while the temple is held.
// The mic sends 16 kHz, 16-bit mono PCM in ~100 ms chunks; the server turns it into text.

const MAX_SECONDS = 30
const BYTES_PER_SECOND = 16000 * 2

export function createRecorder(bridge: EvenAppBridge) {
  let chunks: Uint8Array[] | null = null
  let size = 0

  return {
    get recording() {
      return chunks !== null
    },

    async start() {
      chunks = []
      size = 0
      const ok = await bridge.audioControl(true, AudioInputSource.Glasses)
      if (!ok) console.error('Could not open the glasses microphone')
      return ok
    },

    // Fed from onEvenHubEvent's audioEvent. Stops collecting past the limit.
    add(pcm: Uint8Array) {
      if (!chunks || size >= MAX_SECONDS * BYTES_PER_SECOND) return
      chunks.push(pcm)
      size += pcm.length
    },

    // Closes the mic and returns everything recorded, base64-encoded for the WebSocket.
    async stop() {
      const recorded = chunks ?? []
      chunks = null
      await bridge.audioControl(false).catch(() => false)

      const pcm = new Uint8Array(size)
      let offset = 0
      for (const chunk of recorded) {
        pcm.set(chunk, offset)
        offset += chunk.length
      }
      return { audio: toBase64(pcm), seconds: pcm.length / BYTES_PER_SECOND }
    },
  }
}

function toBase64(bytes: Uint8Array) {
  let binary = ''
  // In slices: String.fromCharCode can't take a whole recording as arguments at once.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}
