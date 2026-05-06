import type { EventEnvelope, GameEvent } from './events'
import { leaveCareerTerm, startCareerTerm } from './characterCreation'
import type { CareerTerm } from './characterCreation'
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

const recordMusteringBenefit = (
  terms: readonly CareerTerm[],
  career: string,
  benefit: string
) =>
  terms.map((term, index) =>
    term.career === career &&
    !terms.slice(0, index).some((previous) => previous.career === career)
      ? {
          ...term,
          benefits: [...term.benefits, benefit]
        }
      : structuredClone(term)
  )

type EventEnvelopeFor<TEvent extends GameEvent> = Omit<
  EventEnvelope,
  'event'
> & {
  event: TEvent
}

type EventHandler<TEvent extends GameEvent> = (
  state: GameState | null,
  envelope: EventEnvelopeFor<TEvent>
) => GameState | null

type EventHandlerRegistry = {
  [TType in GameEvent['type']]: EventHandler<
    Extract<GameEvent, { type: TType }>
  >
}

type EventHandlerMap<TEventType extends GameEvent['type']> = {
  [TType in TEventType]: EventHandler<Extract<GameEvent, { type: TType }>>
}

const requireState = (
  state: GameState | null,
  eventType: GameEvent['type']
): GameState => {
  if (!state) throw new Error(`${eventType} before GameCreated`)
  return state
}

type GameEventType = 'GameCreated'

type CharacterEventType =
  | 'CharacterCreated'
  | 'CharacterSheetUpdated'
  | 'CharacterCreationStarted'
  | 'CharacterCreationTransitioned'
  | 'CharacterCreationBasicTrainingCompleted'
  | 'CharacterCreationHomeworldSet'
  | 'CharacterCreationHomeworldCompleted'
  | 'CharacterCreationBackgroundSkillSelected'
  | 'CharacterCreationCascadeSkillResolved'
  | 'CharacterCreationFinalized'
  | 'CharacterCareerTermStarted'

type BoardEventType =
  | 'BoardCreated'
  | 'BoardSelected'
  | 'DoorStateChanged'
  | 'PieceCreated'
  | 'PieceMoved'
  | 'PieceVisibilityChanged'
  | 'PieceFreedomChanged'

type DiceEventType = 'DiceRolled'

