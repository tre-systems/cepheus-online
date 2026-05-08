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
import {
  appCommandRouteByType,
  createAppCommandRouter,
  sequenceCommand,
  type AppCommandSubmitInput
} from './app-command-router'

const identity = {
  gameId: asGameId('demo-room'),
  actorId: asUserId('local-user')
}
const characterId = asCharacterId('scout-character')

type MovePieceCommand = Extract<Command, { type: 'MovePiece' }>
type CreateBoardCommand = Extract<Command, { type: 'CreateBoard' }>
type RollDiceCommand = Extract<Command, { type: 'RollDice' }>
type SetDoorOpenCommand = Extract<Command, { type: 'SetDoorOpen' }>
type UpdateCharacterSheetCommand = Extract<
  Command,
  { type: 'UpdateCharacterSheet' }
>
type AdvanceCharacterCreationCommand = Extract<
  Command,
  { type: 'AdvanceCharacterCreation' }
>

const moveCommand = (overrides: Partial<MovePieceCommand> = {}): Command => ({
  type: 'MovePiece',
  gameId: identity.gameId,
  actorId: identity.actorId,
  pieceId: asPieceId('scout'),
  x: 10,
  y: 20,
  ...overrides
})

const createBoardCommand = (): CreateBoardCommand => ({
  type: 'CreateBoard',
  gameId: identity.gameId,
  actorId: identity.actorId,
  boardId: asBoardId('main'),
  name: 'Main',
  width: 1200,
  height: 800,
  scale: 50
})

const rollDiceCommand = (): RollDiceCommand => ({
  type: 'RollDice',
  gameId: identity.gameId,
  actorId: identity.actorId,
  expression: '2d6',
  reason: 'Table roll'
})

const doorCommand = (): SetDoorOpenCommand => ({
  type: 'SetDoorOpen',
  gameId: identity.gameId,
  actorId: identity.actorId,
  boardId: asBoardId('main'),
  doorId: 'iris',
  open: true
})

const sheetCommand = (): UpdateCharacterSheetCommand => ({
  type: 'UpdateCharacterSheet',
  gameId: identity.gameId,
  actorId: identity.actorId,
  characterId,
  notes: 'Ready'
})

const characterCreationCommand = (): AdvanceCharacterCreationCommand => ({
  type: 'AdvanceCharacterCreation',
  gameId: identity.gameId,
  actorId: identity.actorId,
  characterId,
  creationEvent: { type: 'COMPLETE_BASIC_TRAINING' }
})

const anagathicsCommand = (): Extract<
  Command,
  { type: 'DecideCharacterCreationAnagathics' }
> => ({
  type: 'DecideCharacterCreationAnagathics',
  gameId: identity.gameId,
  actorId: identity.actorId,
  characterId,
  useAnagathics: false
})

const agingLossesCommand = (): Extract<
  Command,
  { type: 'ResolveCharacterCreationAgingLosses' }
> => ({
  type: 'ResolveCharacterCreationAgingLosses',
  gameId: identity.gameId,
  actorId: identity.actorId,
  characterId,
  selectedLosses: [
    {
      type: 'PHYSICAL',
      modifier: -1,
      characteristic: 'str'
    }
  ]
})

describe('app command router sequencing', () => {
  it('adds the current authoritative event sequence to stale-sensitive commands', () => {
    const command = sequenceCommand(moveCommand(), 12)

    assert.equal(command.type, 'MovePiece')
    assert.equal(command.expectedSeq, 12)
  })

  it('preserves explicit expectedSeq and unsequenced create-game commands', () => {
    assert.equal(
      sequenceCommand(moveCommand({ expectedSeq: 7 }), 12).expectedSeq,
      7
    )

    const createGame: Command = {
      type: 'CreateGame',
      gameId: identity.gameId,
      actorId: identity.actorId,
      slug: 'demo-room',
      name: 'Demo Room'
    }
    assert.equal(sequenceCommand(createGame, 12).expectedSeq, undefined)
  })

  it('leaves commands unchanged when there is no authoritative sequence', () => {
    assert.equal(sequenceCommand(moveCommand(), null).expectedSeq, undefined)
  })
})

