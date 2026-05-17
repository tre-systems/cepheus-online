import type {
  D1Database,
  DurableObjectNamespace,
  Fetcher,
  R2Bucket
} from './cloudflare'

export interface Env {
  GAME_ROOM: DurableObjectNamespace
  CEPHEUS_DB?: D1Database
  ASSET_BUCKET?: R2Bucket
  ASSETS?: Fetcher
  DISCORD_CLIENT_ID?: string
  DISCORD_CLIENT_SECRET?: string
  SESSION_SECRET?: string
  APP_BASE_URL?: string
}
