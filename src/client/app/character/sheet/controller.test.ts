import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type {
  BoardId,
  CharacterId,
  GameId,
  PieceId,
  UserId
} from '../../../../shared/ids'
import { asEventId, asUserId } from '../../../../shared/ids'
import type {
  BoardState,
  CharacterSheetPatch,
  CharacterState,
  GameState,
  PieceFreedom,
  PieceState,
  PieceVisibility
} from '../../../../shared/state'
import {
  createCharacterSheetController,
  nullableNumberFromValue
} from './controller'

class TestClassList {
  private classes = new Set<string>()

  toggle(name: string, force?: boolean) {
    const shouldInclude = force ?? !this.classes.has(name)
    if (shouldInclude) this.classes.add(name)
    else this.classes.delete(name)
    return shouldInclude
  }

  contains(name: string) {
    return this.classes.has(name)
  }
}

class TestElement {
  tagName: string
  children: TestElement[] = []
  className = ''
  classList = new TestClassList()
  dataset: Record<string, string> = {}
  textContent = ''
  title = ''
  type = ''
  name = ''
  inputMode = ''
  autocomplete = ''
  value = ''
  placeholder = ''
  spellcheck = true
  disabled = false
  private listeners: Record<string, (() => void)[]> = {}

  constructor(tagName: string) {
    this.tagName = tagName
  }

  append(...nodes: TestElement[]) {
    this.children.push(...nodes)
  }

  replaceChildren(...nodes: TestElement[]) {
    this.children = nodes
  }

  addEventListener(type: string, listener: () => void) {
    this.listeners[type] = [...(this.listeners[type] || []), listener]
  }

  click() {
    for (const listener of this.listeners.click || []) listener()
  }
}

const documentApi = {
  createElement: (tagName: string) => new TestElement(tagName)
}

const asElement = (element: TestElement) => element as unknown as HTMLElement

const findAll = (
  element: TestElement,
  predicate: (candidate: TestElement) => boolean
): TestElement[] => [
  ...(predicate(element) ? [element] : []),
  ...element.children.flatMap((child) => findAll(child, predicate))
]

const findByText = (element: TestElement, text: string) => {
  const match = findAll(
    element,
    (candidate) => candidate.textContent === text
  )[0]
  if (!match) throw new Error(`Expected element with text "${text}"`)
  return match
}

const characterId = 'scout-character' as CharacterId

const character = (
  overrides: Partial<CharacterState> = {}
): CharacterState => ({
  id: characterId,
  ownerId: null,
  type: 'PLAYER',
  name: 'Scout',
  active: true,
  notes: 'Known contacts on Regina.',
  age: 34,
  characteristics: {
    str: 6,
    dex: 8,
    end: 7,
    int: 9,
    edu: 10,
    soc: 6
  },
  skills: ['Recon-0', 'Vacc Suit-0'],
  equipment: [{ name: 'Laser Pistol', quantity: 1, notes: '3D6' }],
  credits: 1200,
  creation: null,
  ...overrides
})

const piece = (overrides: Partial<PieceState> = {}): PieceState => ({
  id: 'scout-token' as PieceId,
  boardId: 'main-board' as BoardId,
  characterId,
  imageAssetId: null,
  name: 'Scout Token',
  x: 12,
  y: 18,
  z: 0,
  width: 50,
  height: 50,
  scale: 1,
  visibility: 'VISIBLE',
  freedom: 'UNLOCKED',
  ...overrides
})

const gameState = (characters: GameState['characters']): GameState => ({
  id: 'game' as GameId,
  slug: 'game',
  name: 'Game',
  ownerId: 'owner' as UserId,
  players: {},
  characters,
  boards: {},
  pieces: {},
  diceLog: [],
  selectedBoardId: null,
  eventSeq: 0
})

const board = (): BoardState => ({
  id: 'main-board' as BoardId,
  name: 'Main Board',
  imageAssetId: null,
  url: null,
  width: 1000,
  height: 1000,
  scale: 50,
  doors: {}
})

