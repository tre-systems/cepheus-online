import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { PieceId } from '../../../../shared/ids'
import type { RequiredAppElements } from '../../core/elements'
import type { RoomIdentity, RoomMenuControllerOptions } from './controller'
import { createRoomMenuWiring } from './wiring'

const fakeElement = <T>(): T => ({}) as T

const createElements = (): RequiredAppElements =>
  ({
    roomForm: fakeElement<HTMLFormElement>(),
    roomInput: fakeElement<HTMLInputElement>(),
    userInput: fakeElement<HTMLInputElement>(),
    betaRoomNameInput: fakeElement<HTMLInputElement>(),
    betaCreateRoom: fakeElement<HTMLButtonElement>(),
    betaInviteRole: fakeElement<HTMLSelectElement>(),
    betaCreateInvite: fakeElement<HTMLButtonElement>(),
    betaInviteLink: fakeElement<HTMLInputElement>(),
    betaInviteToken: fakeElement<HTMLInputElement>(),
    betaAcceptInvite: fakeElement<HTMLButtonElement>(),
    betaRoomStatus: fakeElement<HTMLElement>(),
    menu: fakeElement<HTMLButtonElement>(),
    roomDialog: fakeElement<HTMLDialogElement>(),
    roomCancel: fakeElement<HTMLButtonElement>()
  }) as RequiredAppElements

describe('room menu wiring', () => {
  it('maps app elements and delegates open-room dependencies', async () => {
    const elements = createElements()
    const capturedOptions: RoomMenuControllerOptions[] = []
    const calls: string[] = []
    const selectedPieces: (PieceId | null)[] = []
    const identity: RoomIdentity = {
      roomId: 'room-2',
      actorId: 'actor-2'
    }

    createRoomMenuWiring({
      elements,
      initialRoomId: 'room-1',
      initialActorId: 'actor-1',
      defaultRoomId: 'default-room',
      defaultActorId: 'default-actor',
      getCurrentActorId: () => 'actor-current',
      createRoom: async ({ name }) => ({ id: name }),
      createInvite: async ({ roomId, role }) => ({
        inviteUrl: `${roomId}:${role}`
      }),
      acceptInvite: async (token) => ({ roomId: token }),
      onOpenRoomIdentity: (nextIdentity) => {
        calls.push(`identity:${nextIdentity.roomId}:${nextIdentity.actorId}`)
      },
      setAppSessionRoomIdentity: (nextIdentity) => {
        calls.push(`session:${nextIdentity.roomId}:${nextIdentity.actorId}`)
      },
      resetDiceRevealTracking: () => {
        calls.push('reset-dice')
      },
      clearSelectedCharacter: () => {
        calls.push('clear-character')
      },
      clearCreationActivityFeed: () => {
        calls.push('clear-feed')
      },
      hydrateCreationPresenceDock: () => {
        calls.push('hydrate-presence')
      },
      selectPiece: (pieceId) => {
        selectedPieces.push(pieceId)
        calls.push('select-piece')
      },
      clearBoardDrag: () => {
        calls.push('clear-drag')
      },
      closeCharacterSheet: () => {
        calls.push('close-sheet')
      },
      connectSocket: () => {
        calls.push('connect')
      },
      fetchState: async () => {
        calls.push('fetch')
      },
      reportError: (message) => {
        calls.push(`error:${message}`)
      },
      createController: (options) => {
        capturedOptions.push(options)
        return { dispose: () => {} }
      }
    })

    const options = capturedOptions[0]
    if (!options) throw new Error('Expected controller options')
    assert.equal(options.elements.roomForm, elements.roomForm)
    assert.equal(options.elements.roomInput, elements.roomInput)
    assert.equal(options.elements.userInput, elements.userInput)
    assert.equal(options.elements.betaRoomNameInput, elements.betaRoomNameInput)
    assert.equal(options.elements.betaCreateRoomButton, elements.betaCreateRoom)
    assert.equal(options.elements.betaInviteRoleSelect, elements.betaInviteRole)
    assert.equal(
      options.elements.betaCreateInviteButton,
      elements.betaCreateInvite
    )
    assert.equal(options.elements.betaInviteLinkInput, elements.betaInviteLink)
    assert.equal(
      options.elements.betaInviteTokenInput,
      elements.betaInviteToken
    )
    assert.equal(
      options.elements.betaAcceptInviteButton,
      elements.betaAcceptInvite
    )
    assert.equal(options.elements.betaRoomStatus, elements.betaRoomStatus)
    assert.equal(options.elements.menuButton, elements.menu)
    assert.equal(options.elements.roomDialog, elements.roomDialog)
    assert.equal(options.elements.roomCancelButton, elements.roomCancel)
    assert.equal(options.initialRoomId, 'room-1')
    assert.equal(options.initialActorId, 'actor-1')
    assert.equal(options.defaultRoomId, 'default-room')
    assert.equal(options.defaultActorId, 'default-actor')
    assert.equal(options.getCurrentActorId?.(), 'actor-current')
    assert.equal((await options.createRoom?.({ name: 'room-x' }))?.id, 'room-x')
    assert.equal(
      (await options.createInvite?.({ roomId: 'room-x', role: 'PLAYER' }))
        ?.inviteUrl,
      'room-x:PLAYER'
    )
    assert.equal((await options.acceptInvite?.('token-x'))?.roomId, 'token-x')

    options.onOpenRoom(identity)
    await Promise.resolve()

    assert.deepEqual(selectedPieces, [null])
    assert.deepEqual(calls, [
      'identity:room-2:actor-2',
      'session:room-2:actor-2',
      'reset-dice',
      'clear-character',
      'clear-feed',
      'hydrate-presence',
      'select-piece',
      'clear-drag',
      'close-sheet',
      'connect',
      'fetch'
    ])
  })
})
