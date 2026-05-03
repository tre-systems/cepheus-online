export type Brand<T, B extends string> = T & {readonly __brand: B}

export type UserId = Brand<string, 'UserId'>
export type GameId = Brand<string, 'GameId'>
export type CharacterId = Brand<string, 'CharacterId'>
export type BoardId = Brand<string, 'BoardId'>
export type PieceId = Brand<string, 'PieceId'>
export type EventId = Brand<string, 'EventId'>

const asNonEmptyString = <T extends string>(
  value: string,
  label: string
): Brand<string, T> => {
  const normalized = value.trim()
  if (!normalized) {
    throw new Error(`${label} cannot be empty`)
  }
  return normalized as Brand<string, T>
}

export const asUserId = (value: string): UserId =>
  asNonEmptyString<'UserId'>(value, 'User id')

export const asGameId = (value: string): GameId =>
  asNonEmptyString<'GameId'>(value, 'Game id')

export const asCharacterId = (value: string): CharacterId =>
  asNonEmptyString<'CharacterId'>(value, 'Character id')

export const asBoardId = (value: string): BoardId =>
  asNonEmptyString<'BoardId'>(value, 'Board id')

export const asPieceId = (value: string): PieceId =>
  asNonEmptyString<'PieceId'>(value, 'Piece id')
