import type { NoteCommand } from '../core/command-router.js'
import type { ClientIdentity } from '../../game-commands.js'
import { asNoteId, type NoteId } from '../../../shared/ids'
import type {
  GameState,
  NoteState,
  NoteVisibility
} from '../../../shared/state'

export interface NotesPanelElements {
  openButton: HTMLButtonElement
  panel: HTMLElement
  closeButton: HTMLButtonElement
  list: HTMLElement
  titleInput: HTMLInputElement
  bodyInput: HTMLTextAreaElement
  visibilitySelect: HTMLSelectElement
  newButton: HTMLButtonElement
  saveButton: HTMLButtonElement
  deleteButton: HTMLButtonElement
  status: HTMLElement
}

export interface NotesPanelController {
  render(): void
  dispose(): void
}

export interface NotesPanelOptions {
  elements: NotesPanelElements
  getState: () => GameState | null
  getIdentity: () => ClientIdentity
  canEdit: () => boolean
  dispatchNotes: (commands: readonly NoteCommand[]) => Promise<unknown>
  reportError: (message: string) => void
}

const visibilityLabels: Record<NoteVisibility, string> = {
  REFEREE: 'Referee',
  PLAYERS: 'Players',
  PUBLIC: 'Public'
}

const noteList = (state: GameState | null): NoteState[] =>
  Object.values(state?.notes ?? {}).sort((left, right) => {
    const updated = right.updatedAt.localeCompare(left.updatedAt)
    return updated === 0 ? left.title.localeCompare(right.title) : updated
  })

const parseVisibility = (value: string): NoteVisibility =>
  value === 'REFEREE' || value === 'PUBLIC' ? value : 'PLAYERS'

const uniqueNoteId = (state: GameState | null): NoteId => {
  const notes = state?.notes ?? {}
  for (let index = Object.keys(notes).length + 1; index < 10000; index += 1) {
    const id = asNoteId(`note-${index}`)
    if (!notes[id]) return id
  }
  throw new Error('Could not allocate note id')
}

export const createNotesPanelController = ({
  elements,
  getState,
  getIdentity,
  canEdit,
  dispatchNotes,
  reportError
}: NotesPanelOptions): NotesPanelController => {
  const listeners: Array<() => void> = []
  let selectedNoteId: NoteId | null = null

  const addListener = (
    target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>,
    type: string,
    listener: EventListener
  ): void => {
    target.addEventListener(type, listener)
    listeners.push(() => target.removeEventListener(type, listener))
  }

  const selectedNote = (): NoteState | null => {
    if (!selectedNoteId) return null
    return getState()?.notes?.[selectedNoteId] ?? null
  }

  const setOpen = (open: boolean): void => {
    elements.panel.classList.toggle('open', open)
    elements.openButton.setAttribute('aria-expanded', open ? 'true' : 'false')
  }

  const clearEditor = (): void => {
    selectedNoteId = null
    elements.titleInput.value = ''
    elements.bodyInput.value = ''
    elements.visibilitySelect.value = 'PLAYERS'
    elements.status.textContent = 'New note'
  }

  const selectNote = (noteId: NoteId): void => {
    selectedNoteId = noteId
    render()
  }

  const renderList = (notes: readonly NoteState[]): void => {
    const document = elements.list.ownerDocument
    const children =
      notes.length === 0
        ? [document.createTextNode('No notes or handouts')]
        : notes.map((note) => {
            const button = document.createElement('button')
            button.type = 'button'
            button.className = `note-list-button${
              note.id === selectedNoteId ? ' active' : ''
            }`
            const title = document.createElement('span')
            title.className = 'note-list-title'
            title.textContent = note.title
            const meta = document.createElement('span')
            meta.className = 'note-list-meta'
            meta.textContent = visibilityLabels[note.visibility]
            button.append(title, meta)
            button.addEventListener('click', () => selectNote(note.id))
            return button
          })
    elements.list.replaceChildren(...children)
  }

  const renderEditor = (): void => {
    const note = selectedNote()
    const editable = canEdit()
    elements.titleInput.disabled = !editable
    elements.bodyInput.disabled = !editable
    elements.visibilitySelect.disabled = !editable
    elements.newButton.disabled = !editable
    elements.saveButton.disabled = !editable
    elements.deleteButton.disabled = !editable || !note

    if (!note) {
      if (!editable) {
        elements.titleInput.value = ''
        elements.bodyInput.value = ''
        elements.status.textContent = 'No visible handout selected'
      }
      return
    }

    elements.titleInput.value = note.title
    elements.bodyInput.value = note.body
    elements.visibilitySelect.value = note.visibility
    elements.status.textContent = editable
      ? visibilityLabels[note.visibility]
      : `${visibilityLabels[note.visibility]} handout`
  }

  const render = (): void => {
    const notes = noteList(getState())
    if (selectedNoteId && !notes.some((note) => note.id === selectedNoteId)) {
      selectedNoteId = null
    }
    if (!selectedNoteId && notes.length > 0)
      selectedNoteId = notes[0]?.id ?? null

    renderList(notes)
    renderEditor()
  }

  const save = async (): Promise<void> => {
    const state = getState()
    if (!canEdit()) return

    const identity = getIdentity()
    const title = elements.titleInput.value.trim() || 'Untitled note'
    const body = elements.bodyInput.value
    const visibility = parseVisibility(elements.visibilitySelect.value)
    const note = selectedNote()
    const commands: NoteCommand[] = []

    if (!note) {
      commands.push({
        type: 'CreateNote',
        ...identity,
        noteId: uniqueNoteId(state),
        title,
        body,
        visibility
      })
    } else {
      if (title !== note.title || body !== note.body) {
        commands.push({
          type: 'UpdateNote',
          ...identity,
          noteId: note.id,
          title,
          body
        })
      }
      if (visibility !== note.visibility) {
        commands.push({
          type: 'SetNoteVisibility',
          ...identity,
          noteId: note.id,
          visibility
        })
      }
    }

    if (commands.length === 0) return
    await dispatchNotes(commands)
    elements.status.textContent = 'Saved'
  }

  const remove = async (): Promise<void> => {
    const note = selectedNote()
    if (!note || !canEdit()) return
    await dispatchNotes([
      {
        type: 'DeleteNote',
        ...getIdentity(),
        noteId: note.id
      }
    ])
    clearEditor()
  }

  addListener(elements.openButton, 'click', () => {
    setOpen(!elements.panel.classList.contains('open'))
    render()
  })
  addListener(elements.closeButton, 'click', () => setOpen(false))
  addListener(elements.newButton, 'click', clearEditor)
  addListener(elements.saveButton, 'click', () => {
    save().catch((error: Error) => reportError(error.message))
  })
  addListener(elements.deleteButton, 'click', () => {
    remove().catch((error: Error) => reportError(error.message))
  })

  render()

  return {
    render,
    dispose: () => {
      for (const removeListener of listeners.splice(0)) removeListener()
    }
  }
}
