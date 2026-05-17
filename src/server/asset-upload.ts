import { err, ok, type Result } from '../shared/result'
import { isObject } from '../shared/util'

export const MAX_ASSET_UPLOAD_BYTES = 10 * 1024 * 1024

export const SUPPORTED_ASSET_CONTENT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp'
] as const

export type SupportedAssetContentType =
  (typeof SUPPORTED_ASSET_CONTENT_TYPES)[number]

export interface ImageDimensions {
  width: number
  height: number
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

const isSupportedAssetContentType = (
  value: string
): value is SupportedAssetContentType =>
  SUPPORTED_ASSET_CONTENT_TYPES.includes(value as SupportedAssetContentType)

const readUint24Le = (view: DataView, offset: number): number =>
  view.getUint8(offset) |
  (view.getUint8(offset + 1) << 8) |
  (view.getUint8(offset + 2) << 16)

const parsePngDimensions = (
  bytes: Uint8Array
): Result<ImageDimensions, string> => {
  if (bytes.length < 24) return err('PNG file is too small')
  if (!PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) {
    return err('PNG signature is invalid')
  }
  const type = new TextDecoder().decode(bytes.slice(12, 16))
  if (type !== 'IHDR') return err('PNG IHDR chunk is missing')

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return ok({
    width: view.getUint32(16),
    height: view.getUint32(20)
  })
}

const parseJpegDimensions = (
  bytes: Uint8Array
): Result<ImageDimensions, string> => {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return err('JPEG signature is invalid')
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 2
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) return err('JPEG marker is invalid')
    const marker = bytes[offset + 1]
    offset += 2

    if (marker === 0xd8 || marker === 0xd9) continue
    if (marker >= 0xd0 && marker <= 0xd7) continue
    if (offset + 2 > bytes.length) return err('JPEG segment is truncated')

    const segmentLength = view.getUint16(offset)
    if (segmentLength < 2 || offset + segmentLength > bytes.length) {
      return err('JPEG segment length is invalid')
    }

    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      if (segmentLength < 7) return err('JPEG frame segment is truncated')
      return ok({
        height: view.getUint16(offset + 3),
        width: view.getUint16(offset + 5)
      })
    }

    offset += segmentLength
  }

  return err('JPEG size marker is missing')
}

const parseWebpDimensions = (
  bytes: Uint8Array
): Result<ImageDimensions, string> => {
  if (bytes.length < 30) return err('WebP file is too small')
  const signature = new TextDecoder().decode(bytes.slice(0, 12))
  if (!signature.startsWith('RIFF') || signature.slice(8) !== 'WEBP') {
    return err('WebP signature is invalid')
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const chunkType = new TextDecoder().decode(bytes.slice(12, 16))

  if (chunkType === 'VP8X') {
    return ok({
      width: readUint24Le(view, 24) + 1,
      height: readUint24Le(view, 27) + 1
    })
  }

  if (chunkType === 'VP8L') {
    const bits = view.getUint32(21, true)
    return ok({
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1
    })
  }

  if (chunkType === 'VP8 ') {
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) {
      return err('WebP VP8 frame header is invalid')
    }
    return ok({
      width: view.getUint16(26, true) & 0x3fff,
      height: view.getUint16(28, true) & 0x3fff
    })
  }

  return err('Unsupported WebP chunk type')
}

export const validateAssetContentType = (
  contentType: string
): Result<SupportedAssetContentType, string> => {
  const normalized = contentType.split(';')[0]?.trim().toLowerCase() ?? ''
  if (!isSupportedAssetContentType(normalized)) {
    return err('Asset must be a PNG, JPEG, or WebP image')
  }

  return ok(normalized)
}

export const parseUploadedImageDimensions = (
  bytes: Uint8Array,
  contentType: SupportedAssetContentType
): Result<ImageDimensions, string> => {
  const dimensions =
    contentType === 'image/png'
      ? parsePngDimensions(bytes)
      : contentType === 'image/jpeg'
        ? parseJpegDimensions(bytes)
        : parseWebpDimensions(bytes)
  if (!dimensions.ok) return dimensions
  if (dimensions.value.width <= 0 || dimensions.value.height <= 0) {
    return err('Image dimensions must be positive')
  }

  return dimensions
}

export const parsePositiveGridScale = (value: FormDataEntryValue | null) => {
  if (typeof value !== 'string' || !value.trim()) return ok(50)
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return err('Grid scale must be a positive integer')
  }

  return ok(parsed)
}

export const normalizeLosSidecarInput = (
  value: FormDataEntryValue | null,
  assetId: string
): Result<unknown | null, string> => {
  if (value === null || value === '') return ok(null)
  if (typeof value !== 'string') return err('LOS sidecar must be JSON text')

  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    return err('LOS sidecar JSON is invalid')
  }
  if (!isObject(parsed)) return err('LOS sidecar must be an object')

  return ok({
    ...parsed,
    assetRef: assetId
  })
}
