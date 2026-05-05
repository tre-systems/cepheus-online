import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asBoardId, asGameId, asPieceId, asUserId } from '../../shared/ids'
import type { BoardState, GameState, PieceState } from '../../shared/state'
import { canSelectBoards, createAppSession } from './app-session'

const board = (id: string): BoardState => ({
  id: asBoardId(id),
  name: id,
  imageAssetId: null,
  url: null,
  width: 1200,
  height: 800,
  scale: 50,
  doors: {}
})

const piece = (id: string, boardId = asBoardId('main')): PieceState => ({
  id: asPieceId(id),
  boardId,
  characterId: null,
  imageAssetId: null,
  name: id,
  x: 0,
  y: 0,
  z: 0,
  width: 50,
  height: 50,
  scale: 1,
  visibility: 'VISIBLE',
  freedom: 'UNLOCKED'
})

const gameState = (overrides: Partial<GameState> = {}): GameState => {
  const main = board('main')
  return {
    id: asGameId('demo-room'),
    slug: 'demo-room',
    name: 'Demo Room',
    ownerId: asUserId('owner'),
    players: {},
    characters: {},
    boards: {
      [main.id]: main
    },
    pieces: {},
    diceLog: [],
    selectedBoardId: main.id,
    eventSeq: 12,
    ...overrides
  }
}

describe('app session', () => {
  it('holds room identity, authoritative state, local selections, panels, and flags', () => {
    const state = gameState()
    const session = createAppSession({
      roomId: 'demo-room',
      actorId: asUserId('local-user'),
      viewerRole: 'referee',
      authoritativeState: state,
      panels: {
        roomDialog: true
      },
      requestError: 'offline',
      recovery: {
        shouldReload: true
      }
    })

    assert.deepEqual(session.snapshot(), {
      room: {
        roomId: 'demo-room',
        actorId: 'local-user',
        viewerRole: 'referee'
      },
      authoritativeState: state,
      selectedBoardId: 'main',
      selectedPieceId: null,
      panels: {
        characterCreator: false,
        characterSheet: false,
        roomDialog: true,
        roomMenu: false
      },
      creationFlowId: null,
      requestError: 'offline',
      recovery: {
        shouldReload: true,
        isRecovering: false
      }
    })
    assert.equal(canSelectBoards(session.snapshot()), true)
  })

  it('updates local UI state without mutating previous snapshots', () => {
    const session = createAppSession({
      roomId: 'demo-room',
      actorId: 'local-user',
      viewerRole: 'player'
    })
    const before = session.snapshot()

    session.selectBoard(asBoardId('main'))
    session.selectPiece(asPieceId('scout'))
    session.setPanelOpen('characterSheet', true)
    session.setCreationFlowId('scout-creation')
    session.setRequestError('Command failed')
    session.setRecoveryFlags({ isRecovering: true })

    assert.equal(before.selectedBoardId, null)
    assert.equal(before.panels.characterSheet, false)
    assert.equal(session.snapshot().selectedBoardId, 'main')
    assert.equal(session.snapshot().selectedPieceId, 'scout')
    assert.equal(session.snapshot().panels.characterSheet, true)
    assert.equal(session.snapshot().creationFlowId, 'scout-creation')
    assert.equal(session.snapshot().requestError, 'Command failed')
    assert.deepEqual(session.snapshot().recovery, {
      shouldReload: false,
      isRecovering: true
    })
    assert.equal(canSelectBoards(session.snapshot()), false)
  })

  it('keeps valid selections and clears stale selections when authoritative state changes', () => {
    const main = board('main')
    const scout = piece('scout', main.id)
    const session = createAppSession({
      roomId: 'demo-room',
      actorId: 'local-user',
      viewerRole: 'referee',
      authoritativeState: gameState({
        boards: { [main.id]: main },
        pieces: { [scout.id]: scout },
        selectedBoardId: main.id
      }),
      selectedPieceId: scout.id
    })

    session.setAuthoritativeState(
      gameState({
        boards: { [main.id]: main },
        pieces: { [scout.id]: scout },
        selectedBoardId: main.id,
        eventSeq: 13
      })
    )
    assert.equal(session.snapshot().selectedPieceId, scout.id)

    const other = board('other')
    session.setAuthoritativeState(
      gameState({
        boards: { [other.id]: other },
        selectedBoardId: other.id,
        eventSeq: 14
      })
    )
    assert.equal(session.snapshot().selectedBoardId, other.id)
    assert.equal(session.snapshot().selectedPieceId, null)
  })
})
