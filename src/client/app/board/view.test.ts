import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asBoardId, asGameId, asPieceId, asUserId } from '../../../shared/ids'
import type { BoardState, GameState, PieceState } from '../../../shared/state'
import {
  boardImageUrl,
  boardPieces,
  filterBoardPiecesForLineOfSight,
  pieceImageUrl,
  selectedBoard,
  selectedBoardId,
  selectedBoardPieces,
  selectedBoardPiecesForViewer
} from './view'

const board = (id: string, name = id): BoardState => ({
  id: asBoardId(id),
  name,
  imageAssetId: null,
  url: null,
  width: 100,
  height: 100,
  scale: 50,
  doors: {}
})

const piece = (
  id: string,
  boardId: string,
  z: number,
  imageAssetId: string | null = null,
  x = 0,
  y = 0
): PieceState => ({
  id: asPieceId(id),
  boardId: asBoardId(boardId),
  characterId: null,
  imageAssetId,
  name: id,
  x,
  y,
  z,
  width: 10,
  height: 10,
  scale: 1,
  visibility: 'VISIBLE',
  freedom: 'UNLOCKED'
})

const state = (
  boards: BoardState[],
  pieces: PieceState[],
  selectedBoardIdValue: string | null
): GameState => ({
  id: asGameId('game'),
  slug: 'game',
  name: 'Game',
  ownerId: asUserId('owner'),
  players: {},
  characters: {},
  boards: Object.fromEntries(
    boards.map((candidate) => [candidate.id, candidate])
  ),
  pieces: Object.fromEntries(
    pieces.map((candidate) => [candidate.id, candidate])
  ),
  diceLog: [],
  selectedBoardId: selectedBoardIdValue
    ? asBoardId(selectedBoardIdValue)
    : null,
  eventSeq: 0
})

describe('board view helpers', () => {
  it('falls back to the first board when the selected board is missing', () => {
    const first = board('alpha', 'Alpha')
    const second = board('beta', 'Beta')
    const game = state([first, second], [], 'missing')

    assert.equal(selectedBoardId(game), first.id)
    assert.equal(selectedBoard(game), first)
  })

  it('filters pieces to the selected board and sorts them by z', () => {
    const game = state(
      [board('alpha'), board('beta')],
      [
        piece('front', 'alpha', 20),
        piece('other-board', 'beta', 0),
        piece('back', 'alpha', -1),
        piece('middle', 'alpha', 4)
      ],
      'alpha'
    )

    assert.deepEqual(
      selectedBoardPieces(game).map((candidate) => candidate.id),
      [asPieceId('back'), asPieceId('middle'), asPieceId('front')]
    )
    assert.deepEqual(
      boardPieces(game, asBoardId('beta')).map((candidate) => candidate.id),
      [asPieceId('other-board')]
    )
  })

  it('filters non-referee board pieces through selected-piece line of sight', () => {
    const currentBoard: BoardState = {
      ...board('alpha'),
      losSidecar: {
        assetRef: 'Geomorphs/standard/deck-01.jpg',
        width: 100,
        height: 100,
        gridScale: 50,
        occluders: [
          {
            type: 'door',
            id: 'iris',
            x1: 50,
            y1: 0,
            x2: 50,
            y2: 100,
            open: false
          }
        ]
      }
    }
    const pieces = [
      piece('viewer', 'alpha', 0, null, 0, 40),
      piece('nearby', 'alpha', 1, null, 20, 40),
      piece('blocked', 'alpha', 2, null, 90, 40)
    ]
    const game = state([currentBoard], pieces, 'alpha')

    assert.deepEqual(
      selectedBoardPiecesForViewer(game, asPieceId('viewer'), false).map(
        (candidate) => candidate.id
      ),
      [asPieceId('viewer'), asPieceId('nearby')]
    )
    assert.deepEqual(
      filterBoardPiecesForLineOfSight({
        board: currentBoard,
        pieces,
        selectedPieceId: asPieceId('viewer'),
        canSeeAllPieces: true
      }).map((candidate) => candidate.id),
      [asPieceId('viewer'), asPieceId('nearby'), asPieceId('blocked')]
    )
  })

  it('accepts browser image URLs for pieces and boards', () => {
    assert.equal(
      pieceImageUrl(piece('counter', 'alpha', 0, '/counter.png')),
      '/counter.png'
    )
    assert.equal(
      pieceImageUrl(
        piece('remote', 'alpha', 0, 'https://example.com/counter.png')
      ),
      'https://example.com/counter.png'
    )
    assert.equal(
      pieceImageUrl(piece('asset-id', 'alpha', 0, 'asset-123')),
      null
    )

    assert.equal(
      boardImageUrl({
        ...board('alpha'),
        url: 'blob:https://example.com/board',
        imageAssetId: '/fallback.png'
      }),
      'blob:https://example.com/board'
    )
    assert.equal(
      boardImageUrl({
        ...board('beta'),
        url: 'asset-123',
        imageAssetId: 'data:image/png;base64,abc'
      }),
      'data:image/png;base64,abc'
    )
  })
})
