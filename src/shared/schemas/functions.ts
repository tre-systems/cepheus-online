import {gameID} from './types'

interface ArraySchema {
  type: 'array'
  items: {
    type: 'string'
    minLength: number
    maxLength: number
    errorMessage: {
      type: string
      minLength: string
      maxLength: string
    }
  }
}

interface InviteUsersInputSchema {
  title: string
  type: 'object'
  required: readonly string[]
  properties: {
    gameID: typeof gameID
    invites: ArraySchema
  }
}

export const inviteUsersInputSchema = Object.freeze({
  title: 'Invite Users Input',
  type: 'object',
  required: ['gameID', 'invites'],
  properties: {
    gameID,
    invites: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 1,
        maxLength: 64,
        errorMessage: {
          type: 'The invite must be a string.',
          minLength: 'The invite must be at least 1 character long.',
          maxLength: 'The invite must be shorter than 64 characters.'
        }
      }
    }
  }
} as const) satisfies InviteUsersInputSchema
