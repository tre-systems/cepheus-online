export interface ImageDimensions {
  width: number
  height: number
}

export interface ImageCrop extends ImageDimensions {
  x: number
  y: number
}

export interface ImageFileInput {
  files?: FileList | null
}

export interface BrowserImageCacheEntry {
  image: HTMLImageElement
  loaded: boolean
  failed: boolean
}

export const cropStartsInsideImage = (
  crop: Pick<ImageCrop, 'x' | 'y'>,
  dimensions: ImageDimensions
) => crop.x < dimensions.width && crop.y < dimensions.height

export const readSelectedImageFileAsDataUrl = (input: ImageFileInput) =>
  new Promise<string | null>((resolve, reject) => {
    const file = input.files?.[0]
    if (!file) {
      resolve(null)
      return
    }
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selected file must be an image'))
      return
    }

    const reader = new FileReader()
    reader.addEventListener('load', () => {
      resolve(typeof reader.result === 'string' ? reader.result : null)
    })
    reader.addEventListener('error', () => {
      reject(new Error('Could not read selected image'))
    })
    reader.readAsDataURL(file)
  })

export const readSelectedCroppedImageFileAsDataUrl = (
  input: ImageFileInput,
  crop: ImageCrop
) =>
  new Promise<string | null>((resolve, reject) => {
    const file = input.files?.[0]
    if (!file) {
      resolve(null)
      return
    }
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selected file must be an image'))
      return
    }

    const image = new Image()
    const objectUrl = URL.createObjectURL(file)
    const cleanup = () => URL.revokeObjectURL(objectUrl)
    image.addEventListener('load', () => {
      cleanup()
      if (
        !cropStartsInsideImage(crop, {
          width: image.naturalWidth,
          height: image.naturalHeight
        })
      ) {
        reject(new Error('Crop starts outside selected image'))
        return
      }

      const canvas = document.createElement('canvas')
      canvas.width = crop.width
      canvas.height = crop.height
      const canvasContext = canvas.getContext('2d')
      if (!canvasContext) {
        reject(new Error('Could not crop selected image'))
        return
      }
      canvasContext.drawImage(
        image,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        crop.width,
        crop.height
      )
      resolve(canvas.toDataURL('image/png'))
    })
    image.addEventListener('error', () => {
      cleanup()
      reject(new Error('Could not crop selected image'))
    })
    image.src = objectUrl
  })

export const readImageDimensions = (file: File) =>
  new Promise<ImageDimensions>((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selected file must be an image'))
      return
    }

    const image = new Image()
    const objectUrl = URL.createObjectURL(file)
    image.addEventListener('load', () => {
      const dimensions = {
        width: image.naturalWidth,
        height: image.naturalHeight
      }
      URL.revokeObjectURL(objectUrl)
      resolve(dimensions)
    })
    image.addEventListener('error', () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Could not inspect selected image'))
    })
    image.src = objectUrl
  })

export const browserImageUrl = (value: string | null | undefined) => {
  const imageRef = value || ''
  if (
    imageRef.startsWith('/') ||
    imageRef.startsWith('http://') ||
    imageRef.startsWith('https://') ||
    imageRef.startsWith('blob:') ||
    imageRef.startsWith('data:image/')
  ) {
    return imageRef
  }
  return null
}

export const cssUrl = (url: string) => `url(${JSON.stringify(url)})`

export const loadBrowserImage = (
  url: string | null,
  cache: Map<string, BrowserImageCacheEntry>,
  onLoad: () => void
) => {
  if (!url) return null

  const cached = cache.get(url)
  if (cached) {
    return cached.loaded && !cached.failed ? cached.image : null
  }

  const image = new Image()
  image.decoding = 'async'
  image.onload = () => {
    const cachedState = cache.get(url)
    if (cachedState) cachedState.loaded = true
    onLoad()
  }
  image.onerror = () => {
    const cachedState = cache.get(url)
    if (cachedState) cachedState.failed = true
  }
  cache.set(url, { image, loaded: false, failed: false })
  image.src = url
  return null
}
