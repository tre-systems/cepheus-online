export interface RequestIdClock {
  now: () => number
}

export interface CreateRequestIdFactoryOptions {
  now?: () => number
  clock?: RequestIdClock
}

export type RequestIdFactory = (prefix: string) => string

const defaultNow = (): number => Date.now()

export const createRequestIdFactory = ({
  now,
  clock
}: CreateRequestIdFactoryOptions = {}): RequestIdFactory => {
  const readNow = now ?? (clock ? () => clock.now() : defaultNow)
  let counter = 0

  return (prefix) =>
    `${prefix}-${readNow().toString(36)}-${(++counter).toString(36)}`
}
