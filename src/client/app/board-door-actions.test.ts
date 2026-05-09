import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asBoardId, asGameId, asUserId } from '../../shared/ids'
import type { BoardState, GameState } from '../../shared/state'
import {
  createBoardDoorActions,
  type BoardDoorActionsDocument
} from './board-door-actions'
import { asNode, testDocument } from './test-dom.test-helper'

const gameId = asGameId('demo-room')
const actorId = asUserId('local-user')

const document = testDocument as unknown as BoardDoorActionsDocument

const board = (doors: BoardState['doors']): BoardState => ({
  id: asBoardId('scout-deck'),
  name: 'Scout Deck',
  imageAssetId: null,
  url: null,
  width: 1200,
  height: 800,
  scale: 50,
  doors
})

const gameState = (): GameState => ({
  id: gameId,
  slug: 'demo-room',
  name: 'Demo Room',
  ownerId: actorId,
  players: {},
  characters: {},
  boards: {},
  pieces: {},
  diceLog: [],
  selectedBoardId: asBoardId('scout-deck'),
  eventSeq: 42
})

describe('board door actions', () => {
  it('renders toggle buttons for each board door and dispatches door commands', () => {
    const dispatched: string[] = []
    const actions = createBoardDoorActions({
      document,
      identity: () => ({ gameId, actorId }),
      getState: gameState,
      dispatch: async (command) => {
        dispatched.push(
          [
            command.type,
            command.boardId,
            command.doorId,
            command.open,
            command.expectedSeq
          ].join(':')
        )
      },
      reportError: () => {}
    }).render(
      board({
        iris: { id: 'iris', open: true },
        hatch: { id: 'hatch', open: false }
      })
    )

    const node = asNode(actions as HTMLElement)
    assert.equal(node.className, 'sheet-actions')
    assert.equal(node.children[0]?.textContent, 'Close iris')
    assert.equal(node.children[0]?.className, 'active')
    assert.equal(node.children[0]?.title, 'iris: Open')
    assert.equal(node.children[1]?.textContent, 'Open hatch')
    assert.equal(node.children[1]?.className, '')
    assert.equal(node.children[1]?.title, 'hatch: Closed')

    node.children[0]?.click()
    node.children[1]?.click()

    assert.deepEqual(dispatched, [
      'SetDoorOpen:scout-deck:iris:false:42',
      'SetDoorOpen:scout-deck:hatch:true:42'
    ])
  })

  it('does not render actions without a selected board or doors', () => {
    const actions = createBoardDoorActions({
      document,
      identity: () => ({ gameId, actorId }),
      getState: gameState,
      dispatch: async () => {},
      reportError: () => {}
    })

    assert.equal(actions.render(null), null)
    assert.equal(actions.render(board({})), null)
  })

  it('skips dispatch without state and reports dispatch errors', async () => {
    const errors: string[] = []
    const actionsWithoutState = createBoardDoorActions({
      document,
      identity: () => ({ gameId, actorId }),
      getState: () => null,
      dispatch: async () => {
        throw new Error('should not dispatch')
      },
      reportError: (message) => {
        errors.push(message)
      }
    }).render(board({ iris: { id: 'iris', open: true } }))

    asNode(actionsWithoutState as HTMLElement).children[0]?.click()
    assert.deepEqual(errors, [])

    const failingActions = createBoardDoorActions({
      document,
      identity: () => ({ gameId, actorId }),
      getState: gameState,
      dispatch: async () => {
        throw new Error('command failed')
      },
      reportError: (message) => {
        errors.push(message)
      }
    }).render(board({ iris: { id: 'iris', open: false } }))

    asNode(failingActions as HTMLElement).children[0]?.click()
    await Promise.resolve()

    assert.deepEqual(errors, ['command failed'])
  })
})
