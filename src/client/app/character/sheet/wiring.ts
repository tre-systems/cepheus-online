import type { CepheusRuleset } from '../../../../shared/character-creation/cepheus-srd-ruleset'
import { asCharacterId } from '../../../../shared/ids'
import type {
  BoardState,
  CharacterEquipmentItem,
  CharacterState,
  GameState,
  PieceFreedom,
  PieceState,
  PieceVisibility
} from '../../../../shared/state'
import {
  buildRollDiceCommand,
  type ClientIdentity
} from '../../../game-commands'
import type {
  CharacterCreationCommand,
  DiceCommand,
  SheetCommand
} from '../../core/command-router'
import type { RequiredAppElements } from '../../core/elements'
import { renderCharacterCreationSheetActions } from '../creation/sheet-actions'
import {
  type CharacterSheetController,
  type CharacterSheetControllerOptions,
  createCharacterSheetController
} from './controller'
import { skillRollExpression } from './view'

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
  ruleset?: CepheusRuleset
  getRuleset?: () => CepheusRuleset | null | undefined
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
  ruleset,
  getRuleset,
  reportError,
  createController = createCharacterSheetController
}: CharacterSheetWiringOptions): CharacterSheetController => {
  let ledgerSequence = 0
  const createLedgerEntryId = () =>
    `ledger-${Date.now().toString(36)}-${++ledgerSequence}`

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
    rollSkill: (_piece, _character, skill, reason) =>
      postSheetCommand(
        buildRollDiceCommand({
          identity: getClientIdentity(),
          expression: skillRollExpression(skill),
          reason
        }) as DiceCommand
      ),
    addEquipmentItem: (
      characterId: string,
      item: CharacterEquipmentItem & { id: string }
    ) =>
      postSheetCommand({
        type: 'AddCharacterEquipmentItem',
        ...getCommandIdentity(),
        characterId: asCharacterId(characterId),
        item
      }),
    updateEquipmentItem: (
      characterId: string,
      itemId: string,
      patch: Partial<CharacterEquipmentItem>
    ) =>
      postSheetCommand({
        type: 'UpdateCharacterEquipmentItem',
        ...getCommandIdentity(),
        characterId: asCharacterId(characterId),
        itemId,
        patch
      }),
    removeEquipmentItem: (characterId: string, itemId: string) =>
      postSheetCommand({
        type: 'RemoveCharacterEquipmentItem',
        ...getCommandIdentity(),
        characterId: asCharacterId(characterId),
        itemId
      }),
    adjustCredits: (characterId: string, amount: number, reason: string) =>
      postSheetCommand({
        type: 'AdjustCharacterCredits',
        ...getCommandIdentity(),
        characterId: asCharacterId(characterId),
        ledgerEntryId: createLedgerEntryId(),
        amount,
        reason
      }),
    ruleset,
    getRuleset,
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
