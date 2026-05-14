import { asCharacterId } from '../../../../shared/ids'
import type {
  BoardState,
  CharacterState,
  GameState,
  PieceFreedom,
  PieceState,
  PieceVisibility
} from '../../../../shared/state'
import {
  buildRollDiceCommand,
  type ClientIdentity
} from '../../../game-commands.js'
import type {
  CharacterCreationCommand,
  DiceCommand,
  SheetCommand
} from '../../core/command-router.js'
import type { RequiredAppElements } from '../../core/elements.js'
import {
  createCharacterSheetController,
  type CharacterSheetController,
  type CharacterSheetControllerOptions
} from './controller.js'
import { renderCharacterCreationSheetActions } from '../creation/sheet-actions.js'

export interface CharacterSheetWiringOptions {
  document: Document
  elements: RequiredAppElements
  getSelectedPiece: () => PieceState | null
  getSelectedCharacter: () => CharacterState | null
  getSelectedBoard: () => BoardState | null
  getCharacterState: () => GameState | null
  canEditSheetFields: (character: CharacterState) => boolean
  getBoardDoorActions: () => { actions: HTMLElement | null }
  getClientIdentity: () => ClientIdentity
  getCommandIdentity: () => ClientIdentity
  postSheetCommand: (command: SheetCommand) => Promise<unknown>
  postCharacterCreationCommand: (
    command: CharacterCreationCommand
  ) => Promise<unknown>
  reportError: (message: string) => void
  createController?: (
    options: CharacterSheetControllerOptions
  ) => CharacterSheetController
}

export const createCharacterSheetWiring = ({
  document,
  elements,
  getSelectedPiece,
  getSelectedCharacter,
  getSelectedBoard,
  getCharacterState,
  canEditSheetFields,
  getBoardDoorActions,
  getClientIdentity,
  getCommandIdentity,
  postSheetCommand,
  postCharacterCreationCommand,
  reportError,
  createController = createCharacterSheetController
}: CharacterSheetWiringOptions): CharacterSheetController => {
  return createController({
    elements: {
      sheet: elements.sheet,
      sheetName: elements.sheetName,
      sheetBody: elements.sheetBody,
      sheetTabs: elements.sheetTabs
    },
    getSelectedPiece,
    getSelectedCharacter,
    getSelectedBoard,
    getCharacterState,
    canEditSheetFields,
    getBoardDoorActions,
    sendPatch: (characterId, patch) =>
      postSheetCommand({
        type: 'UpdateCharacterSheet',
        ...getCommandIdentity(),
        characterId: asCharacterId(
          typeof characterId === 'string'
            ? characterId
            : (characterId.characterId ?? characterId.id ?? '')
        ),
        ...patch
      }),
    setVisibility: (piece: PieceState, visibility: PieceVisibility) =>
      postSheetCommand({
        type: 'SetPieceVisibility',
        ...getCommandIdentity(),
        pieceId: piece.id,
        visibility
      }),
    setFreedom: (piece: PieceState, freedom: PieceFreedom) =>
      postSheetCommand({
        type: 'SetPieceFreedom',
        ...getCommandIdentity(),
        pieceId: piece.id,
        freedom
      }),
    rollSkill: (_piece, _character, _skill, reason) =>
      postSheetCommand(
        buildRollDiceCommand({
          identity: getClientIdentity(),
          expression: '2d6',
          reason
        }) as DiceCommand
      ),
    getCharacterCreationActions: (character) =>
      renderCharacterCreationSheetActions(character, {
        document,
        identity: getClientIdentity,
        dispatch: postCharacterCreationCommand,
        reportError
      }),
    reportError
  })
}
