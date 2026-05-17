import { createAppClient } from './app-client'

createAppClient({
  document,
  window,
  location,
  webSocketConstructor: WebSocket
}).start()
