import type { DurableObjectStorage } from '../cloudflare'

export interface MemoryDurableObjectStorage extends DurableObjectStorage {
  readonly records: Map<string, unknown>
}

export const createMemoryStorage = (): MemoryDurableObjectStorage => {
  const records = new Map<string, unknown>()

  return {
    records,

    async get<T>(key: string): Promise<T | undefined> {
      return records.get(key) as T | undefined
    },

    async put<T>(
      keyOrEntries: string | Record<string, unknown>,
      value?: T
    ): Promise<void> {
      if (typeof keyOrEntries === 'string') {
        records.set(keyOrEntries, value)
        return
      }

      for (const [key, entryValue] of Object.entries(keyOrEntries)) {
        records.set(key, entryValue)
      }
    },

    async delete(key: string): Promise<boolean> {
      return records.delete(key)
    }
  }
}
