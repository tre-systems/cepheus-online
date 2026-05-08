import { STATIC_CLIENT_ASSETS } from './static-client-assets.generated'

const textResponse = (body: string, contentType: string): Response =>
  new Response(body, {
    headers: {
      'content-type': contentType
    }
  })

export const serveStaticClient = (pathname: string): Response | null => {
  const asset =
    STATIC_CLIENT_ASSETS[pathname as keyof typeof STATIC_CLIENT_ASSETS]

  if (!asset) {
    return null
  }

  return textResponse(asset.body, asset.contentType)
}
