export interface DurableObjectStorage {
  get<T = unknown>(key: string): Promise<T | undefined>
  put<T = unknown>(key: string, value: T): Promise<void>
  put(entries: Record<string, unknown>): Promise<void>
  delete(key: string): Promise<boolean>
}

export interface DurableObjectState {
  storage: DurableObjectStorage
  acceptWebSocket?(socket: WebSocket, tags: string[]): void
  getWebSockets?(tag?: string): WebSocket[]
  getTags?(socket: WebSocket): string[]
  waitUntil?(promise: Promise<unknown>): void
}

export interface DurableObjectId {}

export interface DurableObjectStub {
  fetch(request: Request): Promise<Response>
}

export interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId
  get(id: DurableObjectId): DurableObjectStub
}

export interface Fetcher {
  fetch(request: Request): Promise<Response>
}

export interface WebSocketResponseInit extends ResponseInit {
  webSocket: WebSocket
}
