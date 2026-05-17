import type { GameCommand } from '../../shared/commands'
import type { CommandTypeForHandlerDomain } from '../../shared/command-metadata'
import type { GameEvent } from '../../shared/events'
import type { CommandError } from '../../shared/protocol'
import { err, ok, type Result } from '../../shared/result'
import {
  commandError,
  type CommandContext,
  isReferee,
  notAllowed,
  requireGame,
  requireNonEmptyString
} from './command-helpers'

type NoteCommand = Extract<
  GameCommand,
  { type: CommandTypeForHandlerDomain<'note'> }
>

export const deriveNoteCommandEvents = (
  command: NoteCommand,
  context: CommandContext
): Result<GameEvent[], CommandError> => {
  const state = requireGame(context.state)
  if (!state.ok) return state

  if (!isReferee(state.value, command.actorId)) {
    return notAllowed('Only a referee can change notes and handouts')
  }

  switch (command.type) {
    case 'CreateNote': {
      const notes = state.value.notes ?? {}
      if (notes[command.noteId]) {
        return err(commandError('duplicate_entity', 'Note already exists'))
      }
      const title = requireNonEmptyString(command.title, 'title')
      if (!title.ok) return title

      return ok([
        {
          type: 'NoteCreated',
          noteId: command.noteId,
          title: title.value,
          body: command.body,
          visibility: command.visibility,
          ownerId: command.actorId
        }
      ])
    }

    case 'UpdateNote': {
      const notes = state.value.notes ?? {}
      if (!notes[command.noteId]) {
        return err(commandError('missing_entity', 'Note does not exist'))
      }
      if (command.title === undefined && command.body === undefined) {
        return err(
          commandError(
            'invalid_command',
            'UpdateNote must include title or body'
          )
        )
      }
      const title =
        command.title === undefined
          ? undefined
          : requireNonEmptyString(command.title, 'title')
      if (title && !title.ok) return title

      return ok([
        {
          type: 'NoteUpdated',
          noteId: command.noteId,
          ...(title === undefined ? {} : { title: title.value }),
          ...(command.body === undefined ? {} : { body: command.body })
        }
      ])
    }

    case 'DeleteNote': {
      const notes = state.value.notes ?? {}
      if (!notes[command.noteId]) {
        return err(commandError('missing_entity', 'Note does not exist'))
      }

      return ok([
        {
          type: 'NoteDeleted',
          noteId: command.noteId
        }
      ])
    }

    case 'SetNoteVisibility': {
      const notes = state.value.notes ?? {}
      if (!notes[command.noteId]) {
        return err(commandError('missing_entity', 'Note does not exist'))
      }

      return ok([
        {
          type: 'NoteVisibilityChanged',
          noteId: command.noteId,
          visibility: command.visibility
        }
      ])
    }

    default: {
      const exhaustive: never = command
      return err(
        commandError(
          'invalid_command',
          `Unhandled note command ${(exhaustive as { type: string }).type}`
        )
      )
    }
  }
}
