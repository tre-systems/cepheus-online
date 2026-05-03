type Coordinate3D = [number, number, number]

export const getMidpoint = (
  start: Coordinate3D,
  end: Coordinate3D
): Coordinate3D | null =>
  start &&
  end && [
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2,
    (start[2] + end[2]) / 2
  ]

export const getLength = (
  start: Coordinate3D,
  end: Coordinate3D,
  scale = 20.0
): string | null =>
  start &&
  end &&
  (
    Math.sqrt(
      (start[0] - end[0]) * (start[0] - end[0]) +
        (start[1] - end[1]) * (start[1] - end[1])
    ) / scale
  ).toFixed(1)

export const getRange = (length: number): string | undefined => {
  if (isNaN(length)) {
    return undefined
  }
  if (length < 1.5) {
    return 'Personal'
  }
  if (length <= 3) {
    return 'Close'
  }
  if (length <= 12) {
    return 'Short'
  }
  if (length <= 50) {
    return 'Medium'
  }
  if (length <= 250) {
    return 'Long'
  }
  if (length <= 500) {
    return 'Very Long'
  }

  return 'Distant'
}
