import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'

// Small values that must survive an app restart (the device token).
//
// Written to two places: the SDK's storage (kept by the Even app on the phone) and the
// WebView's localStorage. The simulator keeps SDK storage in memory only, so after a
// restart only localStorage still has the value; on the phone either one works.

export async function loadValue(bridge: EvenAppBridge, key: string): Promise<string> {
  const fromBridge = await bridge.getLocalStorage(key).catch(() => '')
  if (fromBridge) return fromBridge
  try {
    return window.localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

export function saveValue(bridge: EvenAppBridge, key: string, value: string) {
  bridge.setLocalStorage(key, value).catch((e) => console.error('Could not save to SDK storage:', e))
  try {
    window.localStorage.setItem(key, value)
  } catch (e) {
    console.error('Could not save to localStorage:', e)
  }
}
