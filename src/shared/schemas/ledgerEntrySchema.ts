import type {NumberProperty, StringProperty} from './schemaTypes'

interface LedgerEntrySchema {
  title: string
  type: 'object'
  required: readonly string[]
  properties: {
    reference: StringProperty
    credits: NumberProperty
  }
}

const ledgerEntrySchema = Object.freeze({
  title: 'Item',
  type: 'object',
  required: ['reference'],
  properties: {
    reference: {
      title: 'Reference',
      type: 'string'
    },
    credits: {
      title: 'Credits',
      type: ['number']
    }
  }
} as const) satisfies LedgerEntrySchema

export default ledgerEntrySchema
