export const jsonResponse = (
  value: unknown,
  init: ResponseInit = {}
): Response => {
  const headers = new Headers(init.headers)
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json; charset=utf-8')
  }

  return new Response(JSON.stringify(value), {
    ...init,
    headers
  })
}
