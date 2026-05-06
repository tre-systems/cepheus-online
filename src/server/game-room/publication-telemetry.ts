import type { GameCommand } from '../../shared/commands'
import type { GameId, UserId } from '../../shared/ids'
import type { CommandError } from '../../shared/protocol'

export type PublicationRejectedTelemetryCode = Extract<
  CommandError['code'],
  'invalid_command' | 'not_allowed' | 'stale_command'
>

interface BasePublicationTelemetryEvent {
  gameId: GameId
  requestId: string
  commandType: GameCommand['type']
  actorId: UserId | null
}

export interface PublicationAcceptedTelemetryEvent
  extends BasePublicationTelemetryEvent {
  type: 'publicationAccepted'
  eventSeq: number
  eventCount: number
}

export interface PublicationRejectedTelemetryEvent
  extends BasePublicationTelemetryEvent {
  type: 'publicationRejected'
  code: PublicationRejectedTelemetryCode
  message: string
  currentSeq: number
}

export interface PublicationInternalErrorTelemetryEvent
  extends BasePublicationTelemetryEvent {
  type: 'publicationInternalError'
  code: 'projection_mismatch'
  message: string
  currentSeq: number
  eventSeq: number
}

export type PublicationTelemetryEvent =
  | PublicationAcceptedTelemetryEvent
  | PublicationRejectedTelemetryEvent
  | PublicationInternalErrorTelemetryEvent

export interface PublicationTelemetrySink {
  recordPublication(event: PublicationTelemetryEvent): void
}

export const noopPublicationTelemetrySink: PublicationTelemetrySink = {
  recordPublication: () => {}
}

export const isPublicationRejectedTelemetryCode = (
  code: CommandError['code']
): code is PublicationRejectedTelemetryCode =>
  code === 'invalid_command' ||
  code === 'not_allowed' ||
  code === 'stale_command'
