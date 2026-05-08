declare module 'node:test' {
  export const describe: (name: string, fn: () => void | Promise<void>) => void
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

declare module 'node:fs' {
  export interface Dirent {
    name: string
    isDirectory(): boolean
    isFile(): boolean
  }

  export function readdirSync(
    path: string,
    options: { withFileTypes: true }
  ): Dirent[]
  export function readFileSync(path: string, encoding: 'utf8'): string
}

declare module 'node:path' {
  export function dirname(path: string): string
  export function join(...paths: string[]): string
  export function normalize(path: string): string
  export function relative(from: string, to: string): string
  export function resolve(...paths: string[]): string
}
