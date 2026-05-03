import type {ClientMessage, CommandError} from '../../shared/protocol'
import {projectGameState} from '../../shared/projector'
import {err, ok, type Result} from '../../shared/result'
import type {GameId} from '../../shared/ids'
import type {GameState} from '../../shared/state'
import type {DurableObjectStorage} from '../cloudflare'
import {deriveEventsForCommand} from './command'
import {getProjectedGameState} from './projection'
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
}

const commandError = (
  code: CommandError['code'],
  message: string
): CommandError => ({
  code,
  message
})

const shouldCheckpoint = (state: GameState): boolean =>
  state.eventSeq === 1 || state.eventSeq % 64 === 0

const hasProjectionParity = (
  left: GameState | null,
  right: GameState | null
): boolean => JSON.stringify(left) === JSON.stringify(right)

export const runCommandPublication = async (
  storage: DurableObjectStorage,
  gameId: GameId,
  message: Extract<ClientMessage, {type: 'command'}>,
  createdAt = new Date(Date.now()).toISOString()
): Promise<Result<CommandPublication, CommandError>> => {
  if (message.command.gameId !== gameId) {
    return err(
      commandError(
        'wrong_room',
        `Command targets ${message.command.gameId}, not ${gameId}`
      )
    )
  }

  const currentState = await getProjectedGameState(storage, gameId)
  const currentSeq = currentState?.eventSeq ?? (await getEventSeq(storage, gameId))
  const gameSeed =
    message.command.type === 'RollDice' && currentState
      ? await getOrCreateGameSeed(storage, gameId)
      : 0
  const events = deriveEventsForCommand(message.command, {
    state: currentState,
    currentSeq,
    nextSeq: currentSeq + 1,
    gameSeed
  })

  if (!events.ok) return events

  const envelopes = await appendEvents(
    storage,
    gameId,
    message.command.actorId,
    events.value,
    createdAt
  )
  const nextState = projectGameState(envelopes, currentState)

  if (!nextState) {
    return err(
      commandError('projection_mismatch', 'Command did not project game state')
    )
  }

  if (shouldCheckpoint(nextState)) {
    await saveCheckpoint(storage, nextState, createdAt)
  }

  if (message.command.type === 'CreateGame') {
    await getOrCreateGameSeed(storage, gameId)
  }

  const projectedState = await getProjectedGameState(storage, gameId)

  if (!hasProjectionParity(projectedState, nextState)) {
    return err(
      commandError(
        'projection_mismatch',
        'Stored event stream does not match live projection'
      )
    )
  }

  return ok({
    requestId: message.requestId,
    state: nextState,
    eventSeq: nextState.eventSeq
  })
}
