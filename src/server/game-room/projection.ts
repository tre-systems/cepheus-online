import {projectGameState} from '../../shared/projector'
import type {GameId} from '../../shared/ids'
import type {GameState} from '../../shared/state'
import type {DurableObjectStorage} from '../cloudflare'
import {readCheckpoint, readEventStreamTail} from './storage'

export const getProjectedGameState = async (
  storage: DurableObjectStorage,
  gameId: GameId
): Promise<GameState | null> => {
  const checkpoint = await readCheckpoint(storage, gameId)
  const eventTail = await readEventStreamTail(
    storage,
    gameId,
    checkpoint?.seq ?? 0
  )

  return projectGameState(eventTail, checkpoint?.state ?? null)
}
