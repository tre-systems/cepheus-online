import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  asBoardId,
  asCharacterId,
  asEventId,
  asGameId,
  asPieceId,
  asUserId
} from '../shared/ids'
import type {
  CharacterCharacteristics,
  CharacterCreationProjection,
  GameState
} from '../shared/state'
import {
  applyServerMessage,
  buildBootstrapCommands,
  buildCharacterSheetPatchCommand,
  buildCharacterSkillRollReason,
  buildCreatePieceCommand,
  buildMovePieceCommand,
  buildSequencedCommand,
  buildSetDoorOpenCommand,
  deriveServerMessageDiceRollActivities,
  formatCharacterEquipmentText,
  normalizeCharacterEquipmentText,
  normalizeCharacterSkillList,
  parseCharacterCharacteristicsPatch,
  resolveClientIdentity
} from './game-commands'

const identity = {
  gameId: asGameId('game-1'),
  actorId: asUserId('user-1')
}

const boardId = asBoardId('main-board')
const characterId = asCharacterId('scout')
const unrolledCharacteristics = (): CharacterCharacteristics => ({
  str: null,
  dex: null,
  end: null,
  int: null,
  edu: null,
  soc: null
})

const state = {
  id: identity.gameId,
  slug: 'game-1',
  name: 'Spinward Test',
  ownerId: identity.actorId,
  players: {
    [identity.actorId]: {
      userId: identity.actorId,
      role: 'REFEREE'
    }
  },
  characters: {},
  boards: {},
  pieces: {},
  diceLog: [],
  selectedBoardId: null,
  eventSeq: 7
} satisfies GameState

const stateWithBoard = {
  ...state,
  boards: {
    [boardId]: {
      id: boardId,
      name: 'Downport Skirmish',
      imageAssetId: null,
      url: null,
      width: 1200,
      height: 800,
      scale: 50,
      doors: {}
    }
  },
  selectedBoardId: boardId
} satisfies GameState

const stateWithCharacter = {
  ...stateWithBoard,
  characters: {
    [characterId]: {
      id: characterId,
      ownerId: identity.actorId,
      type: 'PLAYER',
      name: 'Scout',
      active: true,
      notes: '',
      age: 34,
      characteristics: {
        str: 7,
        dex: 8,
        end: 7,
        int: 9,
        edu: 8,
        soc: 6
      },
      skills: ['Pilot 1', 'Gun Combat 0', 'Vacc Suit 0'],
      equipment: [
        {
          name: 'Vacc suit',
          quantity: 1,
          notes: 'Standard shipboard emergency suit'
        }
      ],
      credits: 1000,
      creation: null
    }
  }
} satisfies GameState

const creation = (
  status: CharacterCreationProjection['state']['status'],
  options: {
    terms?: CharacterCreationProjection['terms']
    careers?: CharacterCreationProjection['careers']
    failedToQualify?: boolean
    creationComplete?: boolean
  } = {}
): CharacterCreationProjection => ({
  state: {
    status,
    context: {
      canCommission: false,
      canAdvance: false
    }
  },
  terms: options.terms ?? [],
  careers: options.careers ?? [],
  canEnterDraft: true,
  failedToQualify: options.failedToQualify ?? false,
  characteristicChanges: [],
  creationComplete: options.creationComplete ?? false
})

const scoutWithCreation = (
  characterCreation: CharacterCreationProjection,
  skills: string[] = []
): GameState =>
  ({
    ...stateWithCharacter,
    characters: {
      [characterId]: {
        ...stateWithCharacter.characters[characterId],
        skills,
        creation: characterCreation
      }
    }
  }) satisfies GameState

const scoutAfterCareerTerm = scoutWithCreation(
  creation('CAREER_SELECTION', {
    terms: [
      {
        career: 'Scout',
        skills: [],
        skillsAndTraining: [],
        benefits: [],
        complete: false,
        canReenlist: false,
        completedBasicTraining: false,
        musteringOut: false,
        anagathics: false
      }
    ],
    careers: [{ name: 'Scout', rank: 0 }]
  })
)