const createHarness = (options: {
  selectedPiece: PieceState | null
  state: GameState | null
  doorActions?: TestElement | null
  canEditSheetFields?: boolean
}) => {
  const sheet = new TestElement('aside')
  const sheetName = new TestElement('h2')
  const sheetBody = new TestElement('div')
  const detailTab = new TestElement('button')
  detailTab.dataset.sheetTab = 'details'
  const actionTab = new TestElement('button')
  actionTab.dataset.sheetTab = 'action'
  const itemsTab = new TestElement('button')
  itemsTab.dataset.sheetTab = 'items'
  const patches: { target: string; patch: CharacterSheetPatch }[] = []
  const visibility: PieceVisibility[] = []
  const freedom: PieceFreedom[] = []
  const rolls: string[] = []
  const addedEquipment: Array<{
    characterId: string
    item: { id: string; name: string; quantity: number; notes: string }
  }> = []
  const updatedEquipment: Array<{
    characterId: string
    itemId: string
    patch: { name?: string; quantity?: number; notes?: string }
  }> = []
  const removedEquipment: Array<{ characterId: string; itemId: string }> = []
  const creditAdjustments: Array<{
    characterId: string
    amount: number
    reason: string
  }> = []
  const errors: string[] = []

  const controller = createCharacterSheetController({
    elements: {
      sheet: asElement(sheet),
      sheetName: asElement(sheetName),
      sheetBody: asElement(sheetBody),
      sheetTabs: [
        asElement(detailTab),
        asElement(actionTab),
        asElement(itemsTab)
      ]
    },
    document: documentApi as unknown as Document,
    getSelectedPiece: () => options.selectedPiece,
    getSelectedBoard: () => board(),
    getCharacterState: () => options.state,
    canEditSheetFields: () => options.canEditSheetFields ?? true,
    getBoardDoorActions: () => ({
      actions: options.doorActions ? asElement(options.doorActions) : null
    }),
    sendPatch: (target, patch) => {
      patches.push({ target: String(target), patch })
      return Promise.resolve()
    },
    setVisibility: (_piece, nextVisibility) => {
      visibility.push(nextVisibility)
      return Promise.resolve()
    },
    setFreedom: (_piece, nextFreedom) => {
      freedom.push(nextFreedom)
      return Promise.resolve()
    },
    rollSkill: (_piece, _character, _skill, reason) => {
      rolls.push(reason)
      return Promise.resolve()
    },
    addEquipmentItem: (nextCharacterId, item) => {
      addedEquipment.push({ characterId: nextCharacterId, item })
      return Promise.resolve()
    },
    updateEquipmentItem: (nextCharacterId, itemId, patch) => {
      updatedEquipment.push({ characterId: nextCharacterId, itemId, patch })
      return Promise.resolve()
    },
    removeEquipmentItem: (nextCharacterId, itemId) => {
      removedEquipment.push({ characterId: nextCharacterId, itemId })
      return Promise.resolve()
    },
    adjustCredits: (nextCharacterId, amount, reason) => {
      creditAdjustments.push({ characterId: nextCharacterId, amount, reason })
      return Promise.resolve()
    },
    createEquipmentItemId: () => 'new-equipment-1',
    reportError: (message) => errors.push(message)
  })

  return {
    controller,
    elements: { sheet, sheetName, sheetBody, detailTab, actionTab, itemsTab },
    calls: {
      patches,
      visibility,
      freedom,
      rolls,
      addedEquipment,
      updatedEquipment,
      removedEquipment,
      creditAdjustments,
      errors
    }
  }
}

