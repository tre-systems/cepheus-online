import type {DurableObjectNamespace, Fetcher} from './cloudflare'

export interface Env {
  GAME_ROOM: DurableObjectNamespace
  ASSETS?: Fetcher
}
