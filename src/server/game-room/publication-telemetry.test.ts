import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { Command } from '../../shared/commands'
import {
  asBoardId,
  asCharacterId,
  asGameId,
  asPieceId,
  asUserId
} from '../../shared/ids'
import type { PublicationTelemetryEvent } from './publication-telemetry'
import { CommandPublicationError, runCommandPublication } from './publication'
import { readEventStream } from './storage'
import { createMemoryStorage } from './test-support'

const gameId = asGameId('game-1')
const actorId = asUserId('user-1')

const createGameCommand = (): Command => ({
  type: 'CreateGame',
  gameId,
  actorId,
  slug: 'game-1',
  name: 'Spinward Test'
})

const createBoardCommand = (boardId = asBoardId('board-1')): Command => ({
  type: 'CreateBoard',
  gameId,
  actorId,
  boardId,
  name: 'Downport',
  width: 1000,
  height: 800,
  scale: 50
})

const publish = async (
  storage: ReturnType<typeof createMemoryStorage>,
  command: Command,
  telemetry: PublicationTelemetryEvent[],
  requestId = `req-${command.type}`
) =>
  runCommandPublication(
    storage,
    gameId,
    {
      type: 'command',
      requestId,
      command
    },
    {
      telemetrySink: {
        recordPublication: (event) => telemetry.push(event)
      }
    }
  )

describe('publication telemetry', () => {
  it('records accepted publication outcomes through an injected sink', async () => {
    const storage = createMemoryStorage()
    const telemetry: PublicationTelemetryEvent[] = []

    const accepted = await publish(storage, createGameCommand(), telemetry)

    assert.equal(accepted.ok, true)
    assert.deepEqual(telemetry, [
      {
        type: 'publicationAccepted',
        gameId,
        requestId: 'req-CreateGame',
        commandType: 'CreateGame',
        actorId,
        eventSeq: 1,
        eventCount: 1
      }
    ])
  })

  it('records invalid, stale, and not-allowed rejection outcomes', async () => {
    const storage = createMemoryStorage()
    const telemetry: PublicationTelemetryEvent[] = []
    await publish(storage, createGameCommand(), telemetry)

    const invalid = await publish(
      storage,
      {
        type: 'CreateBoard',
        gameId,
        actorId,
        boardId: asBoardId('board-invalid'),
        name: 'Invalid',
        width: -1,
        height: 800,
        scale: 50
      },
      telemetry,
      'req-invalid'
    )

    await publish(storage, createBoardCommand(), telemetry)
    await publish(
      storage,
      {
        type: 'CreatePiece',
        gameId,
        actorId,
        pieceId: asPieceId('piece-1'),
        boardId: asBoardId('board-1'),
        name: 'Scout',
        x: 10,
        y: 10
      },
      telemetry
    )

    const stale = await publish(
      storage,
      {
        type: 'MovePiece',
        gameId,
        actorId,
        pieceId: asPieceId('piece-1'),
        x: 20,
        y: 20,
        expectedSeq: 1
      },
      telemetry,
      'req-stale'
    )

    const characterId = asCharacterId('char-1')
    await publish(
      storage,
      {
        type: 'CreateCharacter',
        gameId,
        actorId,
        characterId,
        characterType: 'PLAYER',
        name: 'Scout'
      },
      telemetry
    )
    await publish(
      storage,
      {
        type: 'StartCharacterCreation',
        gameId,
        actorId,
        characterId
      },
      telemetry
    )

    const notAllowed = await publish(
      storage,
      {
        type: 'SetCharacterCreationHomeworld',
        gameId,
        actorId,
        characterId,
        homeworld: {
          name: 'Regina',
          lawLevel: 'No Law',
          tradeCodes: ['Asteroid']
        }
      },
      telemetry,
      'req-not-allowed'
    )

    assert.equal(invalid.ok, false)
    assert.equal(stale.ok, false)
    assert.equal(notAllowed.ok, false)
    assert.deepEqual(
      telemetry
        .filter((event) => event.type === 'publicationRejected')
        .map((event) => ({
          requestId: event.requestId,
          commandType: event.commandType,
          code: event.code,
          currentSeq: event.currentSeq
        })),
      [
        {
          requestId: 'req-invalid',
          commandType: 'CreateBoard',
          code: 'invalid_command',
          currentSeq: 1
        },
        {
          requestId: 'req-stale',
          commandType: 'MovePiece',
          code: 'stale_command',
          currentSeq: 3
        },
        {
          requestId: 'req-not-allowed',
          commandType: 'SetCharacterCreationHomeworld',
          code: 'not_allowed',
          currentSeq: 5
        }
      ]
    )
  })

  it('records internal projection mismatch errors before throwing', async () => {
    const storage = createMemoryStorage()
    const telemetry: PublicationTelemetryEvent[] = []
    await publish(storage, createGameCommand(), telemetry)

    const get = storage.get.bind(storage)
    let chunkReads = 0
    storage.get = async <T = unknown>(key: string): Promise<T | undefined> => {
      if (key === `events:${gameId}:chunk:0`) {
        chunkReads += 1
        const chunk = await get<T>(key)

        if (chunkReads >= 3 && Array.isArray(chunk)) {
          return chunk.filter((envelope) => envelope.seq < 2) as T
        }

        return chunk
      }

      return get<T>(key)
    }

    let thrown: unknown = null
    try {
      await publish(storage, createBoardCommand(), telemetry, 'req-mismatch')
    } catch (error) {
      thrown = error
    }

    assert.equal(thrown instanceof CommandPublicationError, true)
    assert.deepEqual(telemetry.at(-1), {
      type: 'publicationInternalError',
      gameId,
      requestId: 'req-mismatch',
      commandType: 'CreateBoard',
      actorId,
      code: 'projection_mismatch',
      message: 'Stored event stream does not match live projection',
      currentSeq: 1,
      eventSeq: 2
    })

    storage.get = get
    assert.equal((await readEventStream(storage, gameId)).length, 2)
  })
})
