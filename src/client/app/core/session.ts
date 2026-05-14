import type { BoardId, PieceId, UserId } from '../../../shared/ids'
import type { GameState } from '../../../shared/state'

export type AppViewerRole = 'referee' | 'player' | 'spectator' | string

export type AppPanelId =
  | 'characterCreator'
  | 'characterSheet'
  | 'roomDialog'
  | 'roomMenu'

export type AppPanelState = Record<AppPanelId, boolean>

export interface AppRoomIdentity {
  roomId: string
  actorId: UserId | string
  viewerRole: AppViewerRole
}

export interface AppRecoveryFlags {
  shouldReload: boolean
  isRecovering: boolean
}

export interface AppServerMessageApplication {
  error: string | null
  shouldReload: boolean
}

export interface AppSessionState {
  room: AppRoomIdentity
  authoritativeState: GameState | null
  selectedBoardId: BoardId | null
  selectedPieceId: PieceId | null
  panels: AppPanelState
  creationFlowId: string | null
  requestError: string | null
  recovery: AppRecoveryFlags
}

export interface CreateAppSessionOptions extends AppRoomIdentity {
  authoritativeState?: GameState | null
  selectedBoardId?: BoardId | null
  selectedPieceId?: PieceId | null
  panels?: Partial<AppPanelState>
  creationFlowId?: string | null
  requestError?: string | null
  recovery?: Partial<AppRecoveryFlags>
}

export interface AppSession {
  snapshot: () => AppSessionState
  setRoomIdentity: (room: Partial<AppRoomIdentity>) => AppSessionState
  setAuthoritativeState: (state: GameState | null) => AppSessionState
  selectBoard: (boardId: BoardId | null) => AppSessionState
  selectPiece: (pieceId: PieceId | null) => AppSessionState
  setPanelOpen: (panel: AppPanelId, open: boolean) => AppSessionState
  setCreationFlowId: (creationFlowId: string | null) => AppSessionState
  setRequestError: (error: string | null) => AppSessionState
  setRecoveryFlags: (flags: Partial<AppRecoveryFlags>) => AppSessionState
  applyServerMessage: (
    application: AppServerMessageApplication
  ) => AppSessionState
}

const closedPanels = (): AppPanelState => ({
  characterCreator: false,
  characterSheet: false,
  roomDialog: false,
  roomMenu: false
})

const copyState = (state: AppSessionState): AppSessionState => ({
  ...state,
  room: { ...state.room },
  panels: { ...state.panels },
  recovery: { ...state.recovery }
})

const boardExists = (
  state: GameState | null,
  boardId: BoardId | null
): boolean => boardId !== null && Boolean(state?.boards[boardId])

const pieceExists = (
  state: GameState | null,
  pieceId: PieceId | null
): boolean => pieceId !== null && Boolean(state?.pieces[pieceId])

const nextSelectedBoardId = (
  current: BoardId | null,
  state: GameState | null
): BoardId | null => {
  if (boardExists(state, current)) return current
  return state?.selectedBoardId ?? null
}

export const createAppSessionState = ({
  roomId,
  actorId,
  viewerRole,
  authoritativeState = null,
  selectedBoardId,
  selectedPieceId = null,
  panels,
  creationFlowId = null,
  requestError = null,
  recovery
}: CreateAppSessionOptions): AppSessionState => {
  const boardId =
    selectedBoardId === undefined
      ? (authoritativeState?.selectedBoardId ?? null)
      : selectedBoardId

  return {
    room: { roomId, actorId, viewerRole },
    authoritativeState,
    selectedBoardId: nextSelectedBoardId(boardId, authoritativeState),
    selectedPieceId: pieceExists(authoritativeState, selectedPieceId)
      ? selectedPieceId
      : null,
    panels: {
      ...closedPanels(),
      ...panels
    },
    creationFlowId,
    requestError,
    recovery: {
      shouldReload: false,
      isRecovering: false,
      ...recovery
    }
  }
}

export const canSelectBoards = (
  session: Pick<AppSessionState, 'room'>
): boolean => session.room.viewerRole.toLowerCase() === 'referee'

export const createAppSession = (
  options: CreateAppSessionOptions
): AppSession => {
  let state = createAppSessionState(options)

  const replace = (next: AppSessionState): AppSessionState => {
    state = next
    return copyState(state)
  }

  return {
    snapshot: () => copyState(state),
    setRoomIdentity: (room) =>
      replace({
        ...state,
        room: {
          ...state.room,
          ...room
        }
      }),
    setAuthoritativeState: (authoritativeState) =>
      replace({
        ...state,
        authoritativeState,
        selectedBoardId: nextSelectedBoardId(
          state.selectedBoardId,
          authoritativeState
        ),
        selectedPieceId: pieceExists(authoritativeState, state.selectedPieceId)
          ? state.selectedPieceId
          : null
      }),
    selectBoard: (selectedBoardId) =>
      replace({
        ...state,
        selectedBoardId
      }),
    selectPiece: (selectedPieceId) =>
      replace({
        ...state,
        selectedPieceId
      }),
    setPanelOpen: (panel, open) =>
      replace({
        ...state,
        panels: {
          ...state.panels,
          [panel]: open
        }
      }),
    setCreationFlowId: (creationFlowId) =>
      replace({
        ...state,
        creationFlowId
      }),
    setRequestError: (requestError) =>
      replace({
        ...state,
        requestError
      }),
    setRecoveryFlags: (flags) =>
      replace({
        ...state,
        recovery: {
          ...state.recovery,
          ...flags
        }
      }),
    applyServerMessage: (application) =>
      replace({
        ...state,
        requestError: application.error,
        recovery: {
          shouldReload: application.shouldReload,
          isRecovering: application.shouldReload
        }
      })
  }
}
