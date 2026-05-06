import * as assert from 'node:assert/strict'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, it } from 'node:test'

import {
  MAX_LIVE_ACTIVITY_ROLLS,
  MAX_LIVE_ACTIVITY_TEXT_LENGTH
} from './live-activity'
import { decodeClientMessage, decodeCommand } from './protocol'
import type { CommandErrorCode, ServerMessage } from './protocol'

type ValidCommandEnvelopeFixture = {
  readonly name: string
  readonly message: unknown
  readonly commandType: string
  readonly expectedSeq?: number
}

type InvalidMalformedMessageFixture = {
  readonly name: string
  readonly message: unknown
  readonly errorCode: CommandErrorCode
  readonly errorMessage: string
}

type LiveActivityServerMessageFixture = {
  readonly name: string
  readonly message: ServerMessage
  readonly maxSerializedBytes: number
}

type CommandErrorServerMessageFixture = {
  readonly name: string
  readonly message: ServerMessage
}

type ViewerFilteredServerMessageFixture = {
  readonly name: string
  readonly viewerRole: 'REFEREE' | 'PLAYER' | 'SPECTATOR'
  readonly expectedPieceIds: string[]
  readonly message: ServerMessage
}

const loadFixture = <T>(name: string): T => {
  const file = path.join('src', 'shared', '__fixtures__', 'protocol', name)

  return JSON.parse(fs.readFileSync(file, 'utf8')) as T
}

const serializedBytes = (value: unknown): number =>
  new TextEncoder().encode(JSON.stringify(value)).length

const serverFixtureLiveActivities = () =>
  liveActivityServerMessageFixtures.flatMap((fixture) => {
    const { message } = fixture
    if (message.type !== 'roomState' && message.type !== 'commandAccepted') {
      return []
    }

    return message.liveActivities ?? []
  })

const validCommandEnvelopeFixtures = loadFixture<ValidCommandEnvelopeFixture[]>(
  'valid-command-envelopes.json'
)

const invalidMalformedMessageFixtures = loadFixture<
  InvalidMalformedMessageFixture[]
>('invalid-malformed-messages.json')

const liveActivityServerMessageFixtures = loadFixture<
  LiveActivityServerMessageFixture[]
>('live-activity-server-messages.json')

const commandErrorServerMessageFixtures = loadFixture<
  CommandErrorServerMessageFixture[]
>('command-error-server-messages.json')

const viewerFilteredServerMessageFixtures = loadFixture<
  ViewerFilteredServerMessageFixture[]
>('viewer-filtered-server-messages.json')

