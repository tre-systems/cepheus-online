import type { Env } from './env'
import type { DiscordProfile } from './session-auth'

interface DiscordTokenResponse {
  access_token?: string
  token_type?: string
  error?: string
  error_description?: string
}

export const discordAuthorizeUrl = ({
  clientId,
  redirectUri,
  state
}: {
  clientId: string
  redirectUri: string
  state: string
}): string => {
  const url = new URL('https://discord.com/oauth2/authorize')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'identify')
  url.searchParams.set('state', state)
  return url.toString()
}

export const discordRedirectUri = (env: Env): string =>
  new URL('/auth/discord/callback', env.APP_BASE_URL).toString()

export const exchangeDiscordCode = async ({
  env,
  code,
  redirectUri
}: {
  env: Env
  code: string
  redirectUri: string
}): Promise<string> => {
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    throw new Error('Discord OAuth is not configured')
  }

  const body = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    client_secret: env.DISCORD_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri
  })

  const response = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    body
  })
  const token = (await response.json()) as DiscordTokenResponse
  if (!response.ok || !token.access_token) {
    throw new Error(
      token.error_description ?? token.error ?? 'Discord token exchange failed'
    )
  }

  return token.access_token
}

export const fetchDiscordProfile = async (
  accessToken: string
): Promise<DiscordProfile> => {
  const response = await fetch('https://discord.com/api/users/@me', {
    headers: {
      authorization: `Bearer ${accessToken}`
    }
  })
  if (!response.ok) {
    throw new Error('Discord profile fetch failed')
  }

  const profile = (await response.json()) as Partial<DiscordProfile>
  if (!profile.id || !profile.username) {
    throw new Error('Discord profile response is incomplete')
  }

  return {
    id: profile.id,
    username: profile.username,
    avatar: profile.avatar ?? null
  }
}
