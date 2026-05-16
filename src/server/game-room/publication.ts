import type { GameId } from '../../shared/ids'
import {
  DEFAULT_RULESET_ID,
  resolveRulesetReference
} from '../../shared/character-creation/cepheus-srd-ruleset'
import {
  isDeprecatedGameCommand,
  metadataForCommand
} from '../../shared/command-metadata'
import {
  deriveLiveActivities,
  type LiveActivityDescriptor
} from '../../shared/live-activity'
import type { ClientMessage, CommandError } from '../../shared/protocol'
import { projectGameState } from '../../shared/projector'
import { err, ok, type Result } from '../../shared/result'
import type { GameState } from '../../shared/state'
import type { DurableObjectStorage } from '../cloudflare'
import { deriveCheckpointDecision } from './checkpoint-policy'
import { deriveEventsForCommand } from './command'
import { getProjectedGameState } from './projection'
import { compareProjectionParity } from './projection-parity'
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
    !isDeprecatedGameCommand(message.command) &&
    metadataForCommand(message.command).usesSeededDice
  const gameSeed =
    usesSeededDice && currentState
      ? await getOrCreateGameSeed(storage, gameId)
      : 0
  const rulesetId =
    currentState?.rulesetId ??
    (message.command.type === 'CreateGame'
      ? (message.command.rulesetId ?? DEFAULT_RULESET_ID)
      : DEFAULT_RULESET_ID)
  const ruleset = resolveRulesetReference(rulesetId)
  if (!ruleset.ok) {
    return err(commandError('invalid_command', ruleset.error.join('; ')))
  }
  const events = deriveEventsForCommand(message.command, {
    state: currentState,
    currentSeq,
    nextSeq: currentSeq + 1,
    gameSeed,
    ruleset: ruleset.value.ruleset,
    createdAt
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

  const checkpointDecision = deriveCheckpointDecision(nextState, envelopes)

  if (checkpointDecision.shouldSave) {
    await saveCheckpoint(storage, nextState, createdAt)
  }

  if (message.command.type === 'CreateGame') {
    await getOrCreateGameSeed(storage, gameId)
  }

  const projectedState = await getProjectedGameState(storage, gameId)

  const projectionParity = compareProjectionParity(projectedState, nextState)

  if (!projectionParity.matches) {
    const error = internalPublicationError(projectionParity.message)
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
