import { expect, test, type Page } from '@playwright/test'
import { openRoom, openUniqueRoom } from './support/app'

type RoomStateMessage = {
  type: 'roomState'
  state: {
    characters: Record<
      string,
      {
        creation?: unknown
      }
    >
  } | null
}

const actorSessionKey = (roomId: string, actorId: string): string =>
  `cepheus.actorSession.${roomId}.${actorId}`

const actorIdFromPage = (page: Page): string =>
  new URL(page.url()).searchParams.get('user') ?? 'local-user'

const actorSessionFromPage = async (
  page: Page,
  roomId: string,
  actorId: string
): Promise<string> => {
  const session = await page.evaluate(
    ({ key }) => localStorage.getItem(key),
    { key: actorSessionKey(roomId, actorId) }
  )
  if (!session) throw new Error(`Missing actor session for ${actorId}`)
  return session
}

const fetchRoomState = async (
  page: Page,
  roomId: string,
  actorId: string
): Promise<RoomStateMessage> => {
  const response = await page.request.get(
    `/rooms/${encodeURIComponent(roomId)}/state?viewer=referee&user=${encodeURIComponent(actorId)}`
  )
  return (await response.json()) as RoomStateMessage
}

const postCommand = async (
  page: Page,
  roomId: string,
  actorId: string,
  actorSession: string,
  command: Record<string, unknown>
): Promise<void> => {
  const response = await page.request.post(
    `/rooms/${encodeURIComponent(roomId)}/command`,
    {
      headers: {
        'content-type': 'application/json',
        'x-cepheus-actor-session': actorSession
      },
      data: {
        type: 'command',
        requestId: `e2e-${String(command.type)}-${Date.now()}`,
        command: {
          gameId: roomId,
          actorId,
          ...command
        }
      }
    }
  )
  expect(response.ok()).toBe(true)
}

const activeCreationCharacterId = async (
  page: Page,
  roomId: string,
  actorId: string
): Promise<string> => {
  let characterId: string | null = null
  await expect
    .poll(async () => {
      const message = await fetchRoomState(page, roomId, actorId)
      if (message.type !== 'roomState' || !message.state) return null
      characterId =
        Object.entries(message.state.characters).find(([, character]) =>
          Boolean(character.creation)
        )?.[0] ?? null
      return characterId
    })
    .not.toBeNull()
  if (!characterId) throw new Error('Active creation character was not found')
  return characterId
}

