export interface WorkerRateLimitRule {
  readonly windowMs: number
  readonly maxRequests: number
  readonly maxKeys?: number
}

export interface WorkerRateLimitDecision {
  readonly allowed: boolean
  readonly retryAfterSeconds: number
}

export interface WorkerRateLimiter {
  check(key: string, nowMs?: number): WorkerRateLimitDecision
}

interface RateLimitWindow {
  count: number
  resetAt: number
}

const DEFAULT_MAX_KEYS = 10_000

export const createWorkerRateLimiter = ({
  windowMs,
  maxRequests,
  maxKeys = DEFAULT_MAX_KEYS
}: WorkerRateLimitRule): WorkerRateLimiter => {
  const windows = new Map<string, RateLimitWindow>()

  const prune = (nowMs: number): void => {
    for (const [key, window] of windows.entries()) {
      if (window.resetAt <= nowMs) windows.delete(key)
    }

    while (windows.size > maxKeys) {
      const oldest = windows.keys().next().value as string | undefined
      if (!oldest) return
      windows.delete(oldest)
    }
  }

  return {
    check: (key, nowMs = Date.now()) => {
      prune(nowMs)

      const current = windows.get(key)
      if (!current || current.resetAt <= nowMs) {
        windows.set(key, {
          count: 1,
          resetAt: nowMs + windowMs
        })
        return { allowed: true, retryAfterSeconds: 0 }
      }

      if (current.count >= maxRequests) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((current.resetAt - nowMs) / 1000)
          )
        }
      }

      current.count += 1
      return { allowed: true, retryAfterSeconds: 0 }
    }
  }
}

export const requestClientKey = (request: Request): string => {
  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  if (cfConnectingIp) return cfConnectingIp

  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0]?.trim() ?? 'unknown'

  return new URL(request.url).hostname
}
