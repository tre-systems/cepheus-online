import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  asBoardId,
  asCharacterId,
  asGameId,
  asPieceId,
  asUserId
} from '../../shared/ids'
import type { BoardState, GameState, PieceState } from '../../shared/state'
import type {
  BoardCommand,
  CharacterCreationCommand
} from './app-command-router'
import {
  applyCharacterCreationCareerPlan,
  createCharacterCreationFlow,
  createInitialCharacterDraft,
  selectCharacterCreationCareerPlan,
  type CharacterCreationFlow
} from './character-creation-flow'
import { createCharacterCreationFinalizationController } from './character-creation-finalization-controller'

const gameId = asGameId('demo-room')
const actorId = asUserId('local-user')
const characterId = asCharacterId('char-1')
const boardId = asBoardId('main-board')

const identity = { gameId, actorId }

const board = (overrides: Partial<BoardState> = {}): BoardState => ({
  id: boardId,
  name: 'Main Board',
  imageAssetId: null,
  url: null,
  width: 1200,
  height: 800,
  scale: 50,
  doors: {},
  ...overrides
})

const piece = (id = 'existing-piece'): PieceState => ({
  id: asPieceId(id),
  boardId,
  characterId: null,
  imageAssetId: null,
  name: id,
  x: 0,
  y: 0,
  z: 0,
  width: 50,
  height: 50,
  scale: 1,
  visibility: 'VISIBLE',
  freedom: 'UNLOCKED'
})

const gameState = (overrides: Partial<GameState> = {}): GameState => ({
  id: gameId,
  slug: 'demo-room',
  name: 'Demo Room',
  ownerId: actorId,
  players: {},
  characters: {},
  boards: {
    [boardId]: board()
  },
  pieces: {},
  diceLog: [],
  selectedBoardId: boardId,
  eventSeq: 12,
  ...overrides
})

const completeDraft = () =>
  createInitialCharacterDraft(characterId, {
    name: 'Iona Vesh',
    age: 34,
    characteristics: {
      str: 7,
      dex: 8,
      end: 7,
      int: 9,
      edu: 8,
      soc: 6
    },
    homeworld: {
      lawLevel: 'No Law',
      tradeCodes: ['Asteroid']
    },
    backgroundSkills: ['Zero-G-0', 'Gun Combat-0', 'Admin-0'],
    pendingCascadeSkills: [],
    careerPlan: selectCharacterCreationCareerPlan('Merchant'),
    skills: ['Pilot-1', 'Vacc Suit-0'],
    equipment: [{ name: 'Vacc Suit', quantity: 1, notes: 'Carried' }],
    credits: 1200,
    notes: 'Detached scout.'
  })

const finalizableFlow = (): CharacterCreationFlow => ({
  step: 'review',
  draft: applyCharacterCreationCareerPlan(
    completeDraft(),
    selectCharacterCreationCareerPlan('Merchant', {
      survivalRoll: 5,
      commissionRoll: 4
    })
  )
})

const createHarness = ({
  currentFlow = finalizableFlow(),
  currentState = gameState(),
  currentBoard = board(),
  currentPieces = [piece()]
}: {
  currentFlow?: CharacterCreationFlow | null
  currentState?: GameState | null
  currentBoard?: BoardState | null
  currentPieces?: PieceState[]
} = {}) => {
  const events: string[] = []
  const postedCharacterCommands: CharacterCreationCommand[][] = []
  const postedBoardCommands: BoardCommand[] = []
  let error = ''
  let selectedPieceId: string | null = null

  const controller = createCharacterCreationFinalizationController({
    getFlow: () => currentFlow,
    setFlow: (flow) => {
      events.push(`setFlow:${flow ? 'flow' : 'null'}`)
      currentFlow = flow
    },
    getState: () => currentState,
    getSelectedBoard: () => currentBoard,
    getSelectedBoardPieces: () => currentPieces,
    identity: () => identity,
    bootstrapIdentity: () => ({ roomId: gameId, actorId }),
    requestId: (scope) => `request:${scope}`,
    syncFields: () => events.push('syncFields'),
    reportError: (message) => {
      error = message
      events.push(`error:${message}`)
    },
    renderWizard: () => events.push('renderWizard'),
    closePanel: () => events.push('closePanel'),
    openCharacterSheet: () => events.push('openCharacterSheet'),
    renderApp: () => events.push('renderApp'),
    selectPiece: (pieceId) => {
      selectedPieceId = pieceId
      events.push(`selectPiece:${pieceId}`)
    },
    createGame: async (_command, requestId) => {
      events.push(`createGame:${requestId}`)
      currentState = gameState()
    },
    createBoard: async (command, requestId) => {
      events.push(`createBoard:${requestId}`)
      postedBoardCommands.push(command)
      currentBoard = board()
    },
    postCharacterCreationCommands: async (commands) => {
      events.push('postCharacterCreationCommands')
      postedCharacterCommands.push([...commands])
    },
    postBoardCommand: async (command) => {
      events.push(`postBoardCommand:${command.type}`)
      postedBoardCommands.push(command)
    }
  })

  return {
    controller,
    events,
    postedCharacterCommands,
    postedBoardCommands,
    get error() {
      return error
    },
    get selectedPieceId() {
      return selectedPieceId
    },
    setFlow: (flow: CharacterCreationFlow | null) => {
      currentFlow = flow
    },
    setState: (state: GameState | null) => {
      currentState = state
    },
    setBoard: (nextBoard: BoardState | null) => {
      currentBoard = nextBoard
    }
  }
}

