import type { EventEnvelope } from './events'
import { leaveCareerTerm, startCareerTerm } from './characterCreation'
import type {
  CharacterCharacteristics,
  CharacterState,
  CharacterSheetPatch,
  GameState
} from './state'

const diceRevealAt = (createdAt: string): string =>
  new Date(Date.parse(createdAt) + 2500).toISOString()

const defaultCharacteristics = (): CharacterCharacteristics => ({
  str: null,
  dex: null,
  end: null,
  int: null,
  edu: null,
  soc: null
})

const applyCharacterSheetPatch = (
  character: CharacterState,
  patch: CharacterSheetPatch
) => {
  if (patch.notes !== undefined) character.notes = patch.notes
  if (patch.age !== undefined) character.age = patch.age
  if (patch.characteristics !== undefined) {
    character.characteristics = {
      ...character.characteristics,
      ...patch.characteristics
    }
  }
  if (patch.skills !== undefined) character.skills = [...patch.skills]
  if (patch.equipment !== undefined) {
    character.equipment = patch.equipment.map((item) => ({ ...item }))
  }
  if (patch.credits !== undefined) character.credits = patch.credits
}

export const projectGameState = (
  events: readonly EventEnvelope[],
  initialState: GameState | null = null
): GameState | null => {
  let state: GameState | null =
    initialState === null ? null : structuredClone(initialState)

  for (const envelope of events) {
    const event = envelope.event

    switch (event.type) {
      case 'GameCreated':
        state = {
          id: envelope.gameId,
          slug: event.slug,
          name: event.name,
          ownerId: event.ownerId,
          players: {
            [event.ownerId]: {
              userId: event.ownerId,
              role: 'REFEREE'
            }
          },
          characters: {},
          boards: {},
          pieces: {},
          diceLog: [],
          selectedBoardId: null,
          eventSeq: envelope.seq
        }
        break

      case 'CharacterCreated':
        if (!state) throw new Error('CharacterCreated before GameCreated')
        state.characters[event.characterId] = {
          id: event.characterId,
          ownerId: event.ownerId,
          type: event.characterType,
          name: event.name,
          active: true,
          notes: '',
          age: null,
          characteristics: defaultCharacteristics(),
          skills: [],
          equipment: [],
          credits: 0,
          creation: null
        }
        state.eventSeq = envelope.seq
        break

      case 'CharacterSheetUpdated': {
        if (!state) {
          throw new Error('CharacterSheetUpdated before GameCreated')
        }
        const character = state.characters[event.characterId]
        if (!character) break
        applyCharacterSheetPatch(character, event)

        state.eventSeq = envelope.seq
        break
      }

      case 'CharacterCreationStarted': {
        if (!state) {
          throw new Error('CharacterCreationStarted before GameCreated')
        }
        const character = state.characters[event.characterId]
        if (!character) break

        character.creation = structuredClone(event.creation)
        state.eventSeq = envelope.seq
        break
      }

      case 'CharacterCreationTransitioned': {
        if (!state) {
          throw new Error('CharacterCreationTransitioned before GameCreated')
        }
        const character = state.characters[event.characterId]
        if (!character?.creation) break
        let terms = character.creation.terms.map((term) =>
          structuredClone(term)
        )
        let careers = character.creation.careers.map((career) => ({
          ...career
        }))
        const creationEvent = event.creationEvent

        if (
          creationEvent.type === 'REENLIST' ||
          creationEvent.type === 'FORCED_REENLIST'
        ) {
          const career = terms.at(-1)?.career
          if (career) {
            const result = startCareerTerm({
              career,
              terms,
              careers
            })
            terms = result.terms.map((term) => structuredClone(term))
            careers = result.careers.map((entry) => ({ ...entry }))
          }
        } else if (
          creationEvent.type === 'LEAVE_CAREER' ||
          creationEvent.type === 'REENLIST_BLOCKED' ||
          creationEvent.type === 'MISHAP_RESOLVED'
        ) {
          terms = terms.map((term, index) =>
            index === terms.length - 1
              ? leaveCareerTerm(term)
              : structuredClone(term)
          )
        }

        character.creation = {
          ...character.creation,
          state: structuredClone(event.state),
          creationComplete: event.creationComplete,
          terms,
          careers,
          history: [
            ...(character.creation.history ?? []),
            structuredClone(creationEvent)
          ]
        }
        state.eventSeq = envelope.seq
        break
      }

      case 'CharacterCreationHomeworldSet': {
        if (!state) {
          throw new Error('CharacterCreationHomeworldSet before GameCreated')
        }
        const character = state.characters[event.characterId]
        if (!character?.creation) break

        character.creation = {
          ...character.creation,
          homeworld: structuredClone(event.homeworld),
          backgroundSkills: [...event.backgroundSkills],
          pendingCascadeSkills: [...event.pendingCascadeSkills]
        }
        state.eventSeq = envelope.seq
        break
      }

      case 'CharacterCreationBackgroundSkillSelected': {
        if (!state) {
          throw new Error(
            'CharacterCreationBackgroundSkillSelected before GameCreated'
          )
        }
        const character = state.characters[event.characterId]
        if (!character?.creation) break

        character.creation = {
          ...character.creation,
          backgroundSkills: [...event.backgroundSkills],
          pendingCascadeSkills: [...event.pendingCascadeSkills]
        }
        state.eventSeq = envelope.seq
        break
      }

      case 'CharacterCreationCascadeSkillResolved': {
        if (!state) {
          throw new Error(
            'CharacterCreationCascadeSkillResolved before GameCreated'
          )
        }
        const character = state.characters[event.characterId]
        if (!character?.creation) break

        character.creation = {
          ...character.creation,
          backgroundSkills: [...event.backgroundSkills],
          pendingCascadeSkills: [...event.pendingCascadeSkills]
        }
        state.eventSeq = envelope.seq
        break
      }

      case 'CharacterCreationFinalized': {
        if (!state) {
          throw new Error('CharacterCreationFinalized before GameCreated')
        }
        const character = state.characters[event.characterId]
        if (!character?.creation) break
        applyCharacterSheetPatch(character, event)

        state.eventSeq = envelope.seq
        break
      }

      case 'CharacterCareerTermStarted': {
        if (!state) {
          throw new Error('CharacterCareerTermStarted before GameCreated')
        }
        const character = state.characters[event.characterId]
        if (!character?.creation) break
        const result = startCareerTerm({
          career: event.career,
          terms: character.creation.terms,
          careers: character.creation.careers,
          drafted: event.drafted
        })

        character.creation = {
          ...character.creation,
          terms: result.terms.map((term) => structuredClone(term)),
          careers: result.careers.map((career) => ({ ...career })),
          canEnterDraft: result.canEnterDraft,
          failedToQualify: result.failedToQualify
        }
        state.eventSeq = envelope.seq
        break
      }

      case 'BoardCreated':
        if (!state) throw new Error('BoardCreated before GameCreated')
        state.boards[event.boardId] = {
          id: event.boardId,
          name: event.name,
          imageAssetId: event.imageAssetId,
          url: event.url,
          width: event.width,
          height: event.height,
          scale: event.scale,
          doors: {}
        }
        state.selectedBoardId = state.selectedBoardId ?? event.boardId
        state.eventSeq = envelope.seq
        break

      case 'BoardSelected':
        if (!state) throw new Error('BoardSelected before GameCreated')
        if (!state.boards[event.boardId]) break
        state.selectedBoardId = event.boardId
        state.eventSeq = envelope.seq
        break

      case 'DoorStateChanged':
        if (!state) throw new Error('DoorStateChanged before GameCreated')
        if (!state.boards[event.boardId]) break
        state.boards[event.boardId].doors[event.doorId] = {
          id: event.doorId,
          open: event.open
        }
        state.eventSeq = envelope.seq
        break

      case 'PieceCreated':
        if (!state) throw new Error('PieceCreated before GameCreated')
        state.pieces[event.pieceId] = {
          id: event.pieceId,
          boardId: event.boardId,
          characterId: event.characterId,
          imageAssetId: event.imageAssetId,
          name: event.name,
          x: event.x,
          y: event.y,
          z: 0,
          width: event.width ?? 50,
          height: event.height ?? 50,
          scale: event.scale ?? 1,
          visibility: 'PREVIEW',
          freedom: 'LOCKED'
        }
        state.eventSeq = envelope.seq
        break

      case 'PieceMoved':
        if (!state) throw new Error('PieceMoved before GameCreated')
        if (!state.pieces[event.pieceId]) break
        state.pieces[event.pieceId].x = event.x
        state.pieces[event.pieceId].y = event.y
        state.eventSeq = envelope.seq
        break

      case 'PieceVisibilityChanged':
        if (!state) throw new Error('PieceVisibilityChanged before GameCreated')
        if (!state.pieces[event.pieceId]) break
        state.pieces[event.pieceId].visibility = event.visibility
        state.eventSeq = envelope.seq
        break

      case 'PieceFreedomChanged':
        if (!state) throw new Error('PieceFreedomChanged before GameCreated')
        if (!state.pieces[event.pieceId]) break
        state.pieces[event.pieceId].freedom = event.freedom
        state.eventSeq = envelope.seq
        break

      case 'DiceRolled':
        if (!state) throw new Error('DiceRolled before GameCreated')
        state.diceLog.push({
          id: envelope.id,
          actorId: envelope.actorId,
          createdAt: envelope.createdAt,
          revealAt: diceRevealAt(envelope.createdAt),
          expression: event.expression,
          reason: event.reason,
          rolls: event.rolls,
          total: event.total
        })
        if (state.diceLog.length > 20) {
          state.diceLog.splice(0, state.diceLog.length - 20)
        }
        state.eventSeq = envelope.seq
        break

      default: {
        const exhaustive: never = event
        throw new Error(
          `Unhandled event ${(exhaustive as { type: string }).type}`
        )
      }
    }
  }

  return state
}
