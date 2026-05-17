import { requireState } from './state'
import type { EventHandlerMap } from './types'

type NoteEventType =
  | 'NoteCreated'
  | 'NoteUpdated'
  | 'NoteDeleted'
  | 'NoteVisibilityChanged'

export const noteEventHandlers = {
  NoteCreated: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    nextState.notes ??= {}

    nextState.notes[event.noteId] = {
      id: event.noteId,
      title: event.title,
      body: event.body,
      visibility: event.visibility,
      ownerId: event.ownerId,
      createdAt: envelope.createdAt,
      updatedAt: envelope.createdAt,
      updatedBy: envelope.actorId
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

  NoteUpdated: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    nextState.notes ??= {}
    const note = nextState.notes[event.noteId]
    if (!note) return nextState

    if (event.title !== undefined) note.title = event.title
    if (event.body !== undefined) note.body = event.body
    note.updatedAt = envelope.createdAt
    note.updatedBy = envelope.actorId
    nextState.eventSeq = envelope.seq

    return nextState
  },

  NoteDeleted: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    nextState.notes ??= {}

    delete nextState.notes[event.noteId]
    nextState.eventSeq = envelope.seq

    return nextState
  },

  NoteVisibilityChanged: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    nextState.notes ??= {}
    const note = nextState.notes[event.noteId]
    if (!note) return nextState

    note.visibility = event.visibility
    note.updatedAt = envelope.createdAt
    note.updatedBy = envelope.actorId
    nextState.eventSeq = envelope.seq

    return nextState
  }
} satisfies EventHandlerMap<NoteEventType>
