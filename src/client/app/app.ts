import { createAppClient } from './app-client.js'

createAppClient({
  document,
  window,
  location,
  webSocketConstructor: WebSocket
}).start()
