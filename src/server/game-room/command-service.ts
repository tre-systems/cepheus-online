import type { GameId } from '../../shared/ids'
import type { LiveActivityDescriptor } from '../../shared/live-activity'
import type {
  ClientMessage,
  CommandError,
  ServerMessage
} from '../../shared/protocol'
import type { GameState } from '../../shared/state'
import {
  filterGameStateForViewer,
  filterLiveActivitiesForViewer
} from '../../shared/viewer'
import type { DurableObjectStorage } from '../cloudflare'
import { bindOrVerifyActorSession } from './actor-session'
import { commandError } from './command-helpers'
import type { CommandRateLimiter } from './command-rate-limit'
import { CommandPublicationError, runCommandPublication } from './publication'
import type { PublicationTelemetrySink } from './publication-telemetry'
import { resolveRoomRulesetData } from './ruleset-provider'
import { getEventSeq } from './storage'
import { viewerFromCommand } from './queries'

export type RoomCommandResult =
  | {
      ok: true
      response: ServerMessage
      state: GameState
      liveActivities: LiveActivityDescriptor[]
    }
  | {
      ok: false
      response: ServerMessage
      status: number
    }

export const statusForCommandError = (error: CommandError): number => {
  switch (error.code) {
    case 'game_not_found':
    case 'missing_entity':
      return 404
    case 'not_allowed':
      return 403
    case 'stale_command':
    case 'wrong_room':
    case 'game_exists':
    case 'duplicate_entity':
      return 409
    case 'projection_mismatch':
      return 500
    default:
      return 400
  }
}

export const handleRoomCommandMessage = async ({
  storage,
  gameId,
  message,
  actorSessionSecret,
  commandRateLimiter,
  telemetrySink
}: {
  storage: DurableObjectStorage
  gameId: GameId
  message: Extract<ClientMessage, { type: 'command' }>
  actorSessionSecret: string | null
  commandRateLimiter: CommandRateLimiter
  telemetrySink: PublicationTelemetrySink
}): Promise<RoomCommandResult> => {
  const actorSession = await bindOrVerifyActorSession(
    storage,
    gameId,
    message.command.actorId,
    actorSessionSecret
  )
  if (!actorSession.ok) {
    return {
      ok: false,
      status: 403,
      response: {
        type: 'commandRejected',
        requestId: message.requestId,
        error: actorSession.error,
        eventSeq: await getEventSeq(storage, gameId)
      }
    }
  }

  const rateLimit = commandRateLimiter.check(
    `${gameId}:${message.command.actorId}:${message.command.type}`
  )
  if (!rateLimit.ok) {
    return {
      ok: false,
      status: 429,
      response: {
        type: 'commandRejected',
        requestId: message.requestId,
        error: rateLimit.error,
        eventSeq: await getEventSeq(storage, gameId)
      }
    }
  }

  let publication: Awaited<ReturnType<typeof runCommandPublication>>

  try {
    publication = await runCommandPublication(storage, gameId, message, {
      telemetrySink
    })
  } catch (error) {
    if (error instanceof CommandPublicationError) {
      return {
        ok: false,
        status: 500,
        response: {
          type: 'error',
          error: commandError(error.code, error.message)
        }
      }
    }

    throw error
  }

  if (!publication.ok) {
    const eventSeq = await getEventSeq(storage, gameId)

    return {
      ok: false,
      status: statusForCommandError(publication.error),
      response: {
        type: 'commandRejected',
        requestId: message.requestId,
        error: publication.error,
        eventSeq
      }
    }
  }

  const viewer = viewerFromCommand(message)
  const filtered = filterGameStateForViewer(publication.value.state, viewer, {
    resolveRulesetById: resolveRoomRulesetData
  })
  const liveActivities = filterLiveActivitiesForViewer(
    publication.value.liveActivities,
    publication.value.state,
    viewer
  )

  return {
    ok: true,
    state: publication.value.state,
    liveActivities: publication.value.liveActivities,
    response: {
      type: 'commandAccepted',
      requestId: publication.value.requestId,
      state: filtered,
      eventSeq: filtered.eventSeq,
      ...(liveActivities.length === 0 ? {} : { liveActivities })
    }
  }
}
