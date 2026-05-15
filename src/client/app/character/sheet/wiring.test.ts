import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  asCharacterId,
  asGameId,
  asPieceId,
  asUserId
} from '../../../../shared/ids'
import type {
  BoardState,
  CharacterSheetPatch,
  CharacterState,
  GameState,
  PieceState
} from '../../../../shared/state'
import type {
  CharacterCreationCommand,
  SheetCommand
} from '../../core/command-router'
import type { RequiredAppElements } from '../../core/elements'
import type { CharacterSheetControllerOptions } from './controller'
import { createCharacterSheetWiring } from './wiring'

const gameId = asGameId('room-1')
const actorId = asUserId('actor-1')

const fakeElement = <T>(): T => ({}) as T

const createElements = (): RequiredAppElements =>
  ({
    sheet: fakeElement<HTMLElement>(),
    sheetName: fakeElement<HTMLElement>(),
    sheetBody: fakeElement<HTMLElement>(),
    sheetTabs: [fakeElement<HTMLElement>()]
  }) as RequiredAppElements

describe('character sheet wiring', () => {
  it('maps app elements and delegates dependencies to the controller', async () => {
    const elements = createElements()
    const board = fakeElement<BoardState>()
    const character = {
      id: asCharacterId('character-1'),
      name: 'Scout'
    } as CharacterState
    const piece = {
      id: asPieceId('piece-1'),
      characterId: character.id
    } as PieceState
    const state = {
      characters: {
        [character.id]: character
      }
    } as unknown as GameState
    const actions = fakeElement<HTMLElement>()
    const sheetCommands: SheetCommand[] = []
    const characterCreationCommands: CharacterCreationCommand[] = []
    const errors: string[] = []
    const capturedOptions: CharacterSheetControllerOptions[] = []
    const createdElements: {
      tagName: string
      listeners: Record<string, () => void>
    }[] = []

    const controller = createCharacterSheetWiring({
      document: {
        createElement: (tagName: string) => {
          const listeners: Record<string, () => void> = {}
          const element = {
            className: '',
            textContent: '',
            type: '',
            childElementCount: 1,
            addEventListener: (type: string, listener: () => void) => {
              listeners[type] = listener
            },
            append: () => undefined
          }
          createdElements.push({ tagName, listeners })
          return { ...element, tagName } as unknown as HTMLElement
        }
      } as Document,
      elements,
      getSelectedPiece: () => piece,
      getSelectedCharacter: () => character,
      getSelectedBoard: () => board,
      getCharacterState: () => state,
      canEditSheetFields: (nextCharacter) => nextCharacter === character,
      getBoardDoorActions: () => ({ actions }),
      getClientIdentity: () => ({ gameId, actorId }),
      getCommandIdentity: () => ({ gameId, actorId }),
      postSheetCommand: async (command) => {
        sheetCommands.push(command)
      },
      postCharacterCreationCommand: async (command) => {
        characterCreationCommands.push(command)
      },
      reportError: (message) => {
        errors.push(message)
      },
      createController: (options) => {
        capturedOptions.push(options)
        return {
          isOpen: () => false,
          setOpen: () => undefined,
          toggleOpen: () => undefined,
          render: () => undefined,
          selectTab: () => undefined
        }
      }
    })

    const options = capturedOptions[0]
    if (!options) throw new Error('Expected controller options')
    assert.equal(options.elements.sheet, elements.sheet)
    assert.equal(options.elements.sheetName, elements.sheetName)
    assert.equal(options.elements.sheetBody, elements.sheetBody)
    assert.equal(options.elements.sheetTabs, elements.sheetTabs)
    assert.equal(options.getSelectedPiece(), piece)
    assert.equal(options.getSelectedCharacter?.(), character)
    assert.equal(options.getSelectedBoard(), board)
    assert.equal(options.getCharacterState(), state)
    assert.equal(options.canEditSheetFields?.(character), true)
    assert.deepEqual(options.getBoardDoorActions(), { actions })

    const patch: CharacterSheetPatch = { notes: 'Updated' }
    await options.sendPatch(character.id, patch)
    await options.sendPatch({ characterId: character.id }, patch)
    await options.addEquipmentItem(character.id, {
      id: 'vacc-suit-1',
      name: 'Vacc suit',
      quantity: 1,
      notes: ''
    })
    await options.updateEquipmentItem(character.id, 'vacc-suit-1', {
      quantity: 2
    })
    await options.removeEquipmentItem(character.id, 'vacc-suit-1')
    await options.adjustCredits(character.id, -250, 'Bought ammunition')
    await options.setVisibility(piece, 'HIDDEN')
    await options.setFreedom(piece, 'UNLOCKED')
    await options.rollSkill(piece, character, 'Pilot', 'Pilot check')
    const creationActions = options.getCharacterCreationActions?.(character)
    const creationButton = createdElements.find(
      (element) => element.tagName === 'button'
    )
    creationButton?.listeners.click?.()
    options.reportError('failed')
    controller.render()

    assert.deepEqual(sheetCommands, [
      {
        type: 'UpdateCharacterSheet',
        gameId,
        actorId,
        characterId: character.id,
        notes: 'Updated'
      },
      {
        type: 'UpdateCharacterSheet',
        gameId,
        actorId,
        characterId: character.id,
        notes: 'Updated'
      },
      {
        type: 'AddCharacterEquipmentItem',
        gameId,
        actorId,
        characterId: character.id,
        item: {
          id: 'vacc-suit-1',
          name: 'Vacc suit',
          quantity: 1,
          notes: ''
        }
      },
      {
        type: 'UpdateCharacterEquipmentItem',
        gameId,
        actorId,
        characterId: character.id,
        itemId: 'vacc-suit-1',
        patch: {
          quantity: 2
        }
      },
      {
        type: 'RemoveCharacterEquipmentItem',
        gameId,
        actorId,
        characterId: character.id,
        itemId: 'vacc-suit-1'
      },
      {
        type: 'AdjustCharacterCredits',
        gameId,
        actorId,
        characterId: character.id,
        ledgerEntryId: (sheetCommands[5] as { ledgerEntryId?: string })
          .ledgerEntryId,
        amount: -250,
        reason: 'Bought ammunition'
      },
      {
        type: 'SetPieceVisibility',
        gameId,
        actorId,
        pieceId: piece.id,
        visibility: 'HIDDEN'
      },
      {
        type: 'SetPieceFreedom',
        gameId,
        actorId,
        pieceId: piece.id,
        freedom: 'UNLOCKED'
      },
      {
        type: 'RollDice',
        gameId,
        actorId,
        expression: '2d6',
        reason: 'Pilot check'
      }
    ])
    assert.equal(creationActions?.title, 'Creation')
    assert.deepEqual(
      characterCreationCommands.map((command) => command.type),
      ['StartCharacterCreation']
    )
    assert.deepEqual(errors, ['failed'])
  })
})
