import {describe, it} from 'node:test'
import {expect} from '../../test/expect'

import {inviteUsersInputSchema} from './functions'

describe('functions schema', () => {
  describe('inviteUsersInputSchema', () => {
    it('should have correct title', () => {
      expect(inviteUsersInputSchema.title).toBe('Invite Users Input')
    })

    it('should require gameID and invites', () => {
      expect(inviteUsersInputSchema.required).toContain('gameID')
      expect(inviteUsersInputSchema.required).toContain('invites')
    })

    it('should have gameID property', () => {
      expect(inviteUsersInputSchema.properties.gameID).toBeDefined()
    })

    it('should have invites array property', () => {
      const invites = inviteUsersInputSchema.properties.invites
      expect(invites.type).toBe('array')
    })

    it('should validate invite string length', () => {
      const inviteItems = inviteUsersInputSchema.properties.invites.items
      expect(inviteItems.type).toBe('string')
      expect(inviteItems.minLength).toBe(1)
      expect(inviteItems.maxLength).toBe(64)
    })

    it('should have error messages for invite validation', () => {
      const errorMessage =
        inviteUsersInputSchema.properties.invites.items.errorMessage
      expect(errorMessage.type).toBeDefined()
      expect(errorMessage.minLength).toBeDefined()
      expect(errorMessage.maxLength).toBeDefined()
    })
  })
})
