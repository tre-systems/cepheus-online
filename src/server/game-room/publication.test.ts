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
import { runCommandPublication } from './publication'
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

    const homeworld = await publish(storage, {
      type: 'AdvanceCharacterCreation',
      gameId,
      actorId,
      characterId,
      expectedSeq: 4,
      creationEvent: { type: 'COMPLETE_HOMEWORLD' }
    })

    assert.equal(homeworld.ok, true)
    if (!homeworld.ok) return

    const term = await publish(storage, {
      type: 'StartCharacterCareerTerm',
      gameId,
      actorId,
      characterId,
      expectedSeq: 5,
      career: 'Scout'
    })

    assert.equal(term.ok, true)
    if (!term.ok) return
    const creation = term.value.state.characters[characterId]?.creation
    assert.deepEqual(creation?.terms.map((entry) => entry.career), ['Scout'])
    assert.deepEqual(creation?.careers, [{ name: 'Scout', rank: 0 }])
    assert.equal(term.value.state.eventSeq, 6)
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
    assert.equal((await readCheckpoint(storage, gameId))?.seq, 14)
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