describe('app command router dispatch', () => {
  it('submits a sequenced command with an injected request id', async () => {
    const submissions: AppCommandSubmitInput[] = []
    const router = createAppCommandRouter({
      getEventSeq: () => 21,
      createRequestId: (command) => `${command.type}-request`,
      submit: async (input) => {
        submissions.push(input)
        return { ok: true }
      }
    })

    const result = await router.dispatch(moveCommand())

    assert.deepEqual(result, { ok: true })
    assert.equal(submissions.length, 1)
    assert.equal(submissions[0]?.requestId, 'MovePiece-request')
    assert.equal(submissions[0]?.command.expectedSeq, 21)
  })

  it('submits command batches in order with incremented expectedSeq values', async () => {
    const submissions: AppCommandSubmitInput[] = []
    const router = createAppCommandRouter({
      getEventSeq: () => 30,
      submit: async (input) => {
        submissions.push(input)
        return input.requestId
      }
    })

    const results = await router.dispatchAll(
      [createBoardCommand(), moveCommand({ expectedSeq: 99 }), moveCommand()],
      { requestIds: ['board-1', 'move-explicit', 'move-2'] }
    )

    assert.deepEqual(results, ['board-1', 'move-explicit', 'move-2'])
    assert.deepEqual(
      submissions.map((submission) => submission.requestId),
      ['board-1', 'move-explicit', 'move-2']
    )
    assert.deepEqual(
      submissions.map((submission) => submission.command.expectedSeq),
      [30, 99, 32]
    )
  })

  it('submits sequential commands against the latest authoritative event sequence', async () => {
    let eventSeq = 30
    const submissions: AppCommandSubmitInput[] = []
    const router = createAppCommandRouter({
      getEventSeq: () => eventSeq,
      submit: async (input) => {
        submissions.push(input)
        eventSeq += 1
        return input.requestId
      }
    })

    const results = await router.dispatchSequential(
      [createBoardCommand(), moveCommand({ expectedSeq: 99 }), moveCommand()],
      { requestIds: ['board-1', 'move-explicit', 'move-2'] }
    )

    assert.deepEqual(results, ['board-1', 'move-explicit', 'move-2'])
    assert.deepEqual(
      submissions.map((submission) => submission.command.expectedSeq),
      [30, 99, 32]
    )
  })

  it('routes every command type through the shared route registry', () => {
    assert.deepEqual(appCommandRouteByType, {
      CreateGame: 'game',
      CreateCharacter: 'characterCreation',
      UpdateCharacterSheet: 'sheet',
      StartCharacterCreation: 'characterCreation',
      AdvanceCharacterCreation: 'characterCreation',
      SetCharacterCreationHomeworld: 'characterCreation',
      SelectCharacterCreationBackgroundSkill: 'characterCreation',
      ResolveCharacterCreationCascadeSkill: 'characterCreation',
      FinalizeCharacterCreation: 'characterCreation',
      StartCharacterCareerTerm: 'characterCreation',
      CompleteCharacterCreationHomeworld: 'characterCreation',
      ResolveCharacterCreationQualification: 'characterCreation',
      ResolveCharacterCreationDraft: 'characterCreation',
      EnterCharacterCreationDrifter: 'characterCreation',
      CompleteCharacterCreationBasicTraining: 'characterCreation',
      ResolveCharacterCreationSurvival: 'characterCreation',
      ResolveCharacterCreationCommission: 'characterCreation',
      SkipCharacterCreationCommission: 'characterCreation',
      ResolveCharacterCreationAdvancement: 'characterCreation',
      SkipCharacterCreationAdvancement: 'characterCreation',
      ResolveCharacterCreationAging: 'characterCreation',
      ResolveCharacterCreationAgingLosses: 'characterCreation',
      DecideCharacterCreationAnagathics: 'characterCreation',
      ResolveCharacterCreationReenlistment: 'characterCreation',
      RollCharacterCreationCharacteristic: 'characterCreation',
      RollCharacterCreationTermSkill: 'characterCreation',
      CompleteCharacterCreationSkills: 'characterCreation',
      ResolveCharacterCreationTermCascadeSkill: 'characterCreation',
      RollCharacterCreationMusteringBenefit: 'characterCreation',
      CompleteCharacterCreationMustering: 'characterCreation',
      CompleteCharacterCreation: 'characterCreation',
      CreateBoard: 'board',
      SelectBoard: 'board',
      SetDoorOpen: 'door',
      CreatePiece: 'board',
      MovePiece: 'board',
      SetPieceVisibility: 'board',
      SetPieceFreedom: 'board',
      RollDice: 'dice'
    })
  })

  it('submits board, dice, door, sheet, and character creation commands through typed domain APIs', async () => {
    const submissions: AppCommandSubmitInput[] = []
    const router = createAppCommandRouter({
      getEventSeq: () => 40,
      submit: async (input) => {
        submissions.push(input)
        return input.command.type
      }
    })

    const results = await Promise.all([
      router.board.dispatch(createBoardCommand()),
      router.dice.dispatch(rollDiceCommand()),
      router.door.dispatch(doorCommand()),
      router.sheet.dispatch(sheetCommand()),
      router.characterCreation.dispatch(characterCreationCommand()),
      router.characterCreation.dispatch(anagathicsCommand()),
      router.characterCreation.dispatch(agingLossesCommand())
    ])

    assert.deepEqual(results, [
      'CreateBoard',
      'RollDice',
      'SetDoorOpen',
      'UpdateCharacterSheet',
      'AdvanceCharacterCreation',
      'DecideCharacterCreationAnagathics',
      'ResolveCharacterCreationAgingLosses'
    ])
    assert.deepEqual(
      submissions.map((submission) => router.routeFor(submission.command)),
      [
        'board',
        'dice',
        'door',
        'sheet',
        'characterCreation',
        'characterCreation',
        'characterCreation'
      ]
    )
    assert.deepEqual(
      submissions.map((submission) => submission.command.expectedSeq),
      [40, 40, 40, 40, 40, 40, 40]
    )
  })
})
