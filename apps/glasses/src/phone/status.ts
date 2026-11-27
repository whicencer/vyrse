// The phone-side page (what the user sees in the Even app, or the simulator's browser window):
// connection status at the top.

const status = document.getElementById('status')!
const statusText = document.getElementById('status-text')!

export function setConnected(connected: boolean) {
  status.dataset.state = connected ? 'connected' : 'disconnected'
  statusText.textContent = connected ? 'Connected' : 'Reconnecting…'
}
