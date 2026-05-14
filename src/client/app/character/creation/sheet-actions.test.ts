import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asCharacterId, asGameId, asUserId } from '../../../../shared/ids'
import type { CharacterState } from '../../../../shared/state'
import {
  renderCharacterCreationSheetActions,
  type CharacterCreationSheetActionsDocument
} from './sheet-actions'
import { asNode, testDocument } from '../../core/test-dom.helper'

const gameId = asGameId('demo-room')
const actorId = asUserId('local-user')
const characterId = asCharacterId('traveller-1')

const document =
  testDocument as unknown as CharacterCreationSheetActionsDocument

const character = (): CharacterState => ({
  id: characterId,
  ownerId: actorId,
  type: 'PLAYER',
  name: 'Mae',
  active: true,
  notes: '',
  age: null,
  characteristics: {
    str: null,
    dex: null,
    end: null,
    int: null,
    edu: null,
    soc: null
  },
  skills: [],
  equipment: [],
  credits: 0,
  creation: null
})

describe('character creation sheet actions', () => {
  it('renders sheet actions from the shared action plan and dispatches commands', () => {
    const dispatched: string[] = []
    const view = renderCharacterCreationSheetActions(character(), {
      document,
      identity: () => ({ gameId, actorId }),
      dispatch: async (command) => {
        dispatched.push(command.type)
      },
      reportError: () => {}
    })

    assert.equal(view?.title, 'Creation')
    assert.equal(view?.status, 'Not started')
    const actions = asNode(view?.actions as HTMLElement)
    assert.equal(actions.className, 'sheet-actions creation-actions')
    assert.equal(actions.children[0]?.textContent, 'Start creation')

    actions.children[0]?.click()

    assert.deepEqual(dispatched, ['StartCharacterCreation'])
  })

  it('reports dispatch errors through the injected reporter', async () => {
    const errors: string[] = []
    const view = renderCharacterCreationSheetActions(character(), {
      document,
      identity: () => ({ gameId, actorId }),
      dispatch: async () => {
        throw new Error('command failed')
      },
      reportError: (message) => {
        errors.push(message)
      }
    })

    const actions = asNode(view?.actions as HTMLElement)
    actions.children[0]?.click()
    await Promise.resolve()

    assert.deepEqual(errors, ['command failed'])
  })

  it('returns no view when there is no selected character', () => {
    assert.equal(
      renderCharacterCreationSheetActions(null, {
        document,
        identity: () => ({ gameId, actorId }),
        dispatch: async () => {},
        reportError: () => {}
      }),
      null
    )
  })
})
