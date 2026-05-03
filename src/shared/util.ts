export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const isString = (value: unknown): value is string =>
  typeof value === 'string'

export const randomChoice = <T>(items: readonly T[], rng: () => number): T => {
  if (items.length === 0) {
    throw new Error('Cannot choose from an empty array')
  }

  return items[Math.floor(rng() * items.length)]
}

export const sumBy = <T>(
  items: readonly T[],
  project: (item: T) => number
): number => items.reduce((sum, item) => sum + project(item), 0)

export const minBy = <T>(
  items: readonly T[],
  project: (item: T) => number
): T | undefined =>
  items.reduce<T | undefined>(
    (best, item) =>
      best === undefined || project(item) < project(best) ? item : best,
    undefined
  )

export const maxBy = <T>(
  items: readonly T[],
  project: (item: T) => number
): T | undefined =>
  items.reduce<T | undefined>(
    (best, item) =>
      best === undefined || project(item) > project(best) ? item : best,
    undefined
  )

export const indexBy = <T>(
  items: readonly T[],
  project: (item: T) => string
): Record<string, T> =>
  Object.fromEntries(items.map((item) => [project(item), item]))

export const groupBy = <T>(
  items: readonly T[],
  project: (item: T) => string
): Record<string, T[]> =>
  items.reduce<Record<string, T[]>>((groups, item) => {
    const key = project(item)
    groups[key] = groups[key] ?? []
    groups[key].push(item)

    return groups
  }, {})

export const compact = <T>(
  items: readonly (T | null | undefined)[]
): T[] => items.filter((item): item is T => item != null)

export const filterMap = <T, U>(
  items: readonly T[],
  project: (item: T) => U | null | undefined
): U[] =>
  items.reduce<U[]>((acc, item) => {
    const result = project(item)
    if (result != null) acc.push(result)

    return acc
  }, [])

export const uniqueBy = <T>(
  items: readonly T[],
  project: (item: T) => string | number
): T[] => {
  const seen = new Set<string | number>()

  return items.filter((item) => {
    const key = project(item)
    if (seen.has(key)) return false

    seen.add(key)
    return true
  })
}

export const mapValues = <V, U>(
  values: Readonly<Record<string, V>>,
  project: (value: V, key: string) => U
): Record<string, U> =>
  Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, project(value, key)])
  )

export const partition = <T>(
  items: readonly T[],
  predicate: (item: T) => boolean
): [T[], T[]] =>
  items.reduce<[T[], T[]]>(
    ([matches, rest], item) => {
      const target = predicate(item) ? matches : rest
      target.push(item)
      return [matches, rest]
    },
    [[], []]
  )
