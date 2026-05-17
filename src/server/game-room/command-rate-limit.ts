import type { CommandError } from '../../shared/protocol'
import type { Result } from '../../shared/result'
import { commandError } from './command-helpers'

export interface CommandRateLimiter {
  check(key: string): Result<void, CommandError>
}

export const createCommandRateLimiter = ({
  windowMs,
  maxCommandsPerWindow
}: {
  windowMs: number
  maxCommandsPerWindow: number
}): CommandRateLimiter => {
  const windows = new Map<string, { count: number; resetAt: number }>()

  return {
    check: (key) => {
      const now = Date.now()
      for (const [windowKey, window] of windows.entries()) {
        if (window.resetAt <= now) {
          windows.delete(windowKey)
        }
      }

      const current = windows.get(key)
      if (!current || current.resetAt <= now) {
        windows.set(key, {
          count: 1,
          resetAt: now + windowMs
        })
        return { ok: true, value: undefined }
      }

      if (current.count >= maxCommandsPerWindow) {
        return {
          ok: false,
          error: commandError('not_allowed', 'Too many commands; slow down')
        }
      }

      current.count += 1
      return { ok: true, value: undefined }
    }
  }
}
