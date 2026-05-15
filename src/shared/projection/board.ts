import { requireState } from './state'
import type { EventHandlerMap } from './types'

type BoardEventType =
  | 'BoardCreated'
  | 'BoardSelected'
  | 'DoorStateChanged'
  | 'PieceCreated'
  | 'PieceMoved'
  | 'PieceVisibilityChanged'
  | 'PieceFreedomChanged'

export const boardEventHandlers = {
  BoardCreated: (state, envelope) => {
    const event = envelope.event
    const nextState = requireState(state, event.type)

    nextState.boards[event.boardId] = {
      id: event.boardId,
      name: event.name,
      imageAssetId: event.imageAssetId,
      url: event.url,
      losSidecar: event.losSidecar ? structuredClone(event.losSidecar) : null,
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
