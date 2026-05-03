export const mulberry32 = (seed: number): (() => number) => {
  let state = seed | 0

  return () => {
    state = (state + 0x6d2b79f5) | 0

    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value

    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000
  }
}

const KNUTH_MULTIPLICATIVE_HASH = 0x9e3779b9

export const deriveEventRng = (
  gameSeed: number,
  eventSeq: number
): (() => number) =>
  mulberry32(
    (gameSeed ^ Math.imul(eventSeq, KNUTH_MULTIPLICATIVE_HASH)) | 0
  )