const gameEventHandlers = {
  GameCreated: (_state, envelope) => {
    const event = envelope.event

    return {
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
  }
} satisfies EventHandlerMap<GameEventType>

const characterEventHandlers = {
  CharacterCreated: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)

    nextState.characters[event.characterId] = {
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
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterSheetUpdated: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character) return nextState

    applyCharacterSheetPatch(character, event)
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationStarted: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character) return nextState

    character.creation = structuredClone(event.creation)
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationTransitioned: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    let terms = character.creation.terms.map((term) => structuredClone(term))
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
    } else if (
      creationEvent.type === 'FINISH_MUSTERING' &&
      creationEvent.musteringBenefit
    ) {
      terms = recordMusteringBenefit(
        terms,
        creationEvent.musteringBenefit.career,
        creationEvent.musteringBenefit.value
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
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationBasicTrainingCompleted: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    const lastTermIndex = character.creation.terms.length - 1
    const terms = character.creation.terms.map((term, index) =>
      index === lastTermIndex
        ? {
            ...structuredClone(term),
            skillsAndTraining: [...event.trainingSkills],
            completedBasicTraining: true
          }
        : structuredClone(term)
    )

    character.creation = {
      ...character.creation,
      state: structuredClone(event.state),
      creationComplete: event.creationComplete,
      terms,
      history: [
        ...(character.creation.history ?? []),
        { type: 'COMPLETE_BASIC_TRAINING' }
      ]
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationHomeworldSet: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    character.creation = {
      ...character.creation,
      homeworld: structuredClone(event.homeworld),
      backgroundSkills: [...event.backgroundSkills],
      pendingCascadeSkills: [...event.pendingCascadeSkills]
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationHomeworldCompleted: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    character.creation = {
      ...character.creation,
      state: structuredClone(event.state),
      creationComplete: event.creationComplete,
      history: [
        ...(character.creation.history ?? []),
        { type: 'COMPLETE_HOMEWORLD' }
      ]
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationBackgroundSkillSelected: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    character.creation = {
      ...character.creation,
      backgroundSkills: [...event.backgroundSkills],
      pendingCascadeSkills: [...event.pendingCascadeSkills]
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationCascadeSkillResolved: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    character.creation = {
      ...character.creation,
      backgroundSkills: [...event.backgroundSkills],
      pendingCascadeSkills: [...event.pendingCascadeSkills]
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCreationFinalized: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState

    applyCharacterSheetPatch(character, event)
    nextState.eventSeq = envelope.seq

    return nextState
  },

  CharacterCareerTermStarted: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const character = nextState.characters[event.characterId]
    if (!character?.creation) return nextState
    const acceptedCareer = event.acceptedCareer ?? event.career

    const result = startCareerTerm({
      career: acceptedCareer,
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
    nextState.eventSeq = envelope.seq

    return nextState
  }
} satisfies EventHandlerMap<CharacterEventType>

const boardEventHandlers = {
  BoardCreated: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)

    nextState.boards[event.boardId] = {
      id: event.boardId,
      name: event.name,
      imageAssetId: event.imageAssetId,
      url: event.url,
      width: event.width,
      height: event.height,
      scale: event.scale,
      doors: {}
    }
    nextState.selectedBoardId = nextState.selectedBoardId ?? event.boardId
    nextState.eventSeq = envelope.seq

    return nextState
  },

  BoardSelected: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    if (!nextState.boards[event.boardId]) return nextState

    nextState.selectedBoardId = event.boardId
    nextState.eventSeq = envelope.seq

    return nextState
  },

  DoorStateChanged: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    if (!nextState.boards[event.boardId]) return nextState

    nextState.boards[event.boardId].doors[event.doorId] = {
      id: event.doorId,
      open: event.open
    }
    nextState.eventSeq = envelope.seq

    return nextState
  },

  PieceCreated: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)

    nextState.pieces[event.pieceId] = {
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
    nextState.eventSeq = envelope.seq

    return nextState
  },

  PieceMoved: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const piece = nextState.pieces[event.pieceId]
    if (!piece) return nextState

    piece.x = event.x
    piece.y = event.y
    nextState.eventSeq = envelope.seq

    return nextState
  },

  PieceVisibilityChanged: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const piece = nextState.pieces[event.pieceId]
    if (!piece) return nextState

    piece.visibility = event.visibility
    nextState.eventSeq = envelope.seq

    return nextState
  },

  PieceFreedomChanged: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)
    const piece = nextState.pieces[event.pieceId]
    if (!piece) return nextState

    piece.freedom = event.freedom
    nextState.eventSeq = envelope.seq

    return nextState
  }
} satisfies EventHandlerMap<BoardEventType>

const diceEventHandlers = {
  DiceRolled: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)

    nextState.diceLog.push({
      id: envelope.id,
      actorId: envelope.actorId,
      createdAt: envelope.createdAt,
      revealAt: diceRevealAt(envelope.createdAt),
      expression: event.expression,
      reason: event.reason,
      rolls: event.rolls,
      total: event.total
    })
    if (nextState.diceLog.length > 20) {
      nextState.diceLog.splice(0, nextState.diceLog.length - 20)
    }
    nextState.eventSeq = envelope.seq

    return nextState
  }
} satisfies EventHandlerMap<DiceEventType>

const eventHandlers = {
  ...gameEventHandlers,
  ...characterEventHandlers,
  ...boardEventHandlers,
  ...diceEventHandlers
} satisfies EventHandlerRegistry

const projectEnvelope = <TEvent extends GameEvent>(
  state: GameState | null,
  envelope: EventEnvelopeFor<TEvent>
): GameState | null => {
  const handler = eventHandlers[envelope.event.type] as EventHandler<TEvent>
  return handler(state, envelope)
}

const hasEventHandler = (eventType: string): eventType is GameEvent['type'] =>
  Object.hasOwn(eventHandlers, eventType)

export const projectGameState = (
  events: readonly EventEnvelope[],
  initialState: GameState | null = null
): GameState | null => {
  let state: GameState | null =
    initialState === null ? null : structuredClone(initialState)

  for (const envelope of events) {
    const event = envelope.event
    if (!hasEventHandler(event.type)) {
      throw new Error(`Unhandled event ${(event as { type: string }).type}`)
    }
    state = projectEnvelope(state, envelope)
  }

  return state
}
