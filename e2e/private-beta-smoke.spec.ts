import { expect, test, type Browser, type Page } from '@playwright/test'

import { uniqueRoomId } from './support/app'
import { actorSessionFromPage, postCommand } from './support/character-creation'

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

const createPrivateBetaRoom = async (
  page: Page,
  roomId = uniqueRoomId('private-beta-room')
): Promise<string> => {
  const response = await page.request.post('/api/rooms', {
    data: {
      roomId,
      name: roomId
    }
  })
  expect(response.ok(), await response.text()).toBe(true)
  const body = (await response.json()) as { room?: { id?: string } }
  expect(body.room?.id).toBe(roomId)

  return roomId
}

const openAuthenticatedRoom = async (
  page: Page,
  {
    roomId,
    userId,
    viewer = 'referee'
  }: {
    roomId: string
    userId: string
    viewer?: 'referee' | 'player' | 'spectator'
  }
): Promise<void> => {
  await page.goto(
    `/?game=${encodeURIComponent(roomId)}&user=${encodeURIComponent(userId)}&viewer=${viewer}`,
    { waitUntil: 'domcontentloaded' }
  )
  await expect(page.locator('#boardCanvas')).toBeVisible()
}

const tinyPngUpload = {
  name: 'private-beta-board.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
    'base64'
  )
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

  test('exports and deletes an owner room with asset and note data', async ({
    browser
  }) => {
    const roomId = uniqueRoomId('private-beta-export')
    const owner = await newSignedInPage(browser, {
      discordId: `${roomId}-owner`,
      username: 'Private Beta Export Owner'
    })
    await createPrivateBetaRoom(owner.page, roomId)
    await openAuthenticatedRoom(owner.page, {
      roomId,
      userId: owner.userId
    })
    const actorSession = await actorSessionFromPage(
      owner.page,
      roomId,
      owner.userId
    )

    await postCommand(owner.page, roomId, owner.userId, actorSession, {
      type: 'CreateGame',
      slug: roomId,
      name: 'Exported Private Beta Room'
    })
    await postCommand(owner.page, roomId, owner.userId, actorSession, {
      type: 'CreateNote',
      noteId: 'note-e2e-private-beta',
      title: 'Private briefing',
      body: 'Owner export should include this note event.',
      visibility: 'REFEREE'
    })

    const uploadResponse = await owner.page.request.post(
      `/api/rooms/${encodeURIComponent(roomId)}/assets`,
      {
        multipart: {
          file: tinyPngUpload,
          kind: 'geomorph',
          gridScale: '1'
        }
      }
    )
    expect(uploadResponse.ok(), await uploadResponse.text()).toBe(true)
    const uploadBody = (await uploadResponse.json()) as {
      asset?: { id?: string; url?: string }
    }
    const assetId = uploadBody.asset?.id
    expect(assetId).toMatch(/^asset_/)

    const exportResponse = await owner.page.request.get(
      `/api/rooms/${encodeURIComponent(roomId)}/export`
    )
    expect(exportResponse.ok(), await exportResponse.text()).toBe(true)
    const exported = (await exportResponse.json()) as {
      room?: { id?: string }
      assets?: Array<{ id?: string }>
      durableRoom?: {
        eventStream?: Array<{ event?: { type?: string; noteId?: string } }>
      }
    }
    expect(exported.room?.id).toBe(roomId)
    expect(exported.assets?.some((asset) => asset.id === assetId)).toBe(true)
    expect(
      exported.durableRoom?.eventStream?.some(
        (entry) =>
          entry.event?.type === 'NoteCreated' &&
          entry.event.noteId === 'note-e2e-private-beta'
      )
    ).toBe(true)

    const deleteResponse = await owner.page.request.delete(
      `/api/rooms/${encodeURIComponent(roomId)}`
    )
    expect(deleteResponse.ok(), await deleteResponse.text()).toBe(true)
    const deleted = (await deleteResponse.json()) as {
      deleted?: boolean
      roomId?: string
    }
    expect(deleted).toMatchObject({ deleted: true, roomId })

    const deletedState = await owner.page.request.get(
      `/rooms/${encodeURIComponent(roomId)}/state`
    )
    expect(deletedState.status()).toBe(404)

    const deletedExport = await owner.page.request.get(
      `/api/rooms/${encodeURIComponent(roomId)}/export`
    )
    expect(deletedExport.status()).toBe(404)

    const deletedAsset = await owner.page.request.get(
      `/api/assets/${encodeURIComponent(assetId ?? '')}`
    )
    expect(deletedAsset.status()).toBe(404)
  })
})