describe('character sheet controller', () => {
  it('renders the empty selection state and controls open state', () => {
    const doorActions = new TestElement('div')
    doorActions.textContent = 'Open Airlock'
    const harness = createHarness({
      selectedPiece: null,
      state: gameState({}),
      doorActions
    })

    harness.controller.setOpen(true)
    harness.controller.render()

    assert.equal(harness.controller.isOpen(), true)
    assert.equal(harness.elements.sheet.classList.contains('open'), true)
    assert.equal(harness.elements.sheetName.textContent, 'No piece')
    findByText(harness.elements.sheetBody, 'No active token')
    findByText(harness.elements.sheetBody, 'Main Board')
    findByText(harness.elements.sheetBody, 'Doors')
    findByText(harness.elements.sheetBody, 'Open Airlock')
  })

  it('renders skill actions and sends skill editor patches', () => {
    const scout = character()
    const harness = createHarness({
      selectedPiece: piece(),
      state: gameState({ [characterId]: scout })
    })

    harness.controller.selectTab('action')

    assert.equal(harness.elements.actionTab.classList.contains('active'), true)
    assert.equal(harness.elements.sheetName.textContent, 'Scout')
    const recon = findByText(harness.elements.sheetBody, 'Recon-0')
    recon.click()
    assert.deepEqual(harness.calls.rolls, ['Scout: Recon-0'])

    const textarea = findAll(
      harness.elements.sheetBody,
      (candidate) => candidate.tagName === 'textarea'
    )[0]
    if (!textarea) throw new Error('Expected skills textarea')
    textarea.value = 'Pilot-1, Recon-0\nVacc Suit-0'
    findByText(harness.elements.sheetBody, 'Save skills').click()

    assert.deepEqual(harness.calls.patches, [
      {
        target: characterId,
        patch: { skills: ['Pilot-1', 'Recon-0', 'Vacc Suit-0'] }
      }
    ])
  })

  it('sends stat editor patches when canonical sheet fields are editable', () => {
    const scout = character()
    const harness = createHarness({
      selectedPiece: piece(),
      state: gameState({ [characterId]: scout })
    })

    harness.controller.render()

    const inputs = findAll(
      harness.elements.sheetBody,
      (candidate) => candidate.tagName === 'input'
    )
    const age = inputs.find((input) => input.name === 'age')
    const str = inputs.find((input) => input.name === 'str')
    if (!age || !str) throw new Error('Expected age and STR inputs')
    age.value = '35'
    str.value = '7'
    findByText(harness.elements.sheetBody, 'Save').click()

    assert.deepEqual(harness.calls.patches, [
      {
        target: characterId,
        patch: {
          age: 35,
          characteristics: {
            str: 7,
            dex: 8,
            end: 7,
            int: 9,
            edu: 10,
            soc: 6
          }
        }
      }
    ])
  })

  it('keeps canonical sheet fields read-only when only notes are editable', () => {
    const scout = character()
    const harness = createHarness({
      selectedPiece: piece(),
      state: gameState({ [characterId]: scout }),
      canEditSheetFields: false
    })

    harness.controller.render()
    assert.equal(harness.elements.sheetName.textContent, 'Scout')
    assert.equal(
      findAll(
        harness.elements.sheetBody,
        (candidate) => candidate.tagName === 'input'
      ).length,
      0
    )
    assert.equal(
      findAll(
        harness.elements.sheetBody,
        (candidate) => candidate.textContent === 'Edit'
      ).length,
      0
    )

    harness.controller.selectTab('action')
    findByText(harness.elements.sheetBody, 'Recon-0').click()
    assert.deepEqual(harness.calls.rolls, ['Scout: Recon-0'])
    assert.equal(
      findAll(
        harness.elements.sheetBody,
        (candidate) => candidate.tagName === 'textarea'
      ).length,
      0
    )
    assert.equal(
      findAll(
        harness.elements.sheetBody,
        (candidate) => candidate.textContent === 'Save skills'
      ).length,
      0
    )

    harness.controller.selectTab('items')
    findByText(harness.elements.sheetBody, 'Laser Pistol')
    assert.equal(
      findAll(
        harness.elements.sheetBody,
        (candidate) => candidate.tagName === 'input'
      ).length,
      0
    )
    assert.equal(
      findAll(
        harness.elements.sheetBody,
        (candidate) => candidate.textContent === 'Save items'
      ).length,
      0
    )

    harness.controller.selectTab('notes')
    const notes = findAll(
      harness.elements.sheetBody,
      (candidate) => candidate.tagName === 'textarea'
    )[0]
    if (!notes) throw new Error('Expected notes textarea')
    notes.value = 'Updated notes'
    findByText(harness.elements.sheetBody, 'Save').click()

    assert.deepEqual(harness.calls.patches, [
      {
        target: characterId,
        patch: { notes: 'Updated notes' }
      }
    ])
  })

  it('sends token visibility and freedom actions from details', () => {
    const harness = createHarness({
      selectedPiece: piece({ characterId: null }),
      state: gameState({})
    })

    harness.controller.render()
    findByText(harness.elements.sheetBody, 'preview').click()
    findByText(harness.elements.sheetBody, 'Lock').click()

    assert.deepEqual(harness.calls.visibility, ['PREVIEW'])
    assert.deepEqual(harness.calls.freedom, ['LOCKED'])
  })

  it('renders recovered character creation timeline in details', () => {
    const scout = character({
      skills: ['Vacc Suit-0', 'Broker-2', 'Recon-0', 'Recon-0'],
      creation: {
        state: {
          status: 'PLAYABLE',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        terms: [
          {
            career: 'Scout',
            skills: [],
            skillsAndTraining: [],
            benefits: [],
            complete: true,
            canReenlist: true,
            completedBasicTraining: false,
            musteringOut: false,
            anagathics: false,
            facts: {
              musteringBenefits: [
                {
                  career: 'Scout',
                  kind: 'material',
                  roll: { expression: '2d6', rolls: [4, 4], total: 8 },
                  modifier: 0,
                  tableRoll: 8,
                  value: 'High Passage',
                  credits: 0,
                  materialItem: 'High Passage'
                }
              ]
            }
          }
        ],
        careers: [{ name: 'Scout', rank: 0 }],
        canEnterDraft: true,
        failedToQualify: false,
        characteristicChanges: [],
        creationComplete: true,
        timeline: [
          {
            eventId: asEventId('event-1'),
            seq: 1,
            createdAt: '2026-05-03T00:00:01.000Z',
            eventType: 'CharacterCreationCharacteristicsCompleted'
          },
          {
            eventId: asEventId('event-2'),
            seq: 2,
            createdAt: '2026-05-03T00:00:02.000Z',
            eventType: 'CharacterCreationCompleted'
          }
        ]
      }
    })
    const harness = createHarness({
      selectedPiece: piece(),
      state: gameState({ [characterId]: scout })
    })

    harness.controller.render()

    findByText(harness.elements.sheetBody, 'UPP')
    findByText(harness.elements.sheetBody, '6879A6')
    findByText(harness.elements.sheetBody, 'Steps')
    findByText(harness.elements.sheetBody, '2')
    findByText(harness.elements.sheetBody, 'Latest')
    findByText(harness.elements.sheetBody, 'Completed')
    findByText(harness.elements.sheetBody, 'Final Character')
    const finalCard = findAll(
      harness.elements.sheetBody,
      (candidate) => candidate.className === 'sheet-final-card'
    )[0]
    if (!finalCard) throw new Error('Expected final character summary card')
    assert.equal(
      findAll(
        finalCard,
        (candidate) => candidate.className === 'sheet-final-stat'
      ).length,
      6
    )
    assert.deepEqual(
      findAll(
        finalCard,
        (candidate) => candidate.className === 'sheet-final-skill-chip'
      ).map((candidate) => candidate.textContent),
      ['Broker-2', 'Recon-0', 'Vacc Suit-0']
    )
    findByText(harness.elements.sheetBody, 'Homeworld')
    findByText(harness.elements.sheetBody, 'Unspecified')
    findByText(harness.elements.sheetBody, 'Characteristics')
    findByText(
      harness.elements.sheetBody,
      'Str 6, Dex 8, End 7, Int 9 (+1), Edu 10 (+1), Soc 6'
    )
    findByText(harness.elements.sheetBody, 'Careers')
    findByText(harness.elements.sheetBody, 'Scout rank 0')
    findByText(harness.elements.sheetBody, 'Skills')
    findByText(harness.elements.sheetBody, 'Broker-2, Recon-0, Vacc Suit-0')
    findByText(harness.elements.sheetBody, 'Credits')
    findByText(harness.elements.sheetBody, 'Cr1200')
    findByText(harness.elements.sheetBody, 'Equipment')
    findByText(harness.elements.sheetBody, 'Laser Pistol x1 (3D6)')
    findByText(harness.elements.sheetBody, 'Career History')
    findByText(
      harness.elements.sheetBody,
      'Term 1: Scout'
    )
    findByText(
      harness.elements.sheetBody,
      'benefits High Passage (Scout material benefit; roll 8; DM 0; table 8); term complete'
    )
    findByText(harness.elements.sheetBody, 'Plain Export')
    findByText(
      harness.elements.sheetBody,
      [
        'Scout',
        'UPP: 6879A6',
        'Characteristics: Str 6, Dex 8, End 7, Int 9 (+1), Edu 10 (+1), Soc 6',
        'Type: PLAYER',
        'Age: 34',
        'Homeworld: Unspecified',
        'Careers: Scout rank 0',
        'Terms: 1',
        'Skills: Broker-2, Recon-0, Vacc Suit-0',
        'Credits: Cr1200',
        'Equipment: Laser Pistol x1 (3D6)',
        'Career History:',
        '- Term 1: Scout - benefits High Passage (Scout material benefit; roll 8; DM 0; table 8); term complete',
        'Notes:',
        'Known contacts on Regina.'
      ].join('\n')
    )
  })

  it('edits items with event-backed row controls instead of textarea text', () => {
    const scout = character({
      credits: 950,
      ledger: [
        {
          id: 'ledger-1',
          actorId: asUserId('referee'),
          createdAt: '2026-05-03T12:10:00.000Z',
          amount: -250,
          balance: 950,
          reason: 'Bought ammunition'
        }
      ]
    })
    const harness = createHarness({
      selectedPiece: piece(),
      state: gameState({ [characterId]: scout })
    })

    harness.controller.selectTab('items')

    assert.equal(harness.elements.itemsTab.classList.contains('active'), true)
    findByText(harness.elements.sheetBody, 'Credit Ledger')
    findByText(
      harness.elements.sheetBody,
      'Cr-250 -> Cr950: Bought ammunition (2026-05-03, referee)'
    )
    findByText(harness.elements.sheetBody, 'Laser Pistol')
    const inputs = findAll(
      harness.elements.sheetBody,
      (candidate) => candidate.tagName === 'input'
    )
    const nameInput = inputs.find((input) => input.name === 'equipmentName')
    const quantityInput = inputs.find(
      (input) => input.name === 'equipmentQuantity'
    )
    const notesInput = inputs.find((input) => input.name === 'equipmentNotes')
    if (!nameInput || !quantityInput || !notesInput) {
      throw new Error('Expected equipment row inputs')
    }
    nameInput.value = 'Cutlass'
    quantityInput.value = '2'
    notesInput.value = 'Ceremonial'
    findByText(harness.elements.sheetBody, 'Update').click()

    assert.deepEqual(harness.calls.updatedEquipment, [
      {
        characterId,
        itemId: 'Laser Pistol',
        patch: {
          name: 'Cutlass',
          quantity: 2,
          notes: 'Ceremonial'
        }
      }
    ])

    findByText(harness.elements.sheetBody, 'Remove').click()
    assert.deepEqual(harness.calls.removedEquipment, [
      { characterId, itemId: 'Laser Pistol' }
    ])

    const newName = inputs.find((input) => input.name === 'newEquipmentName')
    const newQuantity = inputs.find(
      (input) => input.name === 'newEquipmentQuantity'
    )
    const newNotes = inputs.find((input) => input.name === 'newEquipmentNotes')
    if (!newName || !newQuantity || !newNotes) {
      throw new Error('Expected new equipment row inputs')
    }
    newName.value = 'Medkit'
    newQuantity.value = '1'
    newNotes.value = 'Field issue'
    findByText(harness.elements.sheetBody, 'Add item').click()
    assert.deepEqual(harness.calls.addedEquipment, [
      {
        characterId,
        item: {
          id: 'new-equipment-1',
          name: 'Medkit',
          quantity: 1,
          notes: 'Field issue'
        }
      }
    ])

    const creditAmount = inputs.find((input) => input.name === 'creditAmount')
    const creditReason = inputs.find((input) => input.name === 'creditReason')
    if (!creditAmount || !creditReason) {
      throw new Error('Expected credit ledger inputs')
    }
    creditAmount.value = '-250'
    creditReason.value = 'Bought ammunition'
    findByText(harness.elements.sheetBody, 'Record credits').click()
    assert.deepEqual(harness.calls.creditAdjustments, [
      {
        characterId,
        amount: -250,
        reason: 'Bought ammunition'
      }
    ])
  })

  it('parses nullable numeric form values', () => {
    assert.equal(nullableNumberFromValue(''), null)
    assert.equal(nullableNumberFromValue(' 42 '), 42)
    assert.equal(nullableNumberFromValue('not a number'), null)
  })
})
