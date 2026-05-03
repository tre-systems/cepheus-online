declare module 'node:test' {
  export const describe: (
    name: string,
    fn: () => void | Promise<void>
  ) => void
  export const it: (name: string, fn: () => void | Promise<void>) => void
}

declare module 'node:assert/strict' {
  export function equal(
    actual: unknown,
    expected: unknown,
    message?: string
  ): void
  export function deepEqual(
    actual: unknown,
    expected: unknown,
    message?: string
  ): void

  interface Assert {
    equal(actual: unknown, expected: unknown, message?: string): void
    deepEqual(actual: unknown, expected: unknown, message?: string): void
  }

  const assert: Assert
  export default assert
}