const scoutWithSheet = scoutWithCreation(
  creation('BASIC_TRAINING', {
    terms: [
      {
        career: 'Scout',
        skills: [],
        skillsAndTraining: [],
        benefits: [],
        complete: false,
        canReenlist: false,
        completedBasicTraining: false,
        musteringOut: false,
        anagathics: false
      }
    ],
    careers: [{ name: 'Scout', rank: 0 }]
  }),
  ['Vacc Suit-0']
)

describe('client command helpers', () => {
  it('resolves deterministic demo identity from query params', () => {
    const result = resolveClientIdentity(
      new URLSearchParams('?game=spinward&user=traveller')
    )

    assert.equal(result.gameId, 'spinward')
    assert.equal(result.actorId, 'traveller')
  })

  it('builds move commands with expected sequence from authoritative state', () => {
    const command = buildMovePieceCommand({
      identity,
      state,
      pieceId: asPieceId('piece-1'),
      x: 50,
      y: 60
    })

    assert.equal(command.type, 'MovePiece')
    if (command.type !== 'MovePiece') return
    assert.equal(command.expectedSeq, 7)
  })

  it('builds open door commands with authoritative sequence and actor', () => {
    const command = buildSetDoorOpenCommand({
      identity,
      state,
      boardId,
      doorId: 'iris-1',
      open: true
    })

    assert.equal(command.type, 'SetDoorOpen')
    assert.equal(command.gameId, identity.gameId)
    assert.equal(command.actorId, identity.actorId)
    assert.equal(command.expectedSeq, 7)
    assert.equal(command.boardId, boardId)
    assert.equal(command.doorId, 'iris-1')
    assert.equal(command.open, true)
  })

  it('builds closed door commands with authoritative sequence and actor', () => {
    const command = buildSetDoorOpenCommand({
      identity,
      state,
      boardId,
      doorId: 'iris-1',
      open: false
    })

    assert.equal(command.type, 'SetDoorOpen')
    assert.equal(command.actorId, identity.actorId)
    assert.equal(command.expectedSeq, 7)
    assert.equal(command.open, false)
  })

  it('adds the current authoritative sequence before dispatching commands', () => {
    const command = buildSequencedCommand(
      {
        type: 'RollDice',
        gameId: identity.gameId,
        actorId: identity.actorId,
        expression: '2d6',
        reason: 'Table roll'
      },
      state
    )

    assert.equal(command.type, 'RollDice')
    if (command.type !== 'RollDice') return
    assert.equal(command.expectedSeq, 7)
  })

  it('does not sequence initial game creation without a projection', () => {
    const command = buildSequencedCommand(
      {
        type: 'CreateGame',
        gameId: identity.gameId,
        actorId: identity.actorId,
        slug: 'game-1',
        name: 'Spinward Test'
      },
      null
    )

    assert.equal(command.type, 'CreateGame')
    assert.equal(command.expectedSeq, undefined)
  })

  it('bootstraps only the next missing room primitive', () => {
    const commands = buildBootstrapCommands(identity, null)

    assert.equal(commands.length, 1)
    assert.equal(commands[0]?.type, 'CreateGame')
  })

  it('bootstraps a default character before creation lifecycle steps', () => {
    const commands = buildBootstrapCommands(identity, stateWithBoard)

    assert.equal(commands.length, 1)
    assert.equal(commands[0]?.type, 'CreateCharacter')
    assert.equal(commands[0]?.expectedSeq, stateWithBoard.eventSeq)
  })

  it('bootstraps the default character creation lifecycle one command at a time', () => {
    const startCommands = buildBootstrapCommands(identity, stateWithCharacter)
    assert.equal(startCommands.length, 1)
    assert.equal(startCommands[0]?.type, 'StartCharacterCreation')
    assert.equal(startCommands[0]?.expectedSeq, stateWithCharacter.eventSeq)

    const characteristicsState = scoutWithCreation(creation('CHARACTERISTICS'))
    characteristicsState.characters[characterId].characteristics =
      unrolledCharacteristics()
    const characteristicsCommands = buildBootstrapCommands(
      identity,
      characteristicsState
    )
    assert.equal(characteristicsCommands.length, 1)
    assert.equal(
      characteristicsCommands[0]?.type,
      'RollCharacterCreationCharacteristic'
    )
    if (
      characteristicsCommands[0]?.type !== 'RollCharacterCreationCharacteristic'
    ) {
      return
    }
    assert.equal(characteristicsCommands[0].characteristic, 'str')

    const homeworldCommands = buildBootstrapCommands(
      identity,
      scoutWithCreation(creation('HOMEWORLD'))
    )
    assert.equal(homeworldCommands.length, 1)
    assert.equal(
      homeworldCommands[0]?.type,
      'CompleteCharacterCreationHomeworld'
    )

    const termCommands = buildBootstrapCommands(
      identity,
      scoutWithCreation(creation('CAREER_SELECTION'))
    )
    assert.equal(termCommands.length, 1)
    assert.equal(termCommands[0]?.type, 'ResolveCharacterCreationQualification')
    if (termCommands[0]?.type !== 'ResolveCharacterCreationQualification') {
      return
    }
    assert.equal(termCommands[0].career, 'Scout')

    const careerCommands = buildBootstrapCommands(
      identity,
      scoutAfterCareerTerm
    )
    assert.equal(careerCommands.length, 1)
    assert.equal(
      careerCommands[0]?.type,
      'ResolveCharacterCreationQualification'
    )

    const drifterCommands = buildBootstrapCommands(
      identity,
      scoutWithCreation(creation('CAREER_SELECTION', { failedToQualify: true }))
    )
    assert.equal(drifterCommands.length, 1)
    assert.equal(drifterCommands[0]?.type, 'EnterCharacterCreationDrifter')
  })

  it('does not emit generic character creation events during production bootstrap', () => {
    const states = [
      scoutWithCreation(creation('CHARACTERISTICS')),
      scoutWithCreation(creation('HOMEWORLD')),
      scoutWithCreation(creation('CAREER_SELECTION')),
      scoutWithCreation(creation('CAREER_SELECTION', { failedToQualify: true }))
    ]
    states[0].characters[characterId].characteristics =
      unrolledCharacteristics()

    const commands = states.flatMap((currentState) =>
      buildBootstrapCommands(identity, currentState)
    )

    assert.deepEqual(
      commands.map((command) => command.type),
      [
        'RollCharacterCreationCharacteristic',
        'CompleteCharacterCreationHomeworld',
        'ResolveCharacterCreationQualification',
        'EnterCharacterCreationDrifter'
      ]
    )
    assert.equal(
      commands.some(
        (command) =>
          command.type === 'AdvanceCharacterCreation' &&
          (command.creationEvent.type === 'SET_CHARACTERISTICS' ||
            command.creationEvent.type === 'SELECT_CAREER')
      ),
      false
    )
  })

  it('bootstraps the default piece without patching a character sheet', () => {
    const commands = buildBootstrapCommands(
      identity,
      scoutWithCreation(
        creation('BASIC_TRAINING', {
          terms: [
            {
              career: 'Scout',
              skills: [],
              skillsAndTraining: [],
              benefits: [],
              complete: false,
              canReenlist: false,
              completedBasicTraining: false,
              musteringOut: false,
              anagathics: false
            }
          ],
          careers: [{ name: 'Scout', rank: 0 }]
        })
      )
    )

    assert.equal(commands.length, 1)
    assert.equal(commands[0]?.type, 'CreatePiece')
    assert.equal(commands[0]?.expectedSeq, stateWithBoard.eventSeq)
  })

  it('binds the default piece to the default character', () => {
    const commands = buildBootstrapCommands(identity, scoutWithSheet)

    assert.equal(commands.length, 1)
    assert.equal(commands[0]?.type, 'CreatePiece')
    if (commands[0]?.type !== 'CreatePiece') return
    assert.equal(commands[0].boardId, boardId)
    assert.equal(commands[0].characterId, characterId)
    const commandWithDimensions = commands[0] as (typeof commands)[0] & {
      width?: number
      height?: number
      scale?: number
    }
    assert.equal(commandWithDimensions.width, 50)
    assert.equal(commandWithDimensions.height, 50)
    assert.equal(commandWithDimensions.scale, 1)
  })

  it('builds create piece commands with custom dimensions', () => {
    const command = buildCreatePieceCommand({
      requestId: 'piece-1',
      identity,
      boardId,
      characterId,
      width: 80,
      height: 60,
      scale: 1.5
    })

    assert.equal(command.type, 'CreatePiece')
    assert.equal(command.boardId, boardId)
    assert.equal(command.characterId, characterId)
    assert.equal(command.width, 80)
    assert.equal(command.height, 60)
    assert.equal(command.scale, 1.5)
  })

  it('normalizes character sheet skill text before sending patches', () => {
    assert.deepEqual(
      normalizeCharacterSkillList('Pilot 1\n Gun Combat 0, pilot 1\n'),
      ['Pilot 1', 'Gun Combat 0']
    )
  })

  it('normalizes character equipment text into protocol-safe items', () => {
    assert.deepEqual(
      normalizeCharacterEquipmentText(
        'Vacc suit | 1 | Emergency suit\n\nMedkit | many | ship locker'
      ),
      [
        {
          name: 'Vacc suit',
          quantity: 1,
          notes: 'Emergency suit'
        },
        {
          name: 'Medkit',
          quantity: 1,
          notes: 'ship locker'
        }
      ]
    )
  })

  it('formats character equipment into editable protocol text', () => {
    assert.equal(
      formatCharacterEquipmentText([
        {
          name: 'Vacc suit',
          quantity: 1,
          notes: 'Emergency suit'
        },
        {
          name: 'Medkit',
          quantity: 2,
          notes: ''
        }
      ]),
      'Vacc suit | 1 | Emergency suit\nMedkit | 2 | '
    )
  })

  it('parses characteristic patches from form-like values', () => {
    assert.deepEqual(
      parseCharacterCharacteristicsPatch({
        str: { value: '7' },
        dex: ' 8 ',
        END: '',
        int: 'not a number',
        edu: 9,
        soc: undefined
      }),
      {
        str: 7,
        dex: 8,
        end: null,
        int: null,
        edu: 9
      }
    )
  })

  it('builds character skill roll reasons with stable fallbacks', () => {
    assert.equal(
      buildCharacterSkillRollReason({
        character: stateWithCharacter.characters[characterId],
        skill: ' Pilot 1 '
      }),
      'Scout: Pilot 1'
    )

    assert.equal(
      buildCharacterSkillRollReason({
        character: null,
        fallbackName: 'Scout token',
        skill: ''
      }),
      'Scout token: Skill'
    )
  })

  it('builds character sheet patch commands only for linked characters', () => {
    const command = buildCharacterSheetPatchCommand({
      requestId: 'sheet-1',
      identity,
      character: stateWithCharacter.characters[characterId],
      patch: {
        notes: 'Scout service terms',
        skillsText: 'Pilot 1\nPilot 1\nVacc Suit 0',
        equipmentText: 'Vacc suit | 1 | Emergency suit'
      }
    })

    assert.equal(command?.type, 'UpdateCharacterSheet')
    assert.equal(command?.characterId, characterId)
    assert.deepEqual(command?.skills, ['Pilot 1', 'Vacc Suit 0'])
    assert.deepEqual(command?.equipment, [
      {
        name: 'Vacc suit',
        quantity: 1,
        notes: 'Emergency suit'
      }
    ])

    const unlinkedCommand = buildCharacterSheetPatchCommand({
      requestId: 'sheet-2',
      identity,
      character: null,
      patch: {
        notes: 'No target'
      }
    })
    assert.equal(unlinkedCommand, null)
  })

  it('does not build empty character sheet patch commands', () => {
    const command = buildCharacterSheetPatchCommand({
      requestId: 'sheet-empty',
      identity,
      character: stateWithCharacter.characters[characterId],
      patch: {}
    })

    assert.equal(command, null)
  })

  it('replaces authoritative state on accepted messages', () => {
    const result = applyServerMessage(null, {
      type: 'commandAccepted',
      requestId: 'req-1',
      state,
      eventSeq: state.eventSeq
    })

    assert.equal(result.state, state)
    assert.equal(result.shouldApplyState, true)
    assert.equal(result.shouldReload, false)
    assert.equal(result.error, null)
    assert.deepEqual(result.liveActivities, [])
    assert.deepEqual(result.diceRollActivities, [])
  })

  it('surfaces live dice roll activities from accepted messages', () => {
    const activity = {
      id: asEventId('game-1:8'),
      eventId: asEventId('game-1:8'),
      gameId: identity.gameId,
      seq: 8,
      actorId: identity.actorId,
      createdAt: '2026-05-06T10:00:00.000Z',
      type: 'diceRoll' as const,
      expression: '2d6',
      reason: 'Table roll',
      rolls: [3, 4],
      total: 7,
      reveal: {
        revealAt: '2026-05-06T10:00:02.500Z',
        delayMs: 2500
      }
    }
    const result = applyServerMessage(state, {
      type: 'commandAccepted',
      requestId: 'req-1',
      state,
      eventSeq: 8,
      liveActivities: [activity]
    })

    assert.deepEqual(result.liveActivities, [activity])
    assert.deepEqual(result.diceRollActivities, [
      {
        id: 'game-1:8',
        revealAt: '2026-05-06T10:00:02.500Z',
        rolls: [3, 4],
        total: 7
      }
    ])
  })

  it('maps room state dice activity reveal metadata for the overlay', () => {
    const activities = deriveServerMessageDiceRollActivities({
      type: 'roomState',
      state: {
        ...state,
        diceLog: []
      },
      eventSeq: 8,
      liveActivities: [
        {
          id: asEventId('game-1:8'),
          eventId: asEventId('game-1:8'),
          gameId: identity.gameId,
          seq: 8,
          actorId: identity.actorId,
          createdAt: '2026-05-06T10:00:00.000Z',
          type: 'diceRoll',
          expression: '2d6',
          reason: 'Table roll',
          rolls: [5, 6],
          total: 11,
          reveal: {
            revealAt: '2026-05-06T10:00:02.500Z',
            delayMs: 2500
          }
        },
        {
          id: asEventId('game-1:9'),
          eventId: asEventId('game-1:9'),
          gameId: identity.gameId,
          seq: 9,
          actorId: identity.actorId,
          createdAt: '2026-05-06T10:01:00.000Z',
          type: 'characterCreation',
          characterId,
          transition: 'STARTED',
          status: 'CHARACTERISTICS',
          creationComplete: false
        }
      ]
    })

    assert.deepEqual(activities, [
      {
        id: 'game-1:8',
        revealAt: '2026-05-06T10:00:02.500Z',
        rolls: [5, 6],
        total: 11
      }
    ])
  })

  it('marks stale command rejections for reload', () => {
    const result = applyServerMessage(state, {
      type: 'commandRejected',
      requestId: 'req-1',
      eventSeq: 8,
      error: {
        code: 'stale_command',
        message: 'Expected sequence 7, current sequence is 8'
      }
    })

    assert.equal(result.state, state)
    assert.equal(result.shouldApplyState, false)
    assert.equal(result.shouldReload, true)
    assert.equal(result.error, 'Expected sequence 7, current sequence is 8')
  })
})
