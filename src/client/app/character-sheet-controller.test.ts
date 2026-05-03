import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type {
  BoardId,
  CharacterId,
  GameId,
  PieceId,
  UserId
} from '../../shared/ids'
import type {
  BoardState,
  CharacterSheetPatch,
  CharacterState,
  GameState,
  PieceFreedom,
  PieceState,
  PieceVisibility
} from '../../shared/state'
import {
  createCharacterSheetController,
  nullableNumberFromValue
} from './character-sheet-controller'

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
}) => {
  const sheet = new TestElement('aside')
  const sheetName = new TestElement('h2')
  const sheetBody = new TestElement('div')
  const detailTab = new TestElement('button')
  detailTab.dataset.sheetTab = 'details'
  const actionTab = new TestElement('button')
  actionTab.dataset.sheetTab = 'action'
  const patches: { target: string; patch: CharacterSheetPatch }[] = []
  const visibility: PieceVisibility[] = []
  const freedom: PieceFreedom[] = []
  const rolls: string[] = []
  const errors: string[] = []

  const controller = createCharacterSheetController({
    elements: {
      sheet: asElement(sheet),
      sheetName: asElement(sheetName),
      sheetBody: asElement(sheetBody),
      sheetTabs: [asElement(detailTab), asElement(actionTab)]
    },
    document: documentApi as unknown as Document,
    getSelectedPiece: () => options.selectedPiece,
    getSelectedBoard: () => board(),
    getCharacterState: () => options.state,
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
    reportError: (message) => errors.push(message)
  })

  return {
    controller,
    elements: { sheet, sheetName, sheetBody, detailTab, actionTab },
    calls: { patches, visibility, freedom, rolls, errors }
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

  it('parses nullable numeric form values', () => {
    assert.equal(nullableNumberFromValue(''), null)
    assert.equal(nullableNumberFromValue(' 42 '), 42)
    assert.equal(nullableNumberFromValue('not a number'), null)
  })
})
