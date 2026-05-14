import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { commandMetadataByType } from './command-metadata'

describe('command metadata', () => {
  it('assigns server handler domains from the command route', () => {
    assert.equal(commandMetadataByType.CreateGame.handlerDomain, 'game')
    assert.equal(commandMetadataByType.CreateBoard.handlerDomain, 'board')
    assert.equal(commandMetadataByType.MovePiece.handlerDomain, 'board')
    assert.equal(commandMetadataByType.SetDoorOpen.handlerDomain, 'board')
    assert.equal(commandMetadataByType.RollDice.handlerDomain, 'dice')
    assert.equal(commandMetadataByType.CreateCharacter.handlerDomain, 'character')
    assert.equal(
      commandMetadataByType.UpdateCharacterSheet.handlerDomain,
      'character'
    )
    assert.equal(
      commandMetadataByType.StartCharacterCreation.handlerDomain,
      'characterCreation'
    )
    assert.equal(
      commandMetadataByType.ResolveCharacterCreationSurvival.handlerDomain,
      'characterCreation'
    )
  })

  it('keeps deprecated generic creation advance outside public metadata', () => {
    assert.equal('AdvanceCharacterCreation' in commandMetadataByType, false)
  })
})
