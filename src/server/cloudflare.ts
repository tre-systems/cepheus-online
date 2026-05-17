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

export type DurableObjectId = Record<string, never>

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

export interface D1Result<T = unknown> {
  results?: T[]
  success: boolean
  error?: string
  meta?: unknown
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = unknown>(columnName?: string): Promise<T | null>
  all<T = unknown>(): Promise<D1Result<T>>
  run<T = unknown>(): Promise<D1Result<T>>
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>
  exec(query: string): Promise<D1Result>
}

export interface R2ObjectBody {
  body: ReadableStream | null
  httpMetadata?: {
    contentType?: string
  }
  writeHttpMetadata(headers: Headers): void
}

export interface R2PutOptions {
  httpMetadata?: {
    contentType?: string
  }
  customMetadata?: Record<string, string>
}

export interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob,
    options?: R2PutOptions
  ): Promise<unknown>
  delete(key: string | string[]): Promise<void>
}

export interface WebSocketResponseInit extends ResponseInit {
  webSocket: WebSocket
}
