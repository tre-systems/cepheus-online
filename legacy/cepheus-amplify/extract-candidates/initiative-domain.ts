import type {Piece} from '@data/types'

export const anyConscious = (
  characterId: string,
  boardID: string,
  pieces: Record<string, Piece>
): boolean =>
  Object.values(pieces)
    .filter(i => i.characterID === characterId && i.boardID === boardID)
    .some(i => !i?.combatState?.unconscious)
