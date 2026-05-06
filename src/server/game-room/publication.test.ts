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
import { getProjectedGameState } from './projection'
import { CommandPublicationError, runCommandPublication } from './publication'
import { gameSeedKey, readCheckpoint, readEventStream } from './storage'
import { createMemoryStorage } from './test-support'

const gameId = asGameId('game-1')
const actorId = asUserId('user-1')

const publish = (
  storage: ReturnType<typeof createMemoryStorage>,
  command: Command,
  requestId = `req-${command.type}`
) =>
  runCommandPublication(storage, gameId, {
    type: 'command',
    requestId,
    command
  })

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

describe('room publication flow', () => {
  it('returns one state-bearing publication for accepted commands', async () => {
    const storage = createMemoryStorage()

    const accepted = await publish(storage, createGameCommand())

    assert.equal(accepted.ok, true)
    if (!accepted.ok) return
    assert.deepEqual(Object.keys(accepted.value).sort(), [
      'eventSeq',
      'liveActivities',
      'requestId',
      'state'
    ])
    assert.equal(accepted.value.eventSeq, accepted.value.state.eventSeq)
    assert.deepEqual(accepted.value.liveActivities, [])
  })

  it('exposes derived dice activity for accepted dice commands', async () => {
    const storage = createMemoryStorage()
    await publish(storage, createGameCommand())

    const rolled = await publish(storage, {
      type: 'RollDice',
      gameId,
      actorId,
      expression: '2d6',
      reason: 'Table roll'
    })

    assert.equal(rolled.ok, true)
    if (!rolled.ok) return
    assert.equal(rolled.value.liveActivities.length, 1)
    assert.equal(rolled.value.liveActivities[0]?.type, 'diceRoll')
    assert.equal(rolled.value.liveActivities[0]?.seq, 2)
    assert.equal(rolled.value.liveActivities[0]?.actorId, actorId)
    if (rolled.value.liveActivities[0]?.type !== 'diceRoll') return
    assert.equal(rolled.value.liveActivities[0].expression, '2d6')
    assert.equal(rolled.value.liveActivities[0].reason, 'Table roll')
    assert.deepEqual(
      rolled.value.liveActivities[0].rolls,
      rolled.value.state.diceLog[0]?.rolls
    )
    assert.equal(
      rolled.value.liveActivities[0].total,
      rolled.value.state.diceLog[0]?.total
    )
  })

  it('rejects invalid commands without writing an event stream', async () => {
    const storage = createMemoryStorage()

    const rejected = await publish(storage, {
      type: 'CreateBoard',
      gameId,
      actorId,
      boardId: asBoardId('board-1'),
      name: 'Downport',
      width: 1000,
      height: 800,
      scale: 50
    })

    assert.equal(rejected.ok, false)
    assert.equal(storage.records.size, 0)
  })

  it('throws an internal publication error when checkpoint recovery fails after append', async () => {
    const storage = createMemoryStorage()
    const get = storage.get.bind(storage)

    storage.get = async <T = unknown>(key: string): Promise<T | undefined> => {
      const value = await get<T>(key)

      if (key === `checkpoint:${gameId}` && value) {
        const checkpoint = value as unknown as {
          state: {
            name: string
          }
        }

        return {
          ...checkpoint,
          state: {
            ...checkpoint.state,
            name: `${checkpoint.state.name} (corrupt)`
          }
        } as T
      }

      return value
    }

    let thrown: unknown = null
    try {
      await publish(storage, createGameCommand())
    } catch (error) {
      thrown = error
    }

    assert.equal(thrown instanceof CommandPublicationError, true)
    assert.equal(
      (thrown as CommandPublicationError).code,
      'projection_mismatch'
    )
    assert.equal(
      (thrown as CommandPublicationError).message,
      'Stored event stream does not match live projection'
    )
    assert.equal((await readEventStream(storage, gameId)).length, 1)
  })

  it('throws an internal publication error when stored event parity fails after append', async () => {
    const storage = createMemoryStorage()
    await publish(storage, createGameCommand())

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
      await publish(storage, createBoardCommand())
    } catch (error) {
      thrown = error
    }

    assert.equal(thrown instanceof CommandPublicationError, true)
    assert.equal(
      (thrown as CommandPublicationError).code,
      'projection_mismatch'
    )
    assert.equal(
      (thrown as CommandPublicationError).message,
      'Stored event stream does not match live projection'
    )

    storage.get = get
    assert.equal((await readEventStream(storage, gameId)).length, 2)
  })

  it('creates a game, checkpoints it, and projects tail events from storage', async () => {
    const storage = createMemoryStorage()

    const created = await publish(storage, createGameCommand())

    assert.equal(created.ok, true)
    if (!created.ok) return
    assert.equal(created.value.state.eventSeq, 1)
    assert.equal((await readCheckpoint(storage, gameId))?.seq, 1)

    const board = await publish(storage, {
      type: 'CreateBoard',
      gameId,
      actorId,
      boardId: asBoardId('board-1'),
      name: 'Downport',
      imageAssetId: 'board-image-1',
      url: '/assets/boards/downport.png',
      width: 1000,
      height: 800,
      scale: 50
    })

    assert.equal(board.ok, true)
    const projected = await getProjectedGameState(storage, gameId)
    assert.equal(projected?.eventSeq, 2)
    assert.equal(projected?.boards[asBoardId('board-1')]?.name, 'Downport')
    assert.equal(
      projected?.boards[asBoardId('board-1')]?.imageAssetId,
      'board-image-1'
    )
    assert.equal(
      projected?.boards[asBoardId('board-1')]?.url,
      '/assets/boards/downport.png'
    )
  })

  it('rejects stale expected sequence numbers before mutating storage', async () => {
    const storage = createMemoryStorage()
    await publish(storage, createGameCommand())
    await publish(storage, createBoardCommand())
    await publish(storage, {
      type: 'CreatePiece',
      gameId,
      actorId,
      pieceId: asPieceId('piece-1'),
      boardId: asBoardId('board-1'),
      name: 'Scout',
      x: 10,
      y: 10
    })

    const stale = await publish(storage, {
      type: 'MovePiece',
      gameId,
      actorId,
      pieceId: asPieceId('piece-1'),
      x: 20,
      y: 20,
      expectedSeq: 1
    })

    assert.equal(stale.ok, false)
    if (stale.ok) return
    assert.equal(stale.error.code, 'stale_command')
    assert.equal((await readEventStream(storage, gameId)).length, 3)
  })

  it('rejects stale expected sequence numbers on character sheet edits', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-1')
    await publish(storage, createGameCommand())
    await publish(storage, {
      type: 'CreateCharacter',
      gameId,
      actorId,
      characterId,
      characterType: 'PLAYER',
      name: 'Scout'
    })

    const stale = await publish(storage, {
      type: 'UpdateCharacterSheet',
      gameId,
      actorId,
      characterId,
      expectedSeq: 1,
      notes: 'This should not append'
    })

    assert.equal(stale.ok, false)
    if (stale.ok) return
    assert.equal(stale.error.code, 'stale_command')
    assert.equal((await readEventStream(storage, gameId)).length, 2)
  })

  it('publishes and projects character creation events', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-1')
    await publish(storage, createGameCommand())
    await publish(storage, {
      type: 'CreateCharacter',
      gameId,
      actorId,
      characterId,
      characterType: 'PLAYER',
      name: 'Scout'
    })

    const started = await publish(storage, {
      type: 'StartCharacterCreation',
      gameId,
      actorId,
      characterId,
      expectedSeq: 2
    })

    assert.equal(started.ok, true)
    if (!started.ok) return
    assert.deepEqual(started.value.liveActivities, [
      {
        id: 'game-1:3',
        eventId: 'game-1:3',
        gameId,
        seq: 3,
        actorId,
        createdAt: started.value.liveActivities[0]?.createdAt,
        type: 'characterCreation',
        characterId,
        transition: 'STARTED',
        status: 'CHARACTERISTICS',
        creationComplete: false
      }
    ])
    assert.equal(
      started.value.state.characters[characterId]?.creation?.state.status,
      'CHARACTERISTICS'
    )

    const advanced = await publish(storage, {
      type: 'AdvanceCharacterCreation',
      gameId,
      actorId,
      characterId,
      expectedSeq: 3,
      creationEvent: { type: 'SET_CHARACTERISTICS' }
    })

    assert.equal(advanced.ok, true)
    if (!advanced.ok) return
    assert.equal(
      advanced.value.state.characters[characterId]?.creation?.state.status,
      'HOMEWORLD'
    )

    const homeworldSet = await publish(storage, {
      type: 'SetCharacterCreationHomeworld',
      gameId,
      actorId,
      characterId,
      expectedSeq: 4,
      homeworld: {
        name: 'Regina',
        lawLevel: 'No Law',
        tradeCodes: ['Asteroid', 'Industrial']
      }
    })

    assert.equal(homeworldSet.ok, true)
    if (!homeworldSet.ok) return
    assert.deepEqual(
      homeworldSet.value.state.characters[characterId]?.creation
        ?.backgroundSkills,
      ['Zero-G-0', 'Broker-0']
    )
    assert.deepEqual(
      homeworldSet.value.state.characters[characterId]?.creation
        ?.pendingCascadeSkills,
      ['Gun Combat-0']
    )

    const resolvedCascade = await publish(storage, {
      type: 'ResolveCharacterCreationCascadeSkill',
      gameId,
      actorId,
      characterId,
      expectedSeq: 5,
      cascadeSkill: 'Gun Combat-0',
      selection: 'Slug Rifle'
    })

    assert.equal(resolvedCascade.ok, true)
    if (!resolvedCascade.ok) return
    assert.deepEqual(
      resolvedCascade.value.state.characters[characterId]?.creation
        ?.backgroundSkills,
      ['Zero-G-0', 'Broker-0', 'Slug Rifle-0']
    )

    const homeworld = await publish(storage, {
      type: 'AdvanceCharacterCreation',
      gameId,
      actorId,
      characterId,
      expectedSeq: 6,
      creationEvent: { type: 'COMPLETE_HOMEWORLD' }
    })

    assert.equal(homeworld.ok, true)
    if (!homeworld.ok) return

    const term = await publish(storage, {
      type: 'StartCharacterCareerTerm',
      gameId,
      actorId,
      characterId,
      expectedSeq: 7,
      career: 'Scout'
    })

    assert.equal(term.ok, true)
    if (!term.ok) return
    const creation = term.value.state.characters[characterId]?.creation
    assert.deepEqual(
      creation?.terms.map((entry) => entry.career),
      ['Scout']
    )
    assert.deepEqual(creation?.careers, [{ name: 'Scout', rank: 0 }])
    assert.equal(term.value.state.eventSeq, 8)

    const recovered = await getProjectedGameState(storage, gameId)
    assert.deepEqual(recovered?.characters[characterId]?.creation?.homeworld, {
      name: 'Regina',
      lawLevel: 'No Law',
      tradeCodes: ['Asteroid', 'Industrial']
    })
    assert.deepEqual(
      recovered?.characters[characterId]?.creation?.backgroundSkills,
      ['Zero-G-0', 'Broker-0', 'Slug Rifle-0']
    )
  })

  it('checkpoints when character creation becomes playable', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-1')
    await publish(storage, createGameCommand())
    await publish(storage, {
      type: 'CreateCharacter',
      gameId,
      actorId,
      characterId,
      characterType: 'PLAYER',
      name: 'Scout'
    })
    await publish(storage, {
      type: 'StartCharacterCreation',
      gameId,
      actorId,
      characterId
    })

    const advance = async (
      creationEvent: Extract<
        Command,
        { type: 'AdvanceCharacterCreation' }
      >['creationEvent']
    ) =>
      publish(storage, {
        type: 'AdvanceCharacterCreation',
        gameId,
        actorId,
        characterId,
        creationEvent
      })

    await advance({ type: 'SET_CHARACTERISTICS' })
    await publish(storage, {
      type: 'SetCharacterCreationHomeworld',
      gameId,
      actorId,
      characterId,
      homeworld: {
        name: 'Regina',
        lawLevel: 'No Law',
        tradeCodes: ['Asteroid', 'Industrial']
      }
    })
    await publish(storage, {
      type: 'ResolveCharacterCreationCascadeSkill',
      gameId,
      actorId,
      characterId,
      cascadeSkill: 'Gun Combat-0',
      selection: 'Slug Rifle'
    })
    await advance({ type: 'COMPLETE_HOMEWORLD' })
    await publish(storage, {
      type: 'StartCharacterCareerTerm',
      gameId,
      actorId,
      characterId,
      career: 'Scout'
    })
    await advance({ type: 'SELECT_CAREER', isNewCareer: true })
    await advance({ type: 'COMPLETE_BASIC_TRAINING' })
    await advance({
      type: 'SURVIVAL_PASSED',
      canCommission: false,
      canAdvance: false
    })
    await advance({ type: 'COMPLETE_SKILLS' })
    await advance({ type: 'COMPLETE_AGING' })
    await advance({ type: 'LEAVE_CAREER' })
    await advance({ type: 'FINISH_MUSTERING' })
    const completed = await advance({ type: 'CREATION_COMPLETE' })

    assert.equal(completed.ok, true)
    if (!completed.ok) return
    assert.equal(
      completed.value.state.characters[characterId]?.creation?.state.status,
      'PLAYABLE'
    )
    assert.equal((await readCheckpoint(storage, gameId))?.seq, 16)
  })

  it('publishes final character creation sheets only after playable', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-1')
    await publish(storage, createGameCommand())
    await publish(storage, {
      type: 'CreateCharacter',
      gameId,
      actorId,
      characterId,
      characterType: 'PLAYER',
      name: 'Scout'
    })
    await publish(storage, {
      type: 'StartCharacterCreation',
      gameId,
      actorId,
      characterId
    })

    const early = await publish(storage, {
      type: 'FinalizeCharacterCreation',
      gameId,
      actorId,
      characterId,
      age: 34,
      characteristics: {
        str: 7,
        dex: 8,
        end: 7,
        int: 9,
        edu: 8,
        soc: 6
      },
      skills: ['Pilot-1'],
      equipment: [],
      credits: 1200,
      notes: 'Too early.'
    })

    assert.equal(early.ok, false)
    if (early.ok) return
    assert.equal(early.error.code, 'invalid_command')

    const advance = async (
      creationEvent: Extract<
        Command,
        { type: 'AdvanceCharacterCreation' }
      >['creationEvent']
    ) =>
      publish(storage, {
        type: 'AdvanceCharacterCreation',
        gameId,
        actorId,
        characterId,
        creationEvent
      })

    await advance({ type: 'SET_CHARACTERISTICS' })
    await publish(storage, {
      type: 'SetCharacterCreationHomeworld',
      gameId,
      actorId,
      characterId,
      homeworld: {
        name: 'Regina',
        lawLevel: 'No Law',
        tradeCodes: ['Asteroid', 'Industrial']
      }
    })
    await publish(storage, {
      type: 'ResolveCharacterCreationCascadeSkill',
      gameId,
      actorId,
      characterId,
      cascadeSkill: 'Gun Combat-0',
      selection: 'Slug Rifle'
    })
    await advance({ type: 'COMPLETE_HOMEWORLD' })
    await publish(storage, {
      type: 'StartCharacterCareerTerm',
      gameId,
      actorId,
      characterId,
      career: 'Scout'
    })
    await advance({ type: 'SELECT_CAREER', isNewCareer: true })
    await advance({ type: 'COMPLETE_BASIC_TRAINING' })
    await advance({
      type: 'SURVIVAL_PASSED',
      canCommission: false,
      canAdvance: false
    })
    await advance({ type: 'COMPLETE_SKILLS' })
    await advance({ type: 'COMPLETE_AGING' })
    await advance({ type: 'LEAVE_CAREER' })
    await advance({ type: 'FINISH_MUSTERING' })
    await advance({ type: 'CREATION_COMPLETE' })

    const finalized = await publish(storage, {
      type: 'FinalizeCharacterCreation',
      gameId,
      actorId,
      characterId,
      age: 34,
      characteristics: {
        str: 7,
        dex: 8,
        end: 7,
        int: 9,
        edu: 8,
        soc: 6
      },
      skills: ['Pilot-1', 'Vacc Suit-0'],
      equipment: [{ name: 'Vacc suit', quantity: 1, notes: 'Carried' }],
      credits: 1200,
      notes: 'Final scout.'
    })

    assert.equal(finalized.ok, true)
    if (!finalized.ok) return
    const character = finalized.value.state.characters[characterId]
    assert.equal(character?.age, 34)
    assert.deepEqual(character?.skills, ['Pilot-1', 'Vacc Suit-0'])
    assert.equal(character?.notes, 'Final scout.')
    assert.equal((await readEventStream(storage, gameId)).length, 17)
  })

  it('rejects stale expected sequence numbers on character creation commands', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-1')
    await publish(storage, createGameCommand())
    await publish(storage, {
      type: 'CreateCharacter',
      gameId,
      actorId,
      characterId,
      characterType: 'PLAYER',
      name: 'Scout'
    })

    const stale = await publish(storage, {
      type: 'StartCharacterCreation',
      gameId,
      actorId,
      characterId,
      expectedSeq: 1
    })

    assert.equal(stale.ok, false)
    if (stale.ok) return
    assert.equal(stale.error.code, 'stale_command')
    assert.equal((await readEventStream(storage, gameId)).length, 2)
  })

  it('rejects stale expected sequence numbers on homeworld/background commands', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-1')
    await publish(storage, createGameCommand())
    await publish(storage, {
      type: 'CreateCharacter',
      gameId,
      actorId,
      characterId,
      characterType: 'PLAYER',
      name: 'Scout'
    })
    await publish(storage, {
      type: 'StartCharacterCreation',
      gameId,
      actorId,
      characterId
    })
    await publish(storage, {
      type: 'AdvanceCharacterCreation',
      gameId,
      actorId,
      characterId,
      creationEvent: { type: 'SET_CHARACTERISTICS' }
    })

    const stale = await publish(storage, {
      type: 'SetCharacterCreationHomeworld',
      gameId,
      actorId,
      characterId,
      expectedSeq: 3,
      homeworld: {
        name: 'Regina',
        lawLevel: 'No Law',
        tradeCodes: ['Asteroid']
      }
    })

    assert.equal(stale.ok, false)
    if (stale.ok) return
    assert.equal(stale.error.code, 'stale_command')
    assert.equal((await readEventStream(storage, gameId)).length, 4)
  })

  it('rejects character creation commands for missing characters', async () => {
    const storage = createMemoryStorage()
    await publish(storage, createGameCommand())

    const rejected = await publish(storage, {
      type: 'StartCharacterCreation',
      gameId,
      actorId,
      characterId: asCharacterId('missing-character')
    })

    assert.equal(rejected.ok, false)
    if (rejected.ok) return
    assert.equal(rejected.error.code, 'missing_entity')
    assert.equal((await readEventStream(storage, gameId)).length, 1)
  })

  it('rejects invalid character creation transitions without mutating storage', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-1')
    await publish(storage, createGameCommand())
    await publish(storage, {
      type: 'CreateCharacter',
      gameId,
      actorId,
      characterId,
      characterType: 'PLAYER',
      name: 'Scout'
    })
    await publish(storage, {
      type: 'StartCharacterCreation',
      gameId,
      actorId,
      characterId
    })

    const rejected = await publish(storage, {
      type: 'AdvanceCharacterCreation',
      gameId,
      actorId,
      characterId,
      creationEvent: { type: 'COMPLETE_HOMEWORLD' }
    })

    assert.equal(rejected.ok, false)
    if (rejected.ok) return
    assert.equal(rejected.error.code, 'invalid_command')
    assert.equal(
      rejected.error.message,
      'COMPLETE_HOMEWORLD is not valid from CHARACTERISTICS'
    )
    assert.equal((await readEventStream(storage, gameId)).length, 3)
  })

  it('rejects career selection before background choices are complete', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-1')
    await publish(storage, createGameCommand())
    await publish(storage, {
      type: 'CreateCharacter',
      gameId,
      actorId,
      characterId,
      characterType: 'PLAYER',
      name: 'Scout'
    })
    await publish(storage, {
      type: 'StartCharacterCreation',
      gameId,
      actorId,
      characterId
    })
    await publish(storage, {
      type: 'AdvanceCharacterCreation',
      gameId,
      actorId,
      characterId,
      creationEvent: { type: 'SET_CHARACTERISTICS' }
    })
    await publish(storage, {
      type: 'SetCharacterCreationHomeworld',
      gameId,
      actorId,
      characterId,
      homeworld: {
        name: 'Regina',
        lawLevel: 'No Law',
        tradeCodes: ['Asteroid']
      }
    })

    const rejected = await publish(storage, {
      type: 'AdvanceCharacterCreation',
      gameId,
      actorId,
      characterId,
      creationEvent: { type: 'COMPLETE_HOMEWORLD' }
    })

    assert.equal(rejected.ok, false)
    if (rejected.ok) return
    assert.equal(rejected.error.code, 'invalid_command')
    assert.equal(
      rejected.error.message,
      'Background choices must be complete before career selection'
    )
    assert.equal((await readEventStream(storage, gameId)).length, 5)
  })

  it('rejects career term starts outside career selection', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-1')
    await publish(storage, createGameCommand())
    await publish(storage, {
      type: 'CreateCharacter',
      gameId,
      actorId,
      characterId,
      characterType: 'PLAYER',
      name: 'Scout'
    })
    await publish(storage, {
      type: 'StartCharacterCreation',
      gameId,
      actorId,
      characterId
    })

    const rejected = await publish(storage, {
      type: 'StartCharacterCareerTerm',
      gameId,
      actorId,
      characterId,
      career: 'Scout'
    })

    assert.equal(rejected.ok, false)
    if (rejected.ok) return
    assert.equal(rejected.error.code, 'invalid_command')
    assert.equal(
      rejected.error.message,
      'Career terms cannot start from CHARACTERISTICS'
    )
    assert.equal((await readEventStream(storage, gameId)).length, 3)
  })

  it('publishes and projects custom piece dimensions', async () => {
    const storage = createMemoryStorage()
    const pieceId = asPieceId('door-1')
    await publish(storage, createGameCommand())
    await publish(storage, createBoardCommand())

    const created = await publish(storage, {
      type: 'CreatePiece',
      gameId,
      actorId,
      pieceId,
      boardId: asBoardId('board-1'),
      name: 'Airlock',
      x: 10,
      y: 10,
      width: 50,
      height: 100,
      scale: 1.5
    })

    assert.equal(created.ok, true)
    if (!created.ok) return
    assert.equal(created.value.state.pieces[pieceId]?.width, 50)
    assert.equal(created.value.state.pieces[pieceId]?.height, 100)
    assert.equal(created.value.state.pieces[pieceId]?.scale, 1.5)
    const storedEvent = (await readEventStream(storage, gameId))[2]?.event
    assert.equal(storedEvent?.type, 'PieceCreated')
    if (storedEvent?.type !== 'PieceCreated') return
    assert.equal(storedEvent.width, 50)
    assert.equal(storedEvent.height, 100)
    assert.equal(storedEvent.scale, 1.5)
  })

  it('rejects invalid custom piece dimensions without mutating storage', async () => {
    const storage = createMemoryStorage()
    await publish(storage, createGameCommand())
    await publish(storage, createBoardCommand())

    const rejected = await publish(storage, {
      type: 'CreatePiece',
      gameId,
      actorId,
      pieceId: asPieceId('door-1'),
      boardId: asBoardId('board-1'),
      name: 'Airlock',
      x: 10,
      y: 10,
      width: 50,
      height: 0,
      scale: 1
    })

    assert.equal(rejected.ok, false)
    if (rejected.ok) return
    assert.equal(rejected.error.code, 'invalid_command')
    assert.equal(rejected.error.message, 'height must be positive')
    assert.equal((await readEventStream(storage, gameId)).length, 2)
  })

  it('updates manual character sheet fields and preserves omitted fields', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-1')
    await publish(storage, createGameCommand())
    await publish(storage, {
      type: 'CreateCharacter',
      gameId,
      actorId,
      characterId,
      characterType: 'PLAYER',
      name: 'Scout'
    })

    const firstUpdate = await publish(storage, {
      type: 'UpdateCharacterSheet',
      gameId,
      actorId,
      characterId,
      notes: 'Scout service term notes',
      age: 34,
      characteristics: {
        str: 7,
        dex: 9
      },
      skills: ['Pilot 1'],
      equipment: [{ name: 'Vacc suit', quantity: 1, notes: '' }],
      credits: 1200
    })

    assert.equal(firstUpdate.ok, true)
    const secondUpdate = await publish(storage, {
      type: 'UpdateCharacterSheet',
      gameId,
      actorId,
      characterId,
      characteristics: {
        dex: null
      },
      credits: 900
    })

    assert.equal(secondUpdate.ok, true)
    if (!secondUpdate.ok) return
    const character = secondUpdate.value.state.characters[characterId]
    assert.equal(character?.notes, 'Scout service term notes')
    assert.equal(character?.age, 34)
    assert.equal(character?.characteristics.str, 7)
    assert.equal(character?.characteristics.dex, null)
    assert.deepEqual(character?.skills, ['Pilot 1'])
    assert.deepEqual(character?.equipment, [
      { name: 'Vacc suit', quantity: 1, notes: '' }
    ])
    assert.equal(character?.credits, 900)
  })

  it('rejects non-string character sheet notes during publication', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-1')
    await publish(storage, createGameCommand())
    await publish(storage, {
      type: 'CreateCharacter',
      gameId,
      actorId,
      characterId,
      characterType: 'PLAYER',
      name: 'Scout'
    })

    const rejected = await publish(storage, {
      type: 'UpdateCharacterSheet',
      gameId,
      actorId,
      characterId,
      notes: 123
    } as unknown as Command)

    assert.equal(rejected.ok, false)
    if (rejected.ok) return
    assert.equal(rejected.error.code, 'invalid_command')
    assert.equal(rejected.error.message, 'notes must be a string')
  })

  it('rejects empty character sheet skills during publication', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-1')
    await publish(storage, createGameCommand())
    await publish(storage, {
      type: 'CreateCharacter',
      gameId,
      actorId,
      characterId,
      characterType: 'PLAYER',
      name: 'Scout'
    })

    const rejected = await publish(storage, {
      type: 'UpdateCharacterSheet',
      gameId,
      actorId,
      characterId,
      skills: ['Pilot 1', '  ']
    })

    assert.equal(rejected.ok, false)
    if (rejected.ok) return
    assert.equal(rejected.error.code, 'invalid_command')
    assert.equal(rejected.error.message, 'skills[1] cannot be empty')
    assert.equal((await readEventStream(storage, gameId)).length, 2)
  })

  it('rejects empty character sheet equipment names during publication', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-1')
    await publish(storage, createGameCommand())
    await publish(storage, {
      type: 'CreateCharacter',
      gameId,
      actorId,
      characterId,
      characterType: 'PLAYER',
      name: 'Scout'
    })

    const rejected = await publish(storage, {
      type: 'UpdateCharacterSheet',
      gameId,
      actorId,
      characterId,
      equipment: [{ name: '  ', quantity: 1, notes: '' }]
    })

    assert.equal(rejected.ok, false)
    if (rejected.ok) return
    assert.equal(rejected.error.code, 'invalid_command')
    assert.equal(rejected.error.message, 'equipment[0].name cannot be empty')
    assert.equal((await readEventStream(storage, gameId)).length, 2)
  })

  it('validates piece character links during publication', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-1')
    await publish(storage, createGameCommand())
    await publish(storage, createBoardCommand())

    const missingCharacter = await publish(storage, {
      type: 'CreatePiece',
      gameId,
      actorId,
      pieceId: asPieceId('piece-1'),
      boardId: asBoardId('board-1'),
      characterId,
      name: 'Scout',
      x: 10,
      y: 10
    })

    assert.equal(missingCharacter.ok, false)
    if (missingCharacter.ok) return
    assert.equal(missingCharacter.error.code, 'missing_entity')
    assert.equal((await readEventStream(storage, gameId)).length, 2)

    await publish(storage, {
      type: 'CreateCharacter',
      gameId,
      actorId,
      characterId,
      characterType: 'PLAYER',
      name: 'Scout'
    })

    const linkedPiece = await publish(storage, {
      type: 'CreatePiece',
      gameId,
      actorId,
      pieceId: asPieceId('piece-1'),
      boardId: asBoardId('board-1'),
      characterId,
      name: 'Scout',
      x: 10,
      y: 10
    })

    assert.equal(linkedPiece.ok, true)
    if (!linkedPiece.ok) return
    assert.equal(
      linkedPiece.value.state.pieces[asPieceId('piece-1')]?.characterId,
      characterId
    )
  })

  it('selects an existing board and publishes the projected board selection', async () => {
    const storage = createMemoryStorage()
    await publish(storage, createGameCommand())
    await publish(storage, createBoardCommand(asBoardId('board-1')))
    await publish(storage, createBoardCommand(asBoardId('board-2')))

    const selected = await publish(storage, {
      type: 'SelectBoard',
      gameId,
      actorId,
      boardId: asBoardId('board-2')
    })

    assert.equal(selected.ok, true)
    if (!selected.ok) return
    assert.equal(selected.value.state.selectedBoardId, asBoardId('board-2'))
    assert.equal(selected.value.state.eventSeq, 4)

    const storedEvent = (await readEventStream(storage, gameId))[3]?.event
    assert.deepEqual(storedEvent, {
      type: 'BoardSelected',
      boardId: asBoardId('board-2')
    })
  })

  it('rejects board selection when the board does not exist', async () => {
    const storage = createMemoryStorage()
    await publish(storage, createGameCommand())

    const selected = await publish(storage, {
      type: 'SelectBoard',
      gameId,
      actorId,
      boardId: asBoardId('missing-board')
    })

    assert.equal(selected.ok, false)
    if (selected.ok) return
    assert.equal(selected.error.code, 'missing_entity')
    assert.equal((await readEventStream(storage, gameId)).length, 1)
  })

  it('publishes door state changes against existing boards', async () => {
    const storage = createMemoryStorage()
    await publish(storage, createGameCommand())
    await publish(storage, createBoardCommand(asBoardId('board-1')))

    const changed = await publish(storage, {
      type: 'SetDoorOpen',
      gameId,
      actorId,
      boardId: asBoardId('board-1'),
      doorId: 'iris-1',
      open: true
    })

    assert.equal(changed.ok, true)
    if (!changed.ok) return
    assert.deepEqual(changed.value.state.boards[asBoardId('board-1')]?.doors, {
      'iris-1': {
        id: 'iris-1',
        open: true
      }
    })

    const storedEvent = (await readEventStream(storage, gameId))[2]?.event
    assert.deepEqual(storedEvent, {
      type: 'DoorStateChanged',
      boardId: asBoardId('board-1'),
      doorId: 'iris-1',
      open: true
    })
  })

  it('rejects door state changes when the board does not exist', async () => {
    const storage = createMemoryStorage()
    await publish(storage, createGameCommand())

    const changed = await publish(storage, {
      type: 'SetDoorOpen',
      gameId,
      actorId,
      boardId: asBoardId('missing-board'),
      doorId: 'iris-1',
      open: true
    })

    assert.equal(changed.ok, false)
    if (changed.ok) return
    assert.equal(changed.error.code, 'missing_entity')
    assert.equal((await readEventStream(storage, gameId)).length, 1)
  })

  it('rejects board selection when the game has not been created', async () => {
    const storage = createMemoryStorage()

    const selected = await publish(storage, {
      type: 'SelectBoard',
      gameId,
      actorId,
      boardId: asBoardId('board-1')
    })

    assert.equal(selected.ok, false)
    if (selected.ok) return
    assert.equal(selected.error.code, 'game_not_found')
    assert.equal(storage.records.size, 0)
  })

  it('uses the stored room seed and event sequence for deterministic dice events', async () => {
    const first = createMemoryStorage()
    const second = createMemoryStorage()
    await first.put(gameSeedKey(gameId), 12345)
    await second.put(gameSeedKey(gameId), 12345)

    for (const storage of [first, second]) {
      await publish(storage, createGameCommand())
      await publish(storage, {
        type: 'RollDice',
        gameId,
        actorId,
        expression: '2d6+1',
        reason: 'skill check'
      })
    }

    const firstDice = (await readEventStream(first, gameId))[1]?.event
    const secondDice = (await readEventStream(second, gameId))[1]?.event

    assert.equal(firstDice?.type, 'DiceRolled')
    assert.deepEqual(firstDice, secondDice)
  })
})