describe('protocol validation', () => {
  it('exposes stable command error categories for client branching', () => {
    const categories = [
      'stale_command',
      'invalid_command',
      'missing_entity',
      'not_allowed',
      'duplicate_entity',
      'game_exists'
    ] satisfies CommandErrorCode[]

    assert.deepEqual(categories, [
      'stale_command',
      'invalid_command',
      'missing_entity',
      'not_allowed',
      'duplicate_entity',
      'game_exists'
    ])
  })

  for (const fixture of validCommandEnvelopeFixtures) {
    it(`accepts fixture: ${fixture.name}`, () => {
      const result = decodeClientMessage(fixture.message)

      assert.equal(result.ok, true)
      if (!result.ok) return
      assert.equal(result.value.type, 'command')
      if (result.value.type !== 'command') return
      assert.equal(result.value.command.type, fixture.commandType)
      assert.equal(result.value.command.expectedSeq, fixture.expectedSeq)
    })
  }

  for (const fixture of invalidMalformedMessageFixtures) {
    it(`rejects fixture: ${fixture.name}`, () => {
      const result = decodeClientMessage(fixture.message)

      assert.equal(result.ok, false)
      if (result.ok) return
      assert.equal(result.error.code, fixture.errorCode)
      assert.equal(result.error.message, fixture.errorMessage)
    })
  }

  for (const fixture of liveActivityServerMessageFixtures) {
    it(`covers server live activity fixture: ${fixture.name}`, () => {
      const { message } = fixture

      assert.equal(
        message.type === 'roomState' || message.type === 'commandAccepted',
        true
      )
      if (message.type !== 'roomState' && message.type !== 'commandAccepted') {
        return
      }

      assert.equal(Array.isArray(message.liveActivities), true)
      assert.equal((message.liveActivities?.length ?? 0) > 0, true)
      assert.equal(serializedBytes(message) <= fixture.maxSerializedBytes, true)
      assert.equal(JSON.stringify(message).includes('creationEvent'), false)
    })
  }

  for (const fixture of commandErrorServerMessageFixtures) {
    it(`covers command error server message fixture: ${fixture.name}`, () => {
      const { message } = fixture

      if (message.type === 'commandRejected') {
        assert.equal(typeof message.error.message, 'string')
        assert.equal(message.error.message.length > 0, true)
        assert.equal(/^req-/.test(message.requestId), true)
        assert.equal(
          [
            'stale_command',
            'invalid_command',
            'not_allowed',
            'missing_entity'
          ].includes(message.error.code),
          true
        )
        assert.equal(Number.isInteger(message.eventSeq), true)
        return
      }

      if (message.type === 'error') {
        assert.equal(typeof message.error.message, 'string')
        assert.equal(message.error.message.length > 0, true)
        assert.equal(
          ['projection_mismatch', 'wrong_room'].includes(message.error.code),
          true
        )
        return
      }

      assert.equal(
        ['commandRejected', 'error'].includes(message.type),
        true,
        `Unexpected error fixture message type: ${message.type}`
      )
    })
  }

  for (const fixture of viewerFilteredServerMessageFixtures) {
    it(`covers viewer-filtered server message fixture: ${fixture.name}`, () => {
      const { message } = fixture

      assert.equal(message.type, 'roomState')
      if (message.type !== 'roomState') return
      assert.equal(message.state !== null, true)
      if (!message.state) return

      assert.equal(message.eventSeq, message.state.eventSeq)
      assert.equal(message.state.selectedBoardId, 'docking-bay')
      assert.deepEqual(
        Object.keys(message.state.pieces).sort(),
        [...fixture.expectedPieceIds].sort()
      )

      const visibilities = Object.values(message.state.pieces).map(
        (piece) => piece.visibility
      )
      if (fixture.viewerRole === 'PLAYER') {
        assert.equal(visibilities.includes('HIDDEN'), false)
        assert.equal(visibilities.includes('PREVIEW'), true)
      }
      if (fixture.viewerRole === 'SPECTATOR') {
        assert.deepEqual(visibilities, ['VISIBLE'])
      }
    })
  }

  it('covers telemetry-visible command rejection categories in server fixtures', () => {
    const rejectedCodes = commandErrorServerMessageFixtures.flatMap(
      ({ message }) =>
        message.type === 'commandRejected' ? [message.error.code] : []
    )

    assert.deepEqual(rejectedCodes.sort(), [
      'invalid_command',
      'missing_entity',
      'not_allowed',
      'stale_command'
    ])
  })

  it('covers supported server error categories in server fixtures', () => {
    const errorCodes = commandErrorServerMessageFixtures.flatMap(
      ({ message }) => {
        if (message.type !== 'error') return []

        return [message.error.code]
      }
    )

    assert.deepEqual(errorCodes.sort(), ['projection_mismatch', 'wrong_room'])
  })

  it('covers bounded dice activity in server message fixtures', () => {
    const activity = serverFixtureLiveActivities().find(
      (candidate) => candidate.type === 'diceRoll' && candidate.rollsOmitted
    )

    assert.equal(activity?.type, 'diceRoll')
    if (activity?.type !== 'diceRoll') return
    assert.equal(activity.expression.length, MAX_LIVE_ACTIVITY_TEXT_LENGTH)
    assert.equal(activity.expression.endsWith('...'), true)
    assert.equal(activity.reason.length, MAX_LIVE_ACTIVITY_TEXT_LENGTH)
    assert.equal(activity.reason.endsWith('...'), true)
    assert.equal(activity.rolls.length, MAX_LIVE_ACTIVITY_ROLLS)
    assert.equal(activity.rollsOmitted, 5)
  })

  it('covers character creation activity in command accepted fixtures', () => {
    const commandAcceptedFixture = liveActivityServerMessageFixtures.find(
      (fixture) => fixture.message.type === 'commandAccepted'
    )

    assert.equal(commandAcceptedFixture?.message.type, 'commandAccepted')
    if (commandAcceptedFixture?.message.type !== 'commandAccepted') return
    const activity = commandAcceptedFixture.message.liveActivities?.find(
      (candidate) => candidate.type === 'characterCreation'
    )

    assert.equal(activity?.type, 'characterCreation')
    if (activity?.type !== 'characterCreation') return
    assert.equal(
      activity.details,
      'Career selected; new career; draft resolved'
    )
  })

  it('accepts a command envelope with a typed command', () => {
    const result = decodeClientMessage({
      type: 'command',
      requestId: 'req-1',
      command: {
        type: 'CreateGame',
        gameId: 'game-1',
        actorId: 'user-1',
        slug: 'game-1',
        name: 'Spinward Test'
      }
    })

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.value.type, 'command')
    if (result.value.type !== 'command') return
    assert.equal(result.value.command.type, 'CreateGame')
  })

  it('accepts optional piece image asset references', () => {
    const result = decodeClientMessage({
      type: 'command',
      requestId: 'req-2',
      command: {
        type: 'CreatePiece',
        gameId: 'game-1',
        actorId: 'user-1',
        pieceId: 'enemy-1',
        boardId: 'main-board',
        name: 'Enemy',
        imageAssetId: '/assets/counters/TroopsBlackOnGreen.png',
        x: 100,
        y: 150
      }
    })

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.value.type, 'command')
    if (result.value.type !== 'command') return
    const { command } = result.value
    assert.equal(command.type, 'CreatePiece')
    if (command.type !== 'CreatePiece') return
    assert.equal(
      command.imageAssetId,
      '/assets/counters/TroopsBlackOnGreen.png'
    )
  })

  it('accepts linked piece character references', () => {
    const result = decodeClientMessage({
      type: 'command',
      requestId: 'req-2b',
      command: {
        type: 'CreatePiece',
        gameId: 'game-1',
        actorId: 'user-1',
        pieceId: 'enemy-1',
        boardId: 'main-board',
        characterId: 'enemy-character-1',
        name: 'Enemy',
        x: 100,
        y: 150
      }
    })

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.value.type, 'command')
    if (result.value.type !== 'command') return
    const { command } = result.value
    assert.equal(command.type, 'CreatePiece')
    if (command.type !== 'CreatePiece') return
    assert.equal(command.characterId, 'enemy-character-1')
  })

  it('accepts optional custom piece dimensions', () => {
    const result = decodeClientMessage({
      type: 'command',
      requestId: 'req-2c',
      command: {
        type: 'CreatePiece',
        gameId: 'game-1',
        actorId: 'user-1',
        pieceId: 'door-1',
        boardId: 'main-board',
        name: 'Door',
        x: 100,
        y: 150,
        width: 50,
        height: 100,
        scale: 1.5
      }
    })

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.value.type, 'command')
    if (result.value.type !== 'command') return
    const { command } = result.value
    assert.equal(command.type, 'CreatePiece')
    if (command.type !== 'CreatePiece') return
    assert.equal(command.width, 50)
    assert.equal(command.height, 100)
    assert.equal(command.scale, 1.5)
  })

  it('rejects non-positive custom piece dimensions', () => {
    const result = decodeClientMessage({
      type: 'command',
      requestId: 'req-2d',
      command: {
        type: 'CreatePiece',
        gameId: 'game-1',
        actorId: 'user-1',
        pieceId: 'door-1',
        boardId: 'main-board',
        name: 'Door',
        x: 100,
        y: 150,
        width: 0
      }
    })

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(result.error.message, 'width must be positive')
  })

  it('accepts partial manual character sheet updates', () => {
    const result = decodeClientMessage({
      type: 'command',
      requestId: 'req-sheet',
      command: {
        type: 'UpdateCharacterSheet',
        gameId: 'game-1',
        actorId: 'user-1',
        characterId: 'char-1',
        notes: 'Ship shares: 2\nMortgage due monthly',
        age: 34,
        characteristics: {
          str: 7,
          dex: null
        },
        skills: ['Pilot 1', 'Gun Combat 0'],
        equipment: [
          {
            name: 'Vacc suit',
            quantity: 1
          }
        ],
        credits: 1200
      }
    })

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.value.type, 'command')
    if (result.value.type !== 'command') return
    const { command } = result.value
    assert.equal(command.type, 'UpdateCharacterSheet')
    if (command.type !== 'UpdateCharacterSheet') return
    assert.equal(command.notes, 'Ship shares: 2\nMortgage due monthly')
    assert.equal(command.age, 34)
    assert.deepEqual(command.characteristics, { str: 7, dex: null })
    assert.deepEqual(command.skills, ['Pilot 1', 'Gun Combat 0'])
    assert.deepEqual(command.equipment, [
      { name: 'Vacc suit', quantity: 1, notes: '' }
    ])
    assert.equal(command.credits, 1200)
  })

  it('accepts expected sequence on all decoded command types', () => {
    const base = { gameId: 'game-1', actorId: 'player-1', expectedSeq: 7 }
    const commands = [
      {
        type: 'CreateCharacter',
        ...base,
        characterId: 'char-1',
        characterType: 'PLAYER',
        name: 'Scout'
      },
      {
        type: 'UpdateCharacterSheet',
        ...base,
        characterId: 'char-1',
        notes: 'Ready'
      },
      {
        type: 'StartCharacterCreation',
        ...base,
        characterId: 'char-1'
      },
      {
        type: 'AdvanceCharacterCreation',
        ...base,
        characterId: 'char-1',
        creationEvent: { type: 'SET_CHARACTERISTICS' }
      },
      {
        type: 'SetCharacterCreationHomeworld',
        ...base,
        characterId: 'char-1',
        homeworld: {
          name: 'Regina',
          lawLevel: 'No Law',
          tradeCodes: ['Asteroid', 'Industrial']
        }
      },
      {
        type: 'CompleteCharacterCreationHomeworld',
        ...base,
        characterId: 'char-1'
      },
      {
        type: 'SelectCharacterCreationBackgroundSkill',
        ...base,
        characterId: 'char-1',
        skill: 'Admin'
      },
      {
        type: 'ResolveCharacterCreationCascadeSkill',
        ...base,
        characterId: 'char-1',
        cascadeSkill: 'Gun Combat-0',
        selection: 'Slug Rifle'
      },
      {
        type: 'FinalizeCharacterCreation',
        ...base,
        characterId: 'char-1',
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
        notes: 'Ready'
      },
      {
        type: 'StartCharacterCareerTerm',
        ...base,
        characterId: 'char-1',
        career: 'Scout',
        drafted: false
      },
      {
        type: 'CreateBoard',
        ...base,
        boardId: 'board-1',
        name: 'Deck',
        width: 1000,
        height: 1000,
        scale: 50
      },
      {
        type: 'SelectBoard',
        ...base,
        boardId: 'board-1'
      },
      {
        type: 'SetDoorOpen',
        ...base,
        boardId: 'board-1',
        doorId: 'iris-1',
        open: true
      },
      {
        type: 'CreatePiece',
        ...base,
        pieceId: 'piece-1',
        boardId: 'board-1',
        name: 'Scout',
        x: 10,
        y: 20
      },
      {
        type: 'MovePiece',
        ...base,
        pieceId: 'piece-1',
        x: 11,
        y: 21
      },
      {
        type: 'SetPieceVisibility',
        ...base,
        pieceId: 'piece-1',
        visibility: 'VISIBLE'
      },
      {
        type: 'SetPieceFreedom',
        ...base,
        pieceId: 'piece-1',
        freedom: 'UNLOCKED'
      },
      {
        type: 'RollDice',
        ...base,
        expression: '2d6',
        reason: 'Test'
      }
    ]

    for (const command of commands) {
      const decoded = decodeCommand(command)
      assert.equal(decoded.ok, true)
      if (!decoded.ok) continue
      assert.equal(decoded.value.expectedSeq, 7)
    }
  })

  it('accepts character creation event commands', () => {
    const result = decodeClientMessage({
      type: 'command',
      requestId: 'req-creation',
      command: {
        type: 'AdvanceCharacterCreation',
        gameId: 'game-1',
        actorId: 'user-1',
        characterId: 'char-1',
        creationEvent: {
          type: 'SURVIVAL_PASSED',
          canCommission: true,
          canAdvance: false
        }
      }
    })

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.value.type, 'command')
    if (result.value.type !== 'command') return
    const { command } = result.value
    assert.equal(command.type, 'AdvanceCharacterCreation')
    if (command.type !== 'AdvanceCharacterCreation') return
    assert.deepEqual(command.creationEvent, {
      type: 'SURVIVAL_PASSED',
      canCommission: true,
      canAdvance: false
    })
  })

  it('accepts semantic basic training completion commands', () => {
    const result = decodeCommand({
      type: 'CompleteCharacterCreationBasicTraining',
      gameId: 'game-1',
      actorId: 'user-1',
      characterId: 'char-1',
      expectedSeq: 7
    })

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.value.type, 'CompleteCharacterCreationBasicTraining')
    if (result.value.type !== 'CompleteCharacterCreationBasicTraining') return
    assert.equal(result.value.characterId, 'char-1')
    assert.equal(result.value.expectedSeq, 7)
  })

  it('accepts semantic homeworld completion commands', () => {
    const result = decodeCommand({
      type: 'CompleteCharacterCreationHomeworld',
      gameId: 'game-1',
      actorId: 'user-1',
      characterId: 'char-1',
      expectedSeq: 7
    })

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.value.type, 'CompleteCharacterCreationHomeworld')
    if (result.value.type !== 'CompleteCharacterCreationHomeworld') return
    assert.equal(result.value.characterId, 'char-1')
    assert.equal(result.value.expectedSeq, 7)
  })

  it('accepts full character creation finalization commands', () => {
    const result = decodeClientMessage({
      type: 'command',
      requestId: 'req-finalize',
      command: {
        type: 'FinalizeCharacterCreation',
        gameId: 'game-1',
        actorId: 'user-1',
        characterId: 'char-1',
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
        equipment: [{ name: 'Vacc suit', quantity: 1, notes: '' }],
        credits: 1200,
        notes: 'Generated character.'
      }
    })

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.value.type, 'command')
    if (result.value.type !== 'command') return
    const { command } = result.value
    assert.equal(command.type, 'FinalizeCharacterCreation')
    if (command.type !== 'FinalizeCharacterCreation') return
    assert.deepEqual(command.characteristics, {
      str: 7,
      dex: 8,
      end: 7,
      int: 9,
      edu: 8,
      soc: 6
    })
    assert.deepEqual(command.skills, ['Pilot-1', 'Vacc Suit-0'])
  })

  it('rejects malformed character creation event commands', () => {
    const result = decodeClientMessage({
      type: 'command',
      requestId: 'req-creation',
      command: {
        type: 'AdvanceCharacterCreation',
        gameId: 'game-1',
        actorId: 'user-1',
        characterId: 'char-1',
        creationEvent: {
          type: 'SURVIVAL_PASSED',
          canCommission: 'yes',
          canAdvance: false
        }
      }
    })

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(result.error.message, 'canCommission must be a boolean')
  })

  it('accepts character creation homeworld/background commands', () => {
    const homeworld = decodeClientMessage({
      type: 'command',
      requestId: 'req-homeworld',
      command: {
        type: 'SetCharacterCreationHomeworld',
        gameId: 'game-1',
        actorId: 'user-1',
        characterId: 'char-1',
        homeworld: {
          name: ' Regina ',
          lawLevel: ' No Law ',
          tradeCodes: [' Asteroid ', 'Asteroid', ' Industrial ']
        }
      }
    })

    assert.equal(homeworld.ok, true)
    if (!homeworld.ok) return
    assert.equal(homeworld.value.type, 'command')
    if (homeworld.value.type !== 'command') return
    const { command } = homeworld.value
    assert.equal(command.type, 'SetCharacterCreationHomeworld')
    if (command.type !== 'SetCharacterCreationHomeworld') return
    assert.deepEqual(command.homeworld, {
      name: 'Regina',
      lawLevel: 'No Law',
      tradeCodes: ['Asteroid', 'Industrial']
    })

    const selected = decodeCommand({
      type: 'SelectCharacterCreationBackgroundSkill',
      gameId: 'game-1',
      actorId: 'user-1',
      characterId: 'char-1',
      skill: ' Admin '
    })
    assert.equal(selected.ok, true)
    if (!selected.ok) return
    assert.equal(selected.value.type, 'SelectCharacterCreationBackgroundSkill')
    if (selected.value.type !== 'SelectCharacterCreationBackgroundSkill') return
    assert.equal(selected.value.skill, 'Admin')

    const resolved = decodeCommand({
      type: 'ResolveCharacterCreationCascadeSkill',
      gameId: 'game-1',
      actorId: 'user-1',
      characterId: 'char-1',
      cascadeSkill: 'Gun Combat-0',
      selection: 'Slug Rifle'
    })
    assert.equal(resolved.ok, true)
    if (!resolved.ok) return
    assert.equal(resolved.value.type, 'ResolveCharacterCreationCascadeSkill')
  })

  it('rejects malformed character creation homeworld commands', () => {
    const result = decodeClientMessage({
      type: 'command',
      requestId: 'req-homeworld',
      command: {
        type: 'SetCharacterCreationHomeworld',
        gameId: 'game-1',
        actorId: 'user-1',
        characterId: 'char-1',
        homeworld: {
          lawLevel: 'No Law',
          tradeCodes: []
        }
      }
    })

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(result.error.message, 'homeworld.tradeCodes cannot be empty')
  })

  it('rejects oversized character creation trade code arrays', () => {
    const result = decodeClientMessage({
      type: 'command',
      requestId: 'req-homeworld-oversize',
      command: {
        type: 'SetCharacterCreationHomeworld',
        gameId: 'game-1',
        actorId: 'user-1',
        characterId: 'char-1',
        homeworld: {
          lawLevel: 'No Law',
          tradeCodes: Array.from({ length: 101 }, (_, index) => `Code ${index}`)
        }
      }
    })

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(
      result.error.message,
      'homeworld.tradeCodes cannot contain more than 100 entries'
    )
  })

  it('rejects oversized character creation skill array entries', () => {
    const result = decodeClientMessage({
      type: 'command',
      requestId: 'req-finalize-oversize-skill',
      command: {
        type: 'FinalizeCharacterCreation',
        gameId: 'game-1',
        actorId: 'user-1',
        characterId: 'char-1',
        age: 34,
        characteristics: {
          str: 7,
          dex: 8,
          end: 7,
          int: 9,
          edu: 8,
          soc: 6
        },
        skills: ['A'.repeat(201)],
        equipment: [],
        credits: 1200,
        notes: 'Generated character.'
      }
    })

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(result.error.message, 'skills[0] cannot exceed 200 characters')
  })

  it('rejects invalid character creation skill array entries', () => {
    const result = decodeClientMessage({
      type: 'command',
      requestId: 'req-finalize-invalid-skill',
      command: {
        type: 'FinalizeCharacterCreation',
        gameId: 'game-1',
        actorId: 'user-1',
        characterId: 'char-1',
        age: 34,
        characteristics: {
          str: 7,
          dex: 8,
          end: 7,
          int: 9,
          edu: 8,
          soc: 6
        },
        skills: ['Pilot-1', 7],
        equipment: [],
        credits: 1200,
        notes: 'Generated character.'
      }
    })

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(result.error.message, 'skills[1] must be a string')
  })

  it('accepts door state commands for board occluders', () => {
    const result = decodeClientMessage({
      type: 'command',
      requestId: 'req-door',
      command: {
        type: 'SetDoorOpen',
        gameId: 'game-1',
        actorId: 'user-1',
        boardId: 'board-1',
        doorId: 'iris-1',
        open: false
      }
    })

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.value.type, 'command')
    if (result.value.type !== 'command') return
    const { command } = result.value
    assert.equal(command.type, 'SetDoorOpen')
    if (command.type !== 'SetDoorOpen') return
    assert.equal(command.boardId, 'board-1')
    assert.equal(command.doorId, 'iris-1')
    assert.equal(command.open, false)
  })

  it('rejects malformed door state commands', () => {
    const result = decodeClientMessage({
      type: 'command',
      requestId: 'req-door',
      command: {
        type: 'SetDoorOpen',
        gameId: 'game-1',
        actorId: 'user-1',
        boardId: 'board-1',
        doorId: '',
        open: 'yes'
      }
    })

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
  })

  it('rejects non-string character sheet notes', () => {
    const result = decodeClientMessage({
      type: 'command',
      requestId: 'req-sheet-notes',
      command: {
        type: 'UpdateCharacterSheet',
        gameId: 'game-1',
        actorId: 'user-1',
        characterId: 'char-1',
        notes: 123
      }
    })

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_command')
    assert.equal(result.error.message, 'notes must be a string')
  })

  it('accepts optional board image URLs and asset references', () => {
    const result = decodeClientMessage({
      type: 'command',
      requestId: 'req-3',
      command: {
        type: 'CreateBoard',
        gameId: 'game-1',
        actorId: 'user-1',
        boardId: 'main-board',
        name: 'Downport',
        imageAssetId: 'board-image-1',
        url: '/assets/boards/downport.png',
        width: 1200,
        height: 800,
        scale: 50
      }
    })

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.value.type, 'command')
    if (result.value.type !== 'command') return
    const { command } = result.value
    assert.equal(command.type, 'CreateBoard')
    if (command.type !== 'CreateBoard') return
    assert.equal(command.imageAssetId, 'board-image-1')
    assert.equal(command.url, '/assets/boards/downport.png')
  })

  it('accepts board selection commands', () => {
    const result = decodeClientMessage({
      type: 'command',
      requestId: 'req-4',
      command: {
        type: 'SelectBoard',
        gameId: 'game-1',
        actorId: 'user-1',
        boardId: 'main-board'
      }
    })

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.value.type, 'command')
    if (result.value.type !== 'command') return
    const { command } = result.value
    assert.equal(command.type, 'SelectBoard')
    if (command.type !== 'SelectBoard') return
    assert.equal(command.boardId, 'main-board')
  })

  it('rejects unknown message types before command handling', () => {
    const result = decodeClientMessage({
      type: 'mutateEverything'
    })

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'invalid_message')
  })
})
