import {
  EVENT_ENVELOPE_VERSION,
  type EventEnvelope,
  type GameEvent
} from '../../shared/events'
import { asEventId, type GameId, type UserId } from '../../shared/ids'
import type { GameState } from '../../shared/state'
import type { DurableObjectStorage } from '../cloudflare'

export const EVENT_CHUNK_SIZE = 64

const eventChunkKey = (gameId: GameId, chunkIndex: number): string =>
  `events:${gameId}:chunk:${chunkIndex}`

const eventChunkCountKey = (gameId: GameId): string =>
  `eventChunkCount:${gameId}`

const eventSeqKey = (gameId: GameId): string => `eventSeq:${gameId}`

const checkpointKey = (gameId: GameId): string => `checkpoint:${gameId}`

export const gameSeedKey = (gameId: GameId): string => `gameSeed:${gameId}`

export interface GameCheckpoint {
  gameId: GameId
  seq: number
  state: GameState
  savedAt: string
}

const getEventChunkCount = async (
  storage: DurableObjectStorage,
  gameId: GameId
): Promise<number> =>
  (await storage.get<number>(eventChunkCountKey(gameId))) ?? 0

const getEventChunk = async (
  storage: DurableObjectStorage,
  gameId: GameId,
  chunkIndex: number
): Promise<EventEnvelope[]> =>
  (await storage.get<EventEnvelope[]>(eventChunkKey(gameId, chunkIndex))) ?? []

export const getEventSeq = async (
  storage: DurableObjectStorage,
  gameId: GameId
): Promise<number> => (await storage.get<number>(eventSeqKey(gameId))) ?? 0

export const readEventStream = async (
  storage: DurableObjectStorage,
  gameId: GameId
): Promise<EventEnvelope[]> => {
  const chunkCount = await getEventChunkCount(storage, gameId)
  const chunks = await Promise.all(
    Array.from({ length: chunkCount }, (_, chunkIndex) =>
      getEventChunk(storage, gameId, chunkIndex)
    )
  )

  return chunks.flat()
}

export const readEventStreamTail = async (
  storage: DurableObjectStorage,
  gameId: GameId,
  afterSeqExclusive: number
): Promise<EventEnvelope[]> => {
  const chunkCount = await getEventChunkCount(storage, gameId)
  const startChunkIndex = Math.max(
    0,
    Math.floor(afterSeqExclusive / EVENT_CHUNK_SIZE)
  )
  const stream: EventEnvelope[] = []

  for (
    let chunkIndex = startChunkIndex;
    chunkIndex < chunkCount;
    chunkIndex++
  ) {
    const chunk = await getEventChunk(storage, gameId, chunkIndex)
    stream.push(...chunk.filter((event) => event.seq > afterSeqExclusive))
  }

  return stream
}

export const appendEvents = async (
  storage: DurableObjectStorage,
  gameId: GameId,
  actorId: UserId | null,
  events: readonly GameEvent[],
  createdAt: string
): Promise<EventEnvelope[]> => {
  if (events.length === 0) return []

  const updatedChunks = new Map<number, EventEnvelope[]>()
  const initialChunkCount = await getEventChunkCount(storage, gameId)
  let nextChunkCount = initialChunkCount
  let seq = await getEventSeq(storage, gameId)
  const envelopes: EventEnvelope[] = []

  for (const event of events) {
    const nextSeq = seq + 1
    const chunkIndex = Math.floor((nextSeq - 1) / EVENT_CHUNK_SIZE)
    const chunk =
      updatedChunks.get(chunkIndex) ??
      (await getEventChunk(storage, gameId, chunkIndex))
    const envelope: EventEnvelope = {
      version: EVENT_ENVELOPE_VERSION,
      id: asEventId(`${gameId}:${nextSeq}`),
      gameId,
      seq: nextSeq,
      actorId,
      createdAt,
      event
    }

    chunk.push(envelope)
    updatedChunks.set(chunkIndex, chunk)
    envelopes.push(envelope)
    seq = nextSeq
    nextChunkCount = Math.max(nextChunkCount, chunkIndex + 1)
  }

  const entries: Record<string, unknown> = {
    [eventChunkCountKey(gameId)]: nextChunkCount,
    [eventSeqKey(gameId)]: seq
  }

  for (const [chunkIndex, chunk] of updatedChunks) {
    entries[eventChunkKey(gameId, chunkIndex)] = chunk
  }

  await storage.put(entries)

  return envelopes
}

export const saveCheckpoint = async (
  storage: DurableObjectStorage,
  state: GameState,
  savedAt: string
): Promise<void> => {
  await storage.put(checkpointKey(state.id), {
    gameId: state.id,
    seq: state.eventSeq,
    state: structuredClone(state),
    savedAt
  } satisfies GameCheckpoint)
}

export const readCheckpoint = async (
  storage: DurableObjectStorage,
  gameId: GameId
): Promise<GameCheckpoint | null> =>
  (await storage.get<GameCheckpoint>(checkpointKey(gameId))) ?? null

export const deleteGameStorage = async (
  storage: DurableObjectStorage,
  gameId: GameId
): Promise<void> => {
  const chunkCount = await getEventChunkCount(storage, gameId)
  for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
    await storage.delete(eventChunkKey(gameId, chunkIndex))
  }

  await Promise.all([
    storage.delete(eventChunkCountKey(gameId)),
    storage.delete(eventSeqKey(gameId)),
    storage.delete(checkpointKey(gameId)),
    storage.delete(gameSeedKey(gameId))
  ])
}

const generateSeed = (): number => {
  const seed = new Uint32Array(1)
  crypto.getRandomValues(seed)
  return seed[0] | 0
}

export const getOrCreateGameSeed = async (
  storage: DurableObjectStorage,
  gameId: GameId
): Promise<number> => {
  const existing = await storage.get<number>(gameSeedKey(gameId))
  if (existing !== undefined) return existing

  const seed = generateSeed()
  await storage.put(gameSeedKey(gameId), seed)

  return seed
}
