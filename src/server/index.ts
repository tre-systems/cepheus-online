import { asGameId } from '../shared/ids'
import type { Env } from './env'
import { GameRoomDO } from './game-room/game-room-do'
import { jsonResponse } from './http'
import { serveStaticClient } from './static-client'

export { GameRoomDO }

const routeGameRoom = (
  request: Request,
  env: Env
): Response | Promise<Response> => {
  const url = new URL(request.url)
  const parts = url.pathname.split('/').filter(Boolean)

  if (parts[0] !== 'rooms' || !parts[1]) {
    return jsonResponse({ error: 'Not found' }, { status: 404 })
  }

  try {
    const gameId = asGameId(parts[1])
    const id = env.GAME_ROOM.idFromName(gameId)
    return env.GAME_ROOM.get(id).fetch(request)
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Invalid room id'
      },
      { status: 400 }
    )
  }
}

export default {
  fetch(request: Request, env: Env): Response | Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/health' || url.pathname === '/api/health') {
      return jsonResponse({
        ok: true,
        service: 'cepheus-online',
        worker: 'ready'
      })
    }

    if (url.pathname.startsWith('/rooms/')) {
      return routeGameRoom(request, env)
    }

    const staticClientResponse = serveStaticClient(url.pathname)
    if (staticClientResponse) {
      return staticClientResponse
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request)
    }

    return jsonResponse({ error: 'Not found' }, { status: 404 })
  }
}