test.describe('character creation smoke', () => {
  test('opens the creator and rolls the first characteristic through shared dice', async ({
    page
  }) => {
    const roomId = await openUniqueRoom(page)
    const characteristicRollCommands: unknown[] = []

    page.on('request', (request) => {
      if (
        request.method() !== 'POST' ||
        !request.url().includes(`/rooms/${roomId}/command`)
      ) {
        return
      }

      const body = request.postData()
      if (!body) return
      const message = JSON.parse(body) as {
        command?: { type?: string; characteristic?: string }
      }
      if (message.command?.type === 'RollCharacterCreationCharacteristic') {
        characteristicRollCommands.push(message.command)
      }
    })

    await page.locator('#createCharacterRailButton').click()

    await expect(
      page.getByRole('complementary', { name: 'Character creator' })
    ).toBeVisible()
    await expect(page.locator('#characterCreatorTitle')).toBeVisible()
    await expect(page.locator('#creatorBody')).toBeVisible()
    const characterName =
      (await page.locator('#characterCreatorTitle').textContent()) ?? ''

    const strValue = page
      .locator('#characterCreationFields .creation-stat-cell')
      .filter({
        hasText: 'Str'
      })
      .locator('strong')
    const characteristicRollButtons = page
      .locator('#characterCreationFields')
      .getByRole('button', { name: /^Roll (Str|Dex|End|Int|Edu|Soc)$/ })

    await expect(characteristicRollButtons).toHaveCount(6)
    await expect(page.getByRole('button', { name: 'Roll Str' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Roll Dex' })).toBeVisible()

    await page.getByRole('button', { name: 'Roll Str' }).click()

    await expect(page.locator('#diceOverlay.visible')).toBeVisible()
    await expect(strValue).toHaveCount(0)
    await expect(page.locator('#diceStage .roll-total')).not.toHaveText(
      'Rolling...',
      { timeout: 5_000 }
    )
    await expect(strValue).toHaveText(/\d+/, { timeout: 5_000 })
    const rolledStr = (await strValue.textContent()) ?? ''
    expect(rolledStr).toMatch(/\d+/)
    expect(characteristicRollCommands).toHaveLength(1)
    const rollDexButton = page.getByRole('button', { name: 'Roll Dex' })
    await expect(characteristicRollButtons).toHaveCount(5)
    await expect(page.getByRole('button', { name: 'Roll Str' })).toHaveCount(0)
    await expect(rollDexButton).toBeVisible()

    await rollDexButton.evaluate((button) => {
      button.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      )
      button.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      )
    })
    await expect(page.locator('#diceOverlay.visible')).toBeVisible()
    expect(
      characteristicRollCommands.filter((command) => {
        return (
          typeof command === 'object' &&
          command !== null &&
          'characteristic' in command &&
          command.characteristic === 'dex'
        )
      })
    ).toHaveLength(1)

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('#boardCanvas')).toBeVisible()
    await expect(page.locator('#connectionStatus')).toBeVisible()

    await page
      .locator('#creationPresenceDock .creation-presence-card')
      .filter({ hasText: characterName })
      .click()

    await expect(
      page.getByRole('complementary', { name: 'Character creator' })
    ).toBeVisible()
    await expect(strValue).toHaveText(rolledStr, { timeout: 5_000 })
  })

  test('lets another player follow a live characteristic roll without early reveal', async ({
    browser,
    page
  }) => {
    const roomId = await openUniqueRoom(page)
    await page.locator('#createCharacterRailButton').click()

    const characterName =
      (await page.locator('#characterCreatorTitle').textContent()) ?? ''

    const spectator = await browser.newPage()
    try {
      await openRoom(spectator, {
        roomId,
        userId: 'e2e-spectator',
        viewer: 'player'
      })

      const card = spectator
        .locator('#creationPresenceDock .creation-presence-card')
        .filter({ hasText: characterName })
      await expect(card).toBeVisible({ timeout: 5_000 })
      await card.click()

      const ownerStrValue = page
        .locator('#characterCreationFields .creation-stat-cell')
        .filter({ hasText: 'Str' })
        .locator('strong')
      const spectatorStrValue = spectator
        .locator('#characterCreationFields .creation-stat-cell')
        .filter({ hasText: 'Str' })
        .locator('strong')

      await page.getByRole('button', { name: 'Roll Str' }).click()

      await expect(spectator.locator('#diceOverlay.visible')).toBeVisible({
        timeout: 5_000
      })
      await expect(spectatorStrValue).toHaveCount(0)
      await expect(spectator.locator('#diceStage .roll-total')).not.toHaveText(
        'Rolling...',
        { timeout: 5_000 }
      )

      await expect(ownerStrValue).toHaveText(/\d+/, { timeout: 5_000 })
      const rolledStr = (await ownerStrValue.textContent()) ?? ''
      await expect(spectatorStrValue).toHaveText(rolledStr, { timeout: 5_000 })

      await spectator.reload({ waitUntil: 'domcontentloaded' })
      const reloadedCard = spectator
        .locator('#creationPresenceDock .creation-presence-card')
        .filter({ hasText: characterName })
      await expect(reloadedCard).toBeVisible()
      await reloadedCard.click()
      await expect(spectatorStrValue).toHaveText(rolledStr, { timeout: 5_000 })
    } finally {
      await spectator.close()
    }
  })

  test('lets another player follow homeworld and background selections live', async ({
    browser,
    page
  }) => {
    test.setTimeout(60_000)
    const roomId = await openUniqueRoom(page)
    const actorId = actorIdFromPage(page)
    const actorSession = await actorSessionFromPage(page, roomId, actorId)

    await page.locator('#createCharacterRailButton').click()
    const characterName =
      (await page.locator('#characterCreatorTitle').textContent()) ?? ''
    const characterId = await activeCreationCharacterId(page, roomId, actorId)

    await postCommand(page, roomId, actorId, actorSession, {
      type: 'UpdateCharacterSheet',
      characterId,
      characteristics: {
        str: 8,
        dex: 7,
        end: 6,
        int: 8,
        edu: 12,
        soc: 7
      }
    })
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'AdvanceCharacterCreation',
      characterId,
      creationEvent: { type: 'SET_CHARACTERISTICS' }
    })

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('#boardCanvas')).toBeVisible()
    const ownerCard = page
      .locator('#creationPresenceDock .creation-presence-card')
      .filter({ hasText: characterName })
    await expect(ownerCard).toBeVisible({ timeout: 5_000 })
    await ownerCard.click()
    await expect(
      page.locator('[data-character-creation-field="homeworld.lawLevel"]')
    ).toBeVisible({ timeout: 5_000 })

    const spectator = await browser.newPage()
    const postedCommandTypes: string[] = []
    page.on('request', (request) => {
      if (
        request.method() !== 'POST' ||
        !request.url().includes(`/rooms/${roomId}/command`)
      ) {
        return
      }
      const body = request.postData()
      if (!body) return
      const message = JSON.parse(body) as {
        command?: { type?: string }
      }
      if (message.command?.type) postedCommandTypes.push(message.command.type)
    })

    try {
      await openRoom(spectator, {
        roomId,
        userId: 'e2e-spectator',
        viewer: 'player'
      })

      const card = spectator
        .locator('#creationPresenceDock .creation-presence-card')
        .filter({ hasText: characterName })
      await expect(card).toBeVisible({ timeout: 5_000 })
      await card.click()
      await expect(
        spectator.locator(
          '[data-character-creation-field="homeworld.lawLevel"]'
        )
      ).toBeDisabled()

      await page
        .locator('[data-character-creation-field="homeworld.lawLevel"]')
        .selectOption({ label: 'No Law' })
      await page
        .locator('[data-character-creation-field="homeworld.tradeCodes"]')
        .selectOption({ label: 'Asteroid' })

      await expect(
        spectator.locator(
          '[data-character-creation-field="homeworld.lawLevel"]'
        )
      ).toHaveValue('No Law', { timeout: 5_000 })
      await expect(
        spectator.locator(
          '[data-character-creation-field="homeworld.tradeCodes"]'
        )
      ).toHaveValue('Asteroid', { timeout: 5_000 })

      await page
        .locator('.creation-cascade-choice')
        .getByRole('button', { name: 'Slug Rifle' })
        .click()
      await expect.poll(() => postedCommandTypes).toContain(
        'ResolveCharacterCreationCascadeSkill'
      )

      await page.getByRole('button', { name: 'Admin' }).click()
      await expect(
        spectator
          .locator('.creation-background-options button.selected')
          .filter({ hasText: 'Admin' })
      ).toBeVisible({ timeout: 5_000 })
      await expect(spectator.locator('#characterCreationFields')).toContainText(
        '3/5 selected',
        { timeout: 5_000 }
      )

      await expect.poll(() => postedCommandTypes).toContain(
        'SetCharacterCreationHomeworld'
      )
      await expect.poll(() => postedCommandTypes).toContain(
        'ResolveCharacterCreationCascadeSkill'
      )
      await expect.poll(() => postedCommandTypes).toContain(
        'SelectCharacterCreationBackgroundSkill'
      )
    } finally {
      await spectator.close()
    }
  })
})
