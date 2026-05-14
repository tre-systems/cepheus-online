import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  commandMetadataByType,
  type CommandTypeForHandlerDomain,
  type CommandTypeForRoute
} from './command-metadata'

type Assert<T extends true> = T
type IsAssignable<TValue, TExpected> = TValue extends TExpected ? true : false
type IsNotAssignable<TValue, TExpected> = TValue extends TExpected
  ? false
  : true

describe('command metadata', () => {
  it('assigns server handler domains from the command route', () => {
    assert.equal(commandMetadataByType.CreateGame.handlerDomain, 'game')
    assert.equal(commandMetadataByType.CreateBoard.handlerDomain, 'board')
    assert.equal(commandMetadataByType.MovePiece.handlerDomain, 'board')
    assert.equal(commandMetadataByType.SetDoorOpen.handlerDomain, 'board')
    assert.equal(commandMetadataByType.RollDice.handlerDomain, 'dice')
    assert.equal(
      commandMetadataByType.CreateCharacter.handlerDomain,
      'character'
    )
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

  it('exposes route and handler-domain command type helpers', () => {
    const assertions: [
      Assert<
        IsAssignable<
          'CreateCharacter',
          CommandTypeForRoute<'characterCreation'>
        >
      >,
      Assert<
        IsNotAssignable<
          'CreateCharacter',
          CommandTypeForHandlerDomain<'characterCreation'>
        >
      >,
      Assert<
        IsAssignable<
          'ResolveCharacterCreationSurvival',
          CommandTypeForHandlerDomain<'characterCreation'>
        >
      >,
      Assert<
        IsAssignable<
          'UpdateCharacterSheet',
          CommandTypeForHandlerDomain<'character'>
        >
      >,
      Assert<IsAssignable<'SetDoorOpen', CommandTypeForHandlerDomain<'board'>>>,
      Assert<IsAssignable<'RollDice', CommandTypeForHandlerDomain<'dice'>>>
    ] = [true, true, true, true, true, true]

    assert.equal(assertions.length, 6)
  })
})