describe('character creation finalization controller', () => {
  it('returns without side effects when there is no active flow', async () => {
    const harness = createHarness({ currentFlow: null })

    await harness.controller.finish()

    assert.deepEqual(harness.events, [])
    assert.equal(harness.postedCharacterCommands.length, 0)
    assert.equal(harness.postedBoardCommands.length, 0)
  })

  it('syncs fields before validating the review step', async () => {
    const harness = createHarness()
    harness.events.length = 0
    const originalSync = harness.events.push.bind(harness.events)
    harness.setFlow(finalizableFlow())

    const controller = createCharacterCreationFinalizationController({
      getFlow: () => createCharacterCreationFlow(characterId),
      setFlow: () => {},
      getState: () => gameState(),
      getSelectedBoard: () => board(),
      getSelectedBoardPieces: () => [],
      identity: () => identity,
      bootstrapIdentity: () => ({ roomId: gameId, actorId }),
      requestId: (scope) => `request:${scope}`,
      syncFields: () => originalSync('syncFields'),
      reportError: (message) => originalSync(`error:${message}`),
      renderWizard: () => originalSync('renderWizard'),
      closePanel: () => originalSync('closePanel'),
      openCharacterSheet: () => originalSync('openCharacterSheet'),
      renderApp: () => originalSync('renderApp'),
      selectPiece: () => originalSync('selectPiece'),
      createGame: async () => originalSync('createGame'),
      createBoard: async () => originalSync('createBoard'),
      postCharacterCreationCommands: async () =>
        originalSync('postCharacterCreationCommands'),
      postBoardCommand: async () => originalSync('postBoardCommand')
    })

    await controller.finish()

    assert.equal(harness.events[0], 'error:')
    assert.equal(harness.events[1], 'syncFields')
    assert.equal(/^error:/.test(harness.events[2] ?? ''), true)
    assert.equal(harness.events[3], 'renderWizard')
    assert.equal(
      harness.events.includes('postCharacterCreationCommands'),
      false
    )
  })

  it('creates a missing game before deriving finalization commands', async () => {
    const harness = createHarness({ currentState: null })

    await harness.controller.finish()

    assert.equal(
      harness.events.indexOf(
        'createGame:request:create-game-for-wizard-character'
      ) < harness.events.indexOf('postCharacterCreationCommands'),
      true
    )
    assert.equal(harness.postedCharacterCommands.length, 1)
  })

  it('posts finalization commands before creating the linked token and closing UI', async () => {
    const harness = createHarness()

    await harness.controller.finish()

    const postedTypes = harness.postedCharacterCommands[0]?.map(
      (command) => command.type
    )
    assert.equal(postedTypes?.at(-1), 'FinalizeCharacterCreation')

    const token = harness.postedBoardCommands.find(
      (command) => command.type === 'CreatePiece'
    )
    assert.equal(token?.type, 'CreatePiece')
    if (token?.type !== 'CreatePiece') return
    assert.equal(token.characterId, characterId)
    assert.equal(token.boardId, boardId)
    assert.equal(token.name, 'Iona Vesh')

    assert.deepEqual(harness.events.slice(-6), [
      `selectPiece:${token.pieceId}`,
      'setFlow:null',
      'renderWizard',
      'closePanel',
      'openCharacterSheet',
      'renderApp'
    ])
  })

  it('creates a missing board before token planning', async () => {
    const harness = createHarness({ currentBoard: null })

    await harness.controller.finish()

    assert.equal(
      harness.events.includes(
        'createBoard:request:create-board-for-wizard-character'
      ),
      true
    )
    assert.equal(
      harness.postedBoardCommands.some(
        (command) => command.type === 'CreatePiece'
      ),
      true
    )
  })

  it('reports when finalization commands cannot be derived', async () => {
    const harness = createHarness({ currentState: null })
    harness.setState(null)
    const controller = createCharacterCreationFinalizationController({
      getFlow: () => finalizableFlow(),
      setFlow: () => harness.events.push('setFlow'),
      getState: () => null,
      getSelectedBoard: () => board(),
      getSelectedBoardPieces: () => [],
      identity: () => identity,
      bootstrapIdentity: () => ({ roomId: gameId, actorId }),
      requestId: (scope) => `request:${scope}`,
      syncFields: () => harness.events.push('syncFields'),
      reportError: (message) => {
        harness.events.push(`error:${message}`)
      },
      renderWizard: () => harness.events.push('renderWizard'),
      closePanel: () => harness.events.push('closePanel'),
      openCharacterSheet: () => harness.events.push('openCharacterSheet'),
      renderApp: () => harness.events.push('renderApp'),
      selectPiece: () => harness.events.push('selectPiece'),
      createGame: async () => harness.events.push('createGame'),
      createBoard: async () => harness.events.push('createBoard'),
      postCharacterCreationCommands: async () =>
        harness.events.push('postCharacterCreationCommands'),
      postBoardCommand: async () => harness.events.push('postBoardCommand')
    })

    await controller.finish()

    assert.equal(
      harness.events.includes(
        'error:Character creation needs the current room state'
      ),
      true
    )
    assert.equal(harness.events.includes('postBoardCommand'), false)
    assert.equal(harness.events.includes('setFlow'), false)
  })
})
