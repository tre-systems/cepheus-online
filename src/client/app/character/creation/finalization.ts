import type { PieceId } from '../../../../shared/ids'
import type {
  BoardState,
  GameState,
  PieceState
} from '../../../../shared/state'
import type { ClientIdentity } from '../../../game-commands'
import type {
  BoardCommand,
  CharacterCreationCommand
} from '../../core/command-router'
import {
  createBoardCommand,
  createGameCommand,
  type BootstrapCommandContext
} from '../../room/bootstrap-flow'
import {
  deriveFinalizeCharacterCreationCommand,
  type CharacterCreationFlow
} from './flow'
import { planCreateCharacterTokenCommand } from '../../piece/command-plan'

export interface CharacterCreationFinalizationControllerDeps {
  getFlow: () => CharacterCreationFlow | null
  setFlow: (flow: CharacterCreationFlow | null) => void
  getState: () => GameState | null
  getSelectedBoard: () => BoardState | null
  getSelectedBoardPieces: () => readonly PieceState[]
  identity: () => ClientIdentity
  bootstrapIdentity: () => BootstrapCommandContext
  requestId: (scope: string) => string
  syncFields: () => void
  reportError: (message: string) => void
  renderWizard: () => void
  closePanel: () => void
  openCharacterSheet: () => void
  renderApp: () => void
  selectPiece: (pieceId: PieceId) => void
  createGame: (
    command: ReturnType<typeof createGameCommand>,
    requestId: string
  ) => Promise<unknown>
  createBoard: (command: BoardCommand, requestId: string) => Promise<unknown>
  postCharacterCreationCommands: (
    commands: readonly CharacterCreationCommand[]
  ) => Promise<unknown>
  postBoardCommand: (command: BoardCommand) => Promise<unknown>
}

export interface CharacterCreationFinalizationController {
  createToken: () => Promise<PieceId | null>
  finish: () => Promise<void>
}

const deriveServerBackedFinalizationCommands = (
  flow: CharacterCreationFlow,
  state: GameState | null,
  identity: ClientIdentity
): CharacterCreationCommand[] => {
  if (!state) return []

  const character = state?.characters[flow.draft.characterId] ?? null
  if (!character?.creation) {
    return []
  }

  const baseCommand = {
    gameId: identity.gameId,
    actorId: identity.actorId,
    characterId: flow.draft.characterId
  }
  const commands: CharacterCreationCommand[] = []

  if (character.creation.state.status === 'MUSTERING_OUT') {
    commands.push({
      type: 'CompleteCharacterCreationMustering',
      ...baseCommand
    })
  } else if (character.creation.state.status === 'ACTIVE') {
    // Finalization is the legal ACTIVE -> PLAYABLE transition.
  } else {
    return []
  }

  commands.push(
    deriveFinalizeCharacterCreationCommand(flow.draft, {
      identity,
      state: null
    }) as CharacterCreationCommand
  )
  return commands
}

export const createCharacterCreationFinalizationController = ({
  getFlow,
  setFlow,
  getState,
  getSelectedBoard,
  getSelectedBoardPieces,
  identity,
  bootstrapIdentity,
  requestId,
  syncFields,
  reportError,
  renderWizard,
  closePanel,
  openCharacterSheet,
  renderApp,
  selectPiece,
  createGame,
  createBoard,
  postCharacterCreationCommands,
  postBoardCommand
}: CharacterCreationFinalizationControllerDeps): CharacterCreationFinalizationController => {
  const createToken = async (): Promise<PieceId | null> => {
    const flow = getFlow()
    if (!flow) return null

    if (!getSelectedBoard()) {
      await createBoard(
        createBoardCommand(bootstrapIdentity()) as BoardCommand,
        requestId('create-board-for-wizard-character')
      )
    }

    const state = getState()
    const board = getSelectedBoard()
    if (!state || !board) return null

    const plan = planCreateCharacterTokenCommand({
      identity: identity(),
      state,
      board,
      characterId: flow.draft.characterId,
      name: state.characters[flow.draft.characterId]?.name ?? flow.draft.name,
      existingPieceCount: getSelectedBoardPieces().length
    })
    if (!plan.ok) {
      reportError(plan.error)
      return null
    }

    await postBoardCommand(plan.command)
    selectPiece(plan.pieceId)
    return plan.pieceId
  }

  const finish = async (): Promise<void> => {
    const flow = getFlow()
    if (!flow) return

    reportError('')
    syncFields()
    const syncedFlow = getFlow()
    if (!syncedFlow) return

    if (!getState()) {
      await createGame(
        createGameCommand(bootstrapIdentity()),
        requestId('create-game-for-wizard-character')
      )
    }

    const commands = deriveServerBackedFinalizationCommands(
      syncedFlow,
      getState(),
      identity()
    )
    if (commands.length === 0) {
      reportError('Character creation needs the current room state')
      return
    }

    await postCharacterCreationCommands(commands as CharacterCreationCommand[])

    await createToken()

    setFlow(null)
    renderWizard()
    closePanel()
    openCharacterSheet()
    renderApp()
  }

  return {
    createToken,
    finish
  }
}
