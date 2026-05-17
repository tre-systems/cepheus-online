import { expect, test, type Browser, type Page } from '@playwright/test'

import { uniqueRoomId } from './support/app'

interface TestSessionBody {
  authenticated: boolean
  user: {
    id: string
    username: string
  }
}

const signInLocalTestUser = async (
  page: Page,
  {
    discordId,
    username
  }: {
    discordId: string
    username: string
  }
): Promise<TestSessionBody> => {
  const response = await page.request.post('/api/test/session', {
    data: { discordId, username }
  })
  expect(response.ok()).toBe(true)
  const body = (await response.json()) as TestSessionBody
  expect(body.authenticated).toBe(true)
  const cookie = response.headers()['set-cookie']?.split(';')[0] ?? ''
  const [cookieName, ...cookieValueParts] = cookie.split('=')
  expect(cookieName).toBe('cepheus_session')
  await page.context().addCookies([
    {
      name: cookieName,
      value: cookieValueParts.join('='),
      url: new URL(response.url()).origin,
      httpOnly: true,
      sameSite: 'Lax'
    }
  ])

  const sessionResponse = await page.request.get('/api/session')
  expect(sessionResponse.ok()).toBe(true)
  const sessionBody = (await sessionResponse.json()) as TestSessionBody
  expect(sessionBody.user.id).toBe(body.user.id)

  return body
}

const newSignedInPage = async (
  browser: Browser,
  input: { discordId: string; username: string }
): Promise<{ page: Page; userId: string }> => {
  const context = await browser.newContext()
  const page = await context.newPage()
  const session = await signInLocalTestUser(page, input)

  return { page, userId: session.user.id }
}

test.describe('private beta smoke', () => {
  test('creates a room, invites a player, and opens two authenticated tabs', async ({
    browser
  }) => {
    const roomName = uniqueRoomId('private-beta-room')
    const owner = await newSignedInPage(browser, {
      discordId: `${roomName}-owner`,
      username: 'Private Beta Owner'
    })

    await owner.page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(owner.page.locator('#boardCanvas')).toBeVisible()
    await owner.page.locator('#menuButton').click()
    await expect(owner.page.locator('#roomDialog')).toBeVisible()

    await owner.page.locator('#betaRoomNameInput').fill(roomName)
    await owner.page.locator('#betaCreateRoomButton').click()
    await expect(owner.page.locator('#roomDialog')).toBeHidden()

    await owner.page.locator('#menuButton').click()
    await expect(owner.page.locator('#betaRoomStatus')).toHaveText(
      'Room created'
    )
    const roomId = await owner.page.locator('#roomInput').inputValue()
    expect(roomId).toMatch(/^room_/)
    await expect(owner.page.locator('#userInput')).toHaveValue(owner.userId)

    await owner.page.locator('#betaInviteRoleSelect').selectOption('PLAYER')
    await owner.page.locator('#betaCreateInviteButton').click()
    await expect(owner.page.locator('#betaRoomStatus')).toHaveText(
      'Invite created'
    )
    const inviteUrl = await owner.page.locator('#betaInviteLinkInput').inputValue()
    expect(inviteUrl).toContain('?invite=')
    const inviteToken = new URL(inviteUrl).searchParams.get('invite')
    expect(inviteToken).toBeTruthy()

    const ownerState = await owner.page.request.get(
      `/rooms/${encodeURIComponent(roomId)}/state?viewer=spectator`
    )
    expect(ownerState.status()).toBe(200)

    const player = await newSignedInPage(browser, {
      discordId: `${roomName}-player`,
      username: 'Private Beta Player'
    })

    await player.page.goto(inviteUrl, { waitUntil: 'domcontentloaded' })
    await expect(player.page.locator('#boardCanvas')).toBeVisible()
    await player.page.locator('#menuButton').click()
    await expect(player.page.locator('#betaInviteTokenInput')).toHaveValue(
      inviteToken ?? ''
    )
    await player.page.locator('#betaAcceptInviteButton').click()
    await expect(player.page.locator('#roomDialog')).toBeHidden()

    await player.page.locator('#menuButton').click()
    await expect(player.page.locator('#betaRoomStatus')).toHaveText(
      'Invite accepted'
    )
    await expect(player.page.locator('#roomInput')).toHaveValue(roomId)
    await expect(player.page.locator('#userInput')).toHaveValue(player.userId)

    const playerState = await player.page.request.get(
      `/rooms/${encodeURIComponent(roomId)}/state?viewer=referee`
    )
    expect(playerState.status()).toBe(200)

    const playerInviteAttempt = await player.page.request.post(
      `/api/rooms/${encodeURIComponent(roomId)}/invites`,
      { data: { role: 'SPECTATOR' } }
    )
    expect(playerInviteAttempt.status()).toBe(403)

    await expect(owner.page.locator('#connectionStatus')).toBeVisible()
    await expect(player.page.locator('#connectionStatus')).toBeVisible()
  })
})
