const hasProperty = (value: unknown, property: string): boolean =>
  typeof value === 'object' &&
  value !== null &&
  Object.prototype.hasOwnProperty.call(value, property)

const fail = (message: string): never => {
  throw new Error(message)
}

export const expect = (actual: unknown) => ({
  toBe(expected: unknown): void {
    if (!Object.is(actual, expected)) {
      fail(`Expected ${String(actual)} to be ${String(expected)}`)
    }
  },

  toContain(expected: unknown): void {
    if (typeof actual === 'string' && typeof expected === 'string') {
      if (!actual.includes(expected)) {
        fail(`Expected ${actual} to contain ${expected}`)
      }
      return
    }

    if (Array.isArray(actual)) {
      if (!actual.includes(expected)) {
        fail(`Expected ${String(actual)} to contain ${String(expected)}`)
      }
      return
    }

    fail('Expected value to support contains')
  },

  toBeDefined(): void {
    if (actual === undefined) {
      fail('Expected value to be defined')
    }
  },

  toHaveLength(expected: number): void {
    if (typeof actual === 'string' || Array.isArray(actual)) {
      if (actual.length !== expected) {
        fail(`Expected value to have length ${expected}`)
      }
      return
    }

    fail(`Expected value to have length ${expected}`)
  },

  toHaveProperty(property: string): void {
    if (!hasProperty(actual, property)) {
      fail(`Expected value to have property ${property}`)
    }
  },

  not: {
    toHaveProperty(property: string): void {
      if (hasProperty(actual, property)) {
        fail(`Expected value not to have property ${property}`)
      }
    }
  }
})
