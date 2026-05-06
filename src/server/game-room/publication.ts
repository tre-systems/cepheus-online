import type { GameId } from '../../shared/ids'
import {
  deriveLiveActivities,
  type LiveActivityDescriptor
} from '../../shared/live-activity'
import type { ClientMessage, CommandError } from '../../shared/protocol'
import { projectGameState } from '../../shared/projector'
import { err, ok, type Result } from '../../shared/result'
import type { GameState } from '../../shared/state'
import type { DurableObjectStorage } from '../cloudflare'
import { shouldSaveCheckpoint } from './checkpoint-policy'
import { deriveEventsForCommand } from './command'
import { getProjectedGameState } from './projection'
import {
  isPublicationRejectedTelemetryCode,
  noopPublicationTelemetrySink,
  type PublicationTelemetrySink
} from './publication-telemetry'
import {
  appendEvents,
  getEventSeq,
  getOrCreateGameSeed,
  saveCheckpoint
} from './storage'

export interface CommandPublication {
  requestId: string
  state: GameState
  eventSeq: number
  liveActivities: LiveActivityDescriptor[]
}

export interface RunCommandPublicationOptions {
  createdAt?: string
  telemetrySink?: PublicationTelemetrySink
}

export class CommandPublicationError extends Error {
  readonly code: CommandError['code']

  constructor(code: CommandError['code'], message: string) {
    super(message)
    this.name = 'CommandPublicationError'
    this.code = code
  }
}

const commandError = (
  code: CommandError['code'],
  message: string
): CommandError => ({
  code,
  message
})

const internalPublicationError = (message: string): CommandPublicationError =>
  new CommandPublicationError('projection_mismatch', message)

const hasProjectionParity = (
  left: GameState | null,
  right: GameState | null
): boolean => JSON.stringify(left) === JSON.stringify(right)

const resolvePublicationOptions = (
  options: string | RunCommandPublicationOptions | undefined
): Required<RunCommandPublicationOptions> => {
  if (typeof options === 'string') {
    return {
      createdAt: options,
      telemetrySink: noopPublicationTelemetrySink
    }
  }

  return {
    createdAt: options?.createdAt ?? new Date(Date.now()).toISOString(),
    telemetrySink: options?.telemetrySink ?? noopPublicationTelemetrySink
  }
}

export const runCommandPublication = async (
  storage: DurableObjectStorage,
  gameId: GameId,
  message: Extract<ClientMessage, { type: 'command' }>,
  options?: string | RunCommandPublicationOptions
): Promise<Result<CommandPublication, CommandError>> => {
  const { createdAt, telemetrySink } = resolvePublicationOptions(options)

  if (message.command.gameId !== gameId) {
    return err(
      commandError(
        'wrong_room',
        `Command targets ${message.command.gameId}, not ${gameId}`
      )
    )
  }

  const currentState = await getProjectedGameState(storage, gameId)
  const currentSeq =
    currentState?.eventSeq ?? (await getEventSeq(storage, gameId))
  const usesSeededDice =
    message.command.type === 'RollDice' ||
    message.command.type === 'ResolveCharacterCreationQualification' ||
    message.command.type === 'ResolveCharacterCreationDraft' ||
    message.command.type === 'ResolveCharacterCreationSurvival' ||
    message.command.type === 'ResolveCharacterCreationCommission' ||
    message.command.type === 'ResolveCharacterCreationAdvancement' ||
    message.command.type === 'ResolveCharacterCreationReenlistment' ||
    message.command.type === 'RollCharacterCreationTermSkill'
  const gameSeed =
    usesSeededDice && currentState
      ? await getOrCreateGameSeed(storage, gameId)
      : 0
  const events = deriveEventsForCommand(message.command, {
    state: currentState,
    currentSeq,
    nextSeq: currentSeq + 1,
    gameSeed
  })

  if (!events.ok) {
    if (isPublicationRejectedTelemetryCode(events.error.code)) {
      telemetrySink.recordPublication({
        type: 'publicationRejected',
        gameId,
        requestId: message.requestId,
        commandType: message.command.type,
        actorId: message.command.actorId,
        code: events.error.code,
        message: events.error.message,
        currentSeq
      })
    }

    return events
  }

  const envelopes = await appendEvents(
    storage,
    gameId,
    message.command.actorId,
    events.value,
    createdAt
  )
  const nextState = projectGameState(envelopes, currentState)

  if (!nextState) {
    const error = internalPublicationError('Command did not project game state')
    telemetrySink.recordPublication({
      type: 'publicationInternalError',
      gameId,
      requestId: message.requestId,
      commandType: message.command.type,
      actorId: message.command.actorId,
      code: 'projection_mismatch',
      message: error.message,
      currentSeq,
      eventSeq: envelopes.at(-1)?.seq ?? currentSeq
    })
    throw error
  }

  if (shouldSaveCheckpoint(nextState, envelopes)) {
    await saveCheckpoint(storage, nextState, createdAt)
  }

  if (message.command.type === 'CreateGame') {
    await getOrCreateGameSeed(storage, gameId)
  }

  const projectedState = await getProjectedGameState(storage, gameId)

  if (!hasProjectionParity(projectedState, nextState)) {
    const error = internalPublicationError(
      'Stored event stream does not match live projection'
    )
    telemetrySink.recordPublication({
      type: 'publicationInternalError',
      gameId,
      requestId: message.requestId,
      commandType: message.command.type,
      actorId: message.command.actorId,
      code: 'projection_mismatch',
      message: error.message,
      currentSeq,
      eventSeq: nextState.eventSeq
    })
    throw error
  }

  telemetrySink.recordPublication({
    type: 'publicationAccepted',
    gameId,
    requestId: message.requestId,
    commandType: message.command.type,
    actorId: message.command.actorId,
    eventSeq: nextState.eventSeq,
    eventCount: envelopes.length
  })

  return ok({
    requestId: message.requestId,
    state: nextState,
    eventSeq: nextState.eventSeq,
    liveActivities: deriveLiveActivities(envelopes)
  })
}
