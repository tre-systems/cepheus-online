import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { NoteCommand } from '../core/command-router'
import { asGameId, asNoteId, asUserId } from '../../../shared/ids'
import type { GameState } from '../../../shared/state'
import { createNotesPanelController } from './controller'

class FakeClassList {
  readonly values = new Set<string>()

  contains(value: string): boolean {
    return this.values.has(value)
  }

  toggle(value: string, force?: boolean): boolean {
    const next = force ?? !this.values.has(value)
    if (next) this.values.add(value)
    else this.values.delete(value)
    return next
  }
}

class FakeElement {
  readonly listeners: Record<string, EventListener[]> = {}
  readonly classList = new FakeClassList()
  readonly ownerDocument = fakeDocument
  readonly children: unknown[] = []
  textContent = ''
  className = ''
  type = ''
  disabled = false
  value = ''
  attributes = new Map<string, string>()

  addEventListener(type: string, listener: EventListener): void {
    this.listeners[type] = [...(this.listeners[type] ?? []), listener]
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners[type] = (this.listeners[type] ?? []).filter(
      (candidate) => candidate !== listener
    )
  }

  dispatch(type: string): void {
    for (const listener of this.listeners[type] ?? []) {
      listener(new Event(type))
    }
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value)
  }

  append(...children: unknown[]): void {
    this.children.push(...children)
  }

  replaceChildren(...children: unknown[]): void {
    this.children.splice(0, this.children.length, ...children)
  }
}

const fakeDocument = {
  createElement: () => new FakeElement(),
  createTextNode: (text: string) => ({ textContent: text })
}

const baseState = (): GameState => ({
  id: asGameId('room-1'),
  slug: 'room-1',
  name: 'Room 1',
  ownerId: asUserId('ref-1'),
  players: {},
  characters: {},
  boards: {},
  pieces: {},
  notes: {
    [asNoteId('note-1')]: {
      id: asNoteId('note-1'),
      title: 'Patron',
      body: 'Meet at the highport.',
      visibility: 'PLAYERS',
      ownerId: asUserId('ref-1'),
      createdAt: '2026-05-17T00:00:00.000Z',
      updatedAt: '2026-05-17T00:00:00.000Z',
      updatedBy: asUserId('ref-1')
    }
  },
  diceLog: [],
  selectedBoardId: null,
  eventSeq: 1
})

const createHarness = ({
  editable = true,
  state = baseState()
}: {
  editable?: boolean
  state?: GameState | null
} = {}) => {
  const elements = {
    openButton: new FakeElement(),
    panel: new FakeElement(),
    closeButton: new FakeElement(),
    list: new FakeElement(),
    titleInput: new FakeElement(),
    bodyInput: new FakeElement(),
    visibilitySelect: new FakeElement(),
    newButton: new FakeElement(),
    saveButton: new FakeElement(),
    deleteButton: new FakeElement(),
    status: new FakeElement()
  }
  const batches: NoteCommand[][] = []
  const errors: string[] = []

  const controller = createNotesPanelController({
    elements: elements as unknown as Parameters<
      typeof createNotesPanelController
    >[0]['elements'],
    getState: () => state,
    getIdentity: () => ({
      gameId: asGameId('room-1'),
      actorId: asUserId('ref-1')
    }),
    canEdit: () => editable,
    dispatchNotes: async (commands) => {
      batches.push(Array.from(commands))
    },
    reportError: (message) => errors.push(message)
  })

  return { controller, elements, batches, errors }
}

describe('notes panel controller', () => {
  it('renders notes and opens the panel', () => {
    const harness = createHarness()

    harness.elements.openButton.dispatch('click')

    assert.equal(harness.elements.panel.classList.contains('open'), true)
    assert.equal(harness.elements.titleInput.value, 'Patron')
    assert.equal(harness.elements.bodyInput.value, 'Meet at the highport.')
    assert.equal(harness.elements.list.children.length, 1)
  })

  it('creates a new plain-text note command', async () => {
    const harness = createHarness({ state: { ...baseState(), notes: {} } })
    harness.elements.titleInput.value = 'Signal'
    harness.elements.bodyInput.value = 'Plain text only.'
    harness.elements.visibilitySelect.value = 'PUBLIC'

    harness.elements.saveButton.dispatch('click')
    await new Promise((resolve) => setTimeout(resolve, 0))

    const command = harness.batches[0]?.[0]
    assert.equal(command?.type, 'CreateNote')
    if (command?.type !== 'CreateNote') return
    assert.equal(command.noteId, 'note-1')
    assert.equal(command.title, 'Signal')
    assert.equal(command.body, 'Plain text only.')
    assert.equal(command.visibility, 'PUBLIC')
  })

  it('keeps visible handouts read-only for non-referees', () => {
    const harness = createHarness({ editable: false })

    assert.equal(harness.elements.titleInput.disabled, true)
    assert.equal(harness.elements.bodyInput.disabled, true)
    assert.equal(harness.elements.saveButton.disabled, true)
    assert.equal(harness.elements.bodyInput.value, 'Meet at the highport.')
  })
})
