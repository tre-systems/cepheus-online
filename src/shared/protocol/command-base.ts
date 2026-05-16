import type { GameCommand } from '../commands'
import { asGameId, asUserId } from '../ids'
import type { CommandError } from '../protocol'
import { err, ok, type Result } from '../result'
import { isString } from '../util'

const invalidCommand = (message: string): CommandError => ({
  code: 'invalid_command',
  message
})

const parseId = <T>(
  raw: unknown,
  label: string,
  parse: (value: string) => T
): Result<T, CommandError> => {
  if (!isString(raw)) return err(invalidCommand(`${label} must be a string`))

  try {
    return ok(parse(raw))
  } catch (error) {
    return err(
      invalidCommand(error instanceof Error ? error.message : `${label} failed`)
    )
  }
}

const parseOptionalSeq = (
  raw: unknown,
  label: string
): Result<number | undefined, CommandError> => {
  if (raw === undefined) return ok(undefined)
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0) {
    return err(invalidCommand(`${label} must be a non-negative integer`))
  }

  return ok(raw)
}

export const parseBaseCommandFields = (
  raw: Record<string, unknown>
): Result<
  Pick<GameCommand, 'gameId' | 'actorId' | 'expectedSeq'>,
  CommandError
> => {
  const gameId = parseId(raw.gameId, 'gameId', asGameId)
  if (!gameId.ok) return gameId

  const actorId = parseId(raw.actorId, 'actorId', asUserId)
  if (!actorId.ok) return actorId

  const expectedSeq = parseOptionalSeq(raw.expectedSeq, 'expectedSeq')
  if (!expectedSeq.ok) return expectedSeq

  return ok({
    gameId: gameId.value,
    actorId: actorId.value,
    ...(expectedSeq.value === undefined
      ? {}
      : { expectedSeq: expectedSeq.value })
  })
}
