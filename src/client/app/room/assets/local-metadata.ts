const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const parseLocalAssetMetadataCandidates = (
  text: string
): readonly unknown[] => {
  const trimmed = text.trim()
  if (!trimmed) return []

  const parsed = JSON.parse(trimmed) as unknown
  if (Array.isArray(parsed)) return parsed
  if (isObject(parsed) && Array.isArray(parsed.assets)) {
    return parsed.assets
  }
  if (isObject(parsed)) return [parsed]

  throw new Error(
    'Local asset metadata must be a JSON object, array, or assets object'
  )
}
