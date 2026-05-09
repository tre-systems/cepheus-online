import { expect, test, type Page } from '@playwright/test'
import { openRoom, openUniqueRoom, setRoomSeed } from './support/app'

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

const characteristicKeys = ['str', 'dex', 'end', 'int', 'edu', 'soc'] as const

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
  const responseText = await response.text()
  expect(response.ok(), responseText).toBe(true)
  expect(JSON.parse(responseText).type, responseText).toBe('commandAccepted')
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

const creationCharacterIds = async (
  page: Page,
  roomId: string,
  actorId: string
): Promise<string[]> => {
  const message = await fetchRoomState(page, roomId, actorId)
  if (message.type !== 'roomState' || !message.state) return []
  return Object.entries(message.state.characters)
    .filter(([, character]) => Boolean(character.creation))
    .map(([characterId]) => characterId)
}

const seedCreationToHomeworld = async (
  page: Page,
  {
    roomId,
    actorId,
    actorSession,
    characterId,
    characteristics = {
      str: 8,
      dex: 7,
      end: 6,
      int: 8,
      edu: 12,
      soc: 7
    }
  }: {
    roomId: string
    actorId: string
    actorSession: string
    characterId: string
    characteristics?: {
      str: number
      dex: number
      end: number
      int: number
      edu: number
      soc: number
    }
  }
): Promise<void> => {
  for (const characteristic of characteristicKeys) {
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'RollCharacterCreationCharacteristic',
      characterId,
      characteristic
    })
  }
  await postCommand(page, roomId, actorId, actorSession, {
    type: 'UpdateCharacterSheet',
    characterId,
    characteristics
  })
}

const seedCreationToCareerSelection = async (
  page: Page,
  {
    roomId,
    actorId,
    actorSession,
    characterId
  }: {
    roomId: string
    actorId: string
    actorSession: string
    characterId: string
  }
): Promise<void> => {
  await seedCreationToHomeworld(page, {
    roomId,
    actorId,
    actorSession,
    characterId
  })
  await postCommand(page, roomId, actorId, actorSession, {
    type: 'SetCharacterCreationHomeworld',
    characterId,
    homeworld: {
      name: null,
      lawLevel: 'No Law',
      tradeCodes: ['Asteroid']
    }
  })
  await postCommand(page, roomId, actorId, actorSession, {
    type: 'ResolveCharacterCreationCascadeSkill',
    characterId,
    cascadeSkill: 'Gun Combat-0',
    selection: 'Slug Rifle'
  })
  for (const skill of ['Admin', 'Advocate', 'Comms']) {
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'SelectCharacterCreationBackgroundSkill',
      characterId,
      skill
    })
  }
  await postCommand(page, roomId, actorId, actorSession, {
    type: 'CompleteCharacterCreationHomeworld',
    characterId
  })
}

const waitForDiceReveal = async (page: Page): Promise<void> => {
  await expect(page.locator('#diceOverlay.visible')).toBeVisible({
    timeout: 5_000
  })
  await expect(page.locator('#diceStage .roll-total')).not.toHaveText(
    'Rolling...',
    { timeout: 5_000 }
  )
}

const resolveVisibleCascadeChoices = async (page: Page): Promise<void> => {
  for (let index = 0; index < 6; index += 1) {
    const choice = page.locator('.creation-cascade-choice').first()
    if ((await choice.count()) === 0 || !(await choice.isVisible())) return
    const option = choice.getByRole('button').first()
    await expect(option).toBeVisible()
    await option.click()
  }
}

const characterCreationCareerButton = (page: Page, career: string) =>
  page
    .locator('#characterCreationFields .creation-career-list button')
    .filter({
      has: page.locator('.creation-career-title').filter({ hasText: career })
    })

const openOrExpectFollowedCreation = async (
  page: Page,
  characterName: string
): Promise<void> => {
  const card = page
    .locator('#creationPresenceDock .creation-presence-card')
    .filter({ hasText: characterName })
  if (await card.isVisible().catch(() => false)) {
    await card.click()
  }
  await expect(
    page.getByRole('complementary', { name: 'Character creator' })
  ).toBeVisible({ timeout: 5_000 })
}

const visibleHorizontalOverflow = async (
  page: Page,
  selector: string
): Promise<string[]> =>
  page.locator(selector).evaluateAll((elements) => {
    const viewportWidth = document.documentElement.clientWidth

    return elements.flatMap((element) => {
      const rect = element.getBoundingClientRect()
      const style = window.getComputedStyle(element)
      const isVisible =
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        Number(style.opacity) !== 0

      if (!isVisible || (rect.left >= -1 && rect.right <= viewportWidth + 1)) {
        return []
      }

      const id = element.id ? `#${element.id}` : ''
      const classes = [...element.classList].map((name) => `.${name}`).join('')
      const label = element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 48)
      return [`${element.tagName.toLowerCase()}${id}${classes} ${label}`]
    })
  })

const expectMobileCreatorControlsFit = async (page: Page): Promise<void> => {
  await expect(
    page.getByRole('complementary', { name: 'Character creator' })
  ).toBeVisible({ timeout: 5_000 })

  await expect
    .poll(() =>
      visibleHorizontalOverflow(
        page,
        [
          '#characterCreatorPanel',
          '#characterCreationFields',
          '#characterCreationFields button',
          '#characterCreationFields select',
          '#characterCreationFields input',
          '#characterCreationFields textarea',
          '#characterCreationFields .creation-stat-card',
          '#characterCreationFields .creation-card',
          '#characterCreationFields .creation-career-choice'
        ].join(',')
      )
    )
    .toEqual([])
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

      await openOrExpectFollowedCreation(spectator, characterName)

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
      await openOrExpectFollowedCreation(spectator, characterName)
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

    await seedCreationToHomeworld(page, {
      roomId,
      actorId,
      actorSession,
      characterId
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

      await openOrExpectFollowedCreation(spectator, characterName)
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

  test('lets another player follow a live career qualification roll without early reveal', async ({
    browser,
    page
  }) => {
    test.setTimeout(60_000)
    const roomId = await openUniqueRoom(page)
    const actorId = actorIdFromPage(page)
    const actorSession = await actorSessionFromPage(page, roomId, actorId)
    const qualificationCommands: unknown[] = []

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
      if (
        message.command?.type === 'ResolveCharacterCreationQualification'
      ) {
        qualificationCommands.push(message.command)
      }
    })

    await page.locator('#createCharacterRailButton').click()
    const characterName =
      (await page.locator('#characterCreatorTitle').textContent()) ?? ''
    const characterId = await activeCreationCharacterId(page, roomId, actorId)

    await seedCreationToCareerSelection(page, {
      roomId,
      actorId,
      actorSession,
      characterId
    })
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'UpdateCharacterSheet',
      characterId,
      characteristics: {
        str: 15,
        dex: 15,
        end: 15,
        int: 15,
        edu: 15,
        soc: 15
      }
    })

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('#boardCanvas')).toBeVisible()
    const ownerCard = page
      .locator('#creationPresenceDock .creation-presence-card')
      .filter({ hasText: characterName })
    await expect(ownerCard).toBeVisible({ timeout: 5_000 })
    await ownerCard.click()

    const ownerCareerButton = characterCreationCareerButton(page, 'Scout')
    await expect(ownerCareerButton).toBeVisible({ timeout: 5_000 })

    const spectator = await browser.newPage()
    try {
      await openRoom(spectator, {
        roomId,
        userId: 'e2e-spectator',
        viewer: 'player'
      })

      await openOrExpectFollowedCreation(spectator, characterName)

      const spectatorFields = spectator.locator('#characterCreationFields')
      const spectatorOutcome = spectator.locator(
        '#characterCreationFields .creation-career-outcome'
      )
      await expect(
        spectator
          .locator('#characterCreationFields .creation-career-list button')
          .filter({ hasText: 'Scout' })
      ).toBeDisabled()
      await expect(
        spectator.locator('[data-character-creation-field="career"]')
      ).toHaveValue('')
      await expect(
        spectator.locator('[data-character-creation-field="qualificationRoll"]')
      ).toHaveValue('')
      await expect(
        spectator.locator(
          '[data-character-creation-field="qualificationPassed"]'
        )
      ).toHaveValue('')

      await ownerCareerButton.evaluate((button) => {
        button.dispatchEvent(
          new PointerEvent('pointerdown', {
            bubbles: true,
            cancelable: true
          })
        )
        button.dispatchEvent(
          new MouseEvent('click', { bubbles: true, cancelable: true })
        )
        button.dispatchEvent(
          new MouseEvent('click', { bubbles: true, cancelable: true })
        )
      })
      await expect.poll(() => qualificationCommands.length).toBe(1)

      await expect(spectator.locator('#diceOverlay.visible')).toBeVisible({
        timeout: 5_000
      })
      await expect(
        spectator.locator('[data-character-creation-field="career"]')
      ).toHaveValue('', { timeout: 100 })
      await expect(
        spectator.locator('[data-character-creation-field="qualificationRoll"]')
      ).toHaveValue('', { timeout: 100 })
      await expect(
        spectator.locator(
          '[data-character-creation-field="qualificationPassed"]'
        )
      ).toHaveValue('', { timeout: 100 })
      await expect(spectatorOutcome).not.toContainText(
        /accepted|rejected|Qualification \d+/i,
        { timeout: 100 }
      )
      await expect(
        spectator.locator('#characterCreationFields .creation-draft-fallback')
      ).toHaveCount(0, { timeout: 100 })

      await expect(spectator.locator('#diceStage .roll-total')).not.toHaveText(
        'Rolling...',
        { timeout: 5_000 }
      )
      await expect(spectatorFields).toContainText(
        /Apply basic training|Qualification failed|Enter the draft|Enter Drifter/,
        { timeout: 15_000 }
      )
    } finally {
      await spectator.close()
    }
  })

  test('shows failed qualification fallback and persists Drifter after refresh', async ({
    page
  }) => {
    test.setTimeout(60_000)
    const roomId = await openUniqueRoom(page)
    await setRoomSeed(page, roomId, 4)
    const actorId = actorIdFromPage(page)
    const actorSession = await actorSessionFromPage(page, roomId, actorId)
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

    await page.locator('#createCharacterRailButton').click()
    const characterName =
      (await page.locator('#characterCreatorTitle').textContent()) ?? ''
    const characterId = await activeCreationCharacterId(page, roomId, actorId)

    await seedCreationToCareerSelection(page, {
      roomId,
      actorId,
      actorSession,
      characterId
    })
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'UpdateCharacterSheet',
      characterId,
      characteristics: {
        str: 2,
        dex: 2,
        end: 2,
        int: 2,
        edu: 2,
        soc: 2
      }
    })

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('#boardCanvas')).toBeVisible()
    await openOrExpectFollowedCreation(page, characterName)

    const fields = page.locator('#characterCreationFields')
    const scoutCareer = characterCreationCareerButton(page, 'Scout')
    await expect(scoutCareer).toBeVisible({ timeout: 5_000 })
    await scoutCareer.click()
    await waitForDiceReveal(page)

    await expect(fields.locator('.creation-draft-fallback')).toBeVisible({
      timeout: 5_000
    })
    await expect(fields).toContainText('Qualification failed')
    await expect(fields).toContainText('Choose Drifter or roll for the Draft.')
    await expect(
      fields.getByRole('button', { name: 'Become a Drifter' })
    ).toBeVisible()
    await expect(
      fields.getByRole('button', { name: 'Roll draft (1d6)' })
    ).toBeVisible()

    await fields.getByRole('button', { name: 'Become a Drifter' }).click()
    await expect.poll(() => postedCommandTypes).toContain(
      'EnterCharacterCreationDrifter'
    )
    await expect(fields).toContainText(/Drifter|Apply basic training/, {
      timeout: 5_000
    })

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('#boardCanvas')).toBeVisible()
    await openOrExpectFollowedCreation(page, characterName)
    await expect(fields).toContainText(/Drifter|Apply basic training/, {
      timeout: 5_000
    })

    const roomState = await fetchRoomState(page, roomId, actorId)
    const creationJson = JSON.stringify(
      roomState.state?.characters[characterId]?.creation ?? null
    )
    expect(creationJson).toContain('Drifter')
  })

  test('rolls failed qualification Draft fallback and persists drafted career after refresh', async ({
    page
  }) => {
    test.setTimeout(60_000)
    const roomId = await openUniqueRoom(page)
    await setRoomSeed(page, roomId, 4)
    const actorId = actorIdFromPage(page)
    const actorSession = await actorSessionFromPage(page, roomId, actorId)
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

    await page.locator('#createCharacterRailButton').click()
    const characterName =
      (await page.locator('#characterCreatorTitle').textContent()) ?? ''
    const characterId = await activeCreationCharacterId(page, roomId, actorId)

    await seedCreationToCareerSelection(page, {
      roomId,
      actorId,
      actorSession,
      characterId
    })
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'UpdateCharacterSheet',
      characterId,
      characteristics: {
        str: 2,
        dex: 2,
        end: 2,
        int: 2,
        edu: 2,
        soc: 2
      }
    })

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('#boardCanvas')).toBeVisible()
    await openOrExpectFollowedCreation(page, characterName)

    const fields = page.locator('#characterCreationFields')
    const scoutCareer = characterCreationCareerButton(page, 'Scout')
    await expect(scoutCareer).toBeVisible({ timeout: 5_000 })
    await scoutCareer.click()
    await waitForDiceReveal(page)

    await expect(fields.locator('.creation-draft-fallback')).toBeVisible({
      timeout: 5_000
    })
    await expect(fields).toContainText('Qualification failed')
    await expect(fields).toContainText('Choose Drifter or roll for the Draft.')

    const draftButton = fields.getByRole('button', {
      name: 'Roll draft (1d6)'
    })
    await expect(draftButton).toBeVisible()
    postedCommandTypes.length = 0
    await draftButton.click()

    await expect.poll(() => postedCommandTypes).toContain(
      'ResolveCharacterCreationDraft'
    )
    await waitForDiceReveal(page)
    await expect(fields.locator('.creation-draft-fallback')).toHaveCount(0, {
      timeout: 5_000
    })

    const draftCareers = [
      'Aerospace',
      'Marine',
      'Maritime Defense',
      'Navy',
      'Scout',
      'Surface Defense'
    ]
    const roomState = await fetchRoomState(page, roomId, actorId)
    const creation =
      (roomState.state?.characters[characterId]?.creation as
        | {
            canEnterDraft?: boolean
            terms?: Array<{ career?: string; draft?: 1 }>
          }
        | undefined) ?? null
    expect(creation?.canEnterDraft).toBe(false)
    const draftedTerm = creation?.terms?.find((term) => term.draft === 1)
    const draftedCareer = draftedTerm?.career
    expect(draftedCareer).toBeTruthy()
    expect(draftCareers).toContain(draftedCareer)
    if (!draftedCareer) throw new Error('Drafted career was not persisted')

    await expect(fields).toContainText(draftedCareer, { timeout: 5_000 })

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('#boardCanvas')).toBeVisible()
    await openOrExpectFollowedCreation(page, characterName)
    await expect(fields).toContainText(draftedCareer, { timeout: 5_000 })
    await expect(fields.locator('.creation-draft-fallback')).toHaveCount(0)
  })

  test('keeps owner career roll results hidden until reveal and leaves the next action usable', async ({
    page
  }) => {
    test.setTimeout(60_000)
    const roomId = await openUniqueRoom(page)
    const actorId = actorIdFromPage(page)
    const actorSession = await actorSessionFromPage(page, roomId, actorId)
    const survivalCommands: unknown[] = []

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
      if (message.command?.type === 'ResolveCharacterCreationSurvival') {
        survivalCommands.push(message.command)
      }
    })

    await page.locator('#createCharacterRailButton').click()
    const characterName =
      (await page.locator('#characterCreatorTitle').textContent()) ?? ''
    const characterId = await activeCreationCharacterId(page, roomId, actorId)

    await seedCreationToCareerSelection(page, {
      roomId,
      actorId,
      actorSession,
      characterId
    })
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'UpdateCharacterSheet',
      characterId,
      characteristics: {
        str: 15,
        dex: 15,
        end: 15,
        int: 15,
        edu: 15,
        soc: 15
      }
    })
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'ResolveCharacterCreationQualification',
      characterId,
      career: 'Scout'
    })
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'CompleteCharacterCreationBasicTraining',
      characterId
    })

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('#boardCanvas')).toBeVisible()
    const ownerCard = page
      .locator('#creationPresenceDock .creation-presence-card')
      .filter({ hasText: characterName })
    await expect(ownerCard).toBeVisible({ timeout: 5_000 })
    await ownerCard.click()

    const fields = page.locator('#characterCreationFields')
    const survivalRoll = page.locator(
      '[data-character-creation-field="survivalRoll"]'
    )
    const outcome = fields.locator('.creation-career-outcome')
    const rollSurvival = page.getByRole('button', { name: 'Roll survival' })

    await expect(rollSurvival).toBeVisible({ timeout: 5_000 })
    await expect(survivalRoll).toHaveValue('')
    await expect(outcome).not.toContainText(/Survival \d+|survived|failed/i)

    await rollSurvival.evaluate((button) => {
      button.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      )
      button.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      )
    })

    await expect.poll(() => survivalCommands.length).toBe(1)
    await expect(page.locator('#diceOverlay.visible')).toBeVisible({
      timeout: 5_000
    })
    await expect(page.locator('#diceStage .roll-total')).toHaveText(
      'Rolling...',
      { timeout: 100 }
    )
    await expect(survivalRoll).toHaveValue('', { timeout: 100 })
    await expect(outcome).not.toContainText(/Survival \d+|survived|failed/i, {
      timeout: 100
    })

    await expect(page.locator('#diceStage .roll-total')).not.toHaveText(
      'Rolling...',
      { timeout: 5_000 }
    )
    await expect(fields).toContainText(
      /Killed in service|Skills and training|Roll commission|Roll advancement/,
      { timeout: 5_000 }
    )
    await expect(rollSurvival).toHaveCount(0)
  })

  test('shows the killed-in-service branch and starts a fresh draft', async ({
    page
  }) => {
    test.setTimeout(60_000)
    const roomId = await openUniqueRoom(page)
    await setRoomSeed(page, roomId, 4)
    const actorId = actorIdFromPage(page)
    const actorSession = await actorSessionFromPage(page, roomId, actorId)

    await page.locator('#createCharacterRailButton').click()
    const originalCharacterName =
      (await page.locator('#characterCreatorTitle').textContent()) ?? ''
    const characterId = await activeCreationCharacterId(page, roomId, actorId)

    await seedCreationToCareerSelection(page, {
      roomId,
      actorId,
      actorSession,
      characterId
    })
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'UpdateCharacterSheet',
      characterId,
      characteristics: {
        str: 15,
        dex: 15,
        end: 15,
        int: 15,
        edu: 15,
        soc: 15
      }
    })
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'ResolveCharacterCreationQualification',
      characterId,
      career: 'Hunter'
    })
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'CompleteCharacterCreationBasicTraining',
      characterId
    })
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'UpdateCharacterSheet',
      characterId,
      characteristics: {
        str: 2,
        dex: 2,
        end: 2,
        int: 2,
        edu: 2,
        soc: 2
      }
    })

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('#boardCanvas')).toBeVisible()
    await openOrExpectFollowedCreation(page, originalCharacterName)

    const fields = page.locator('#characterCreationFields')
    const deathCard = fields.locator('.creation-death-card')
    const rollSurvival = page.getByRole('button', { name: 'Roll survival' })

    await expect(rollSurvival).toBeVisible({ timeout: 5_000 })
    await expect(deathCard).toHaveCount(0)
    await expect(fields).not.toContainText('Killed in service', {
      timeout: 100
    })

    await rollSurvival.click()
    await expect(page.locator('#diceOverlay.visible')).toBeVisible({
      timeout: 5_000
    })
    await expect(page.locator('#diceStage .roll-total')).toHaveText(
      'Rolling...',
      { timeout: 100 }
    )
    await expect(deathCard).toHaveCount(0, { timeout: 100 })

    await waitForDiceReveal(page)
    await expect(deathCard).toBeVisible({ timeout: 5_000 })
    await expect(deathCard).toContainText('Hunter')
    await expect(deathCard).toContainText('Killed in service')
    await expect(deathCard).toContainText('Survival roll')
    await expect(fields).not.toContainText('Muster out')
    await expect(rollSurvival).toHaveCount(0)

    const restartAccepted = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().includes(`/rooms/${roomId}/command`) &&
        (response.request().postData() ?? '').includes('CreateCharacter')
    )
    await page.getByRole('button', { name: 'Start a new character' }).click()
    await expect((await restartAccepted).ok()).toBe(true)

    let restartedCreationIds: string[] = []
    await expect
      .poll(async () => {
        restartedCreationIds = await creationCharacterIds(
          page,
          roomId,
          actorId
        )
        return restartedCreationIds.length
      })
      .toBe(2)
    expect(restartedCreationIds).toContain(characterId)
    expect(restartedCreationIds.some((id) => id !== characterId)).toBe(true)

    await expect(deathCard).toHaveCount(0, { timeout: 5_000 })
    await expect(fields).toContainText('Characteristics', { timeout: 5_000 })
    await expect(
      fields.getByRole('button', { name: 'Roll Str' })
    ).toBeVisible()
  })

  test('lets a spectator follow survival death without early reveal and recover after refresh', async ({
    browser,
    page
  }) => {
    test.setTimeout(60_000)
    const roomId = await openUniqueRoom(page)
    await setRoomSeed(page, roomId, 4)
    const actorId = actorIdFromPage(page)
    const actorSession = await actorSessionFromPage(page, roomId, actorId)

    await page.locator('#createCharacterRailButton').click()
    const characterName =
      (await page.locator('#characterCreatorTitle').textContent()) ?? ''
    const characterId = await activeCreationCharacterId(page, roomId, actorId)

    await seedCreationToCareerSelection(page, {
      roomId,
      actorId,
      actorSession,
      characterId
    })
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'UpdateCharacterSheet',
      characterId,
      characteristics: {
        str: 15,
        dex: 15,
        end: 15,
        int: 15,
        edu: 15,
        soc: 15
      }
    })
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'ResolveCharacterCreationQualification',
      characterId,
      career: 'Hunter'
    })
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'CompleteCharacterCreationBasicTraining',
      characterId
    })
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'UpdateCharacterSheet',
      characterId,
      characteristics: {
        str: 2,
        dex: 2,
        end: 2,
        int: 2,
        edu: 2,
        soc: 2
      }
    })

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('#boardCanvas')).toBeVisible()
    await openOrExpectFollowedCreation(page, characterName)

    const spectator = await browser.newPage()
    try {
      await openRoom(spectator, {
        roomId,
        userId: 'e2e-spectator',
        viewer: 'spectator'
      })
      await openOrExpectFollowedCreation(spectator, characterName)

      const ownerRollSurvival = page.getByRole('button', {
        name: 'Roll survival'
      })
      const spectatorFields = spectator.locator('#characterCreationFields')
      const spectatorDeathCard = spectatorFields.locator(
        '.creation-death-card'
      )
      const spectatorSurvivalRoll = spectator.locator(
        '[data-character-creation-field="survivalRoll"]'
      )

      await expect(ownerRollSurvival).toBeVisible({ timeout: 5_000 })
      await expect(spectatorSurvivalRoll).toHaveValue('')
      await expect(spectatorDeathCard).toHaveCount(0)
      await expect(spectatorFields).not.toContainText(
        /Survival \d+|Killed in service|dead/i,
        { timeout: 100 }
      )

      const survivalAccepted = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().includes(`/rooms/${roomId}/command`) &&
          (response.request().postData() ?? '').includes(
            'ResolveCharacterCreationSurvival'
          )
      )
      await ownerRollSurvival.click()
      await expect((await survivalAccepted).ok()).toBe(true)

      await expect(spectator.locator('#diceOverlay.visible')).toBeVisible({
        timeout: 5_000
      })
      await expect(spectator.locator('#diceStage .roll-total')).toHaveText(
        'Rolling...',
        { timeout: 100 }
      )
      await expect(spectatorSurvivalRoll).toHaveValue('', { timeout: 100 })
      await expect(spectatorDeathCard).toHaveCount(0, { timeout: 100 })
      await expect(spectatorFields).not.toContainText(
        /Survival \d+|Killed in service|dead/i,
        { timeout: 100 }
      )

      await expect(spectator.locator('#diceStage .roll-total')).not.toHaveText(
        'Rolling...',
        { timeout: 5_000 }
      )
      await expect(spectatorDeathCard).toBeVisible({ timeout: 5_000 })
      await expect(spectatorDeathCard).toContainText('Hunter')
      await expect(spectatorDeathCard).toContainText('Killed in service')
      await expect(spectatorDeathCard).toContainText('Survival roll')
      await expect(spectatorFields).not.toContainText('Muster out')

      const projectedDeathText =
        (await spectatorDeathCard.textContent())?.replace(/\s+/g, ' ').trim() ??
        ''

      await spectator.reload({ waitUntil: 'domcontentloaded' })
      await expect(spectator.locator('#boardCanvas')).toBeVisible()
      await openOrExpectFollowedCreation(spectator, characterName)
      await expect(spectatorDeathCard).toBeVisible({ timeout: 5_000 })
      await expect(spectatorDeathCard).toContainText('Hunter')
      await expect(spectatorDeathCard).toContainText('Killed in service')
      await expect(spectatorDeathCard).toContainText('Survival roll')
      await expect(spectatorFields).not.toContainText('Muster out')
      await expect
        .poll(async () =>
          ((await spectatorDeathCard.textContent()) ?? '')
            .replace(/\s+/g, ' ')
            .trim()
        )
        .toBe(projectedDeathText)
    } finally {
      await spectator.close()
    }
  })

  test('drives a seeded multi-career path with spectator follow through mustering', async ({
    browser,
    page
  }) => {
    test.setTimeout(60_000)
    const roomId = await openUniqueRoom(page)
    await setRoomSeed(page, roomId, 13_579)
    const actorId = actorIdFromPage(page)
    const actorSession = await actorSessionFromPage(page, roomId, actorId)
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

    await page.locator('#createCharacterRailButton').click()
    const characterName =
      (await page.locator('#characterCreatorTitle').textContent()) ?? ''
    const characterId = await activeCreationCharacterId(page, roomId, actorId)

    await seedCreationToCareerSelection(page, {
      roomId,
      actorId,
      actorSession,
      characterId
    })
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'UpdateCharacterSheet',
      characterId,
      characteristics: {
        str: 15,
        dex: 15,
        end: 15,
        int: 15,
        edu: 15,
        soc: 15
      }
    })
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'ResolveCharacterCreationQualification',
      characterId,
      career: 'Merchant'
    })

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('#boardCanvas')).toBeVisible()
    await page
      .locator('#creationPresenceDock .creation-presence-card')
      .filter({ hasText: characterName })
      .click()

    await resolveVisibleCascadeChoices(page)
    const applyBasicTraining = page.getByRole('button', {
      name: 'Apply basic training'
    })
    await expect(applyBasicTraining).toBeVisible({ timeout: 5_000 })
    await applyBasicTraining.click()

    const rollSurvival = page.getByRole('button', { name: 'Roll survival' })
    await expect(rollSurvival).toBeVisible({ timeout: 5_000 })
    await rollSurvival.click()
    await waitForDiceReveal(page)
    for (const actionName of ['Roll commission', 'Roll advancement']) {
      const action = page.getByRole('button', { name: actionName })
      if (await action.isVisible().catch(() => false)) {
        await action.click()
        await waitForDiceReveal(page)
      }
    }
    await expect(page.locator('#characterCreationFields')).toContainText(
      /Skills and training|Personal development|Specialist skills/,
      { timeout: 5_000 }
    )

    for (let roll = 0; roll < 4; roll += 1) {
      const termSkillTable = page
        .locator('#characterCreationFields button:not([disabled])')
        .filter({
          hasText:
            /Personal development|Service skills|Specialist skills|Advanced education/
        })
        .first()
      if (!(await termSkillTable.isVisible().catch(() => false))) break
      await termSkillTable.click()
      await waitForDiceReveal(page)
      await resolveVisibleCascadeChoices(page)
    }

    const spectator = await browser.newPage()
    try {
      await openRoom(spectator, {
        roomId,
        userId: 'e2e-spectator',
        viewer: 'player'
      })
      await openOrExpectFollowedCreation(spectator, characterName)

      const spectatorFields = spectator.locator('#characterCreationFields')
      await expect(spectatorFields).toContainText('Anagathics', {
        timeout: 5_000
      })
      await expect(spectatorFields).not.toContainText(/Aging \d+:/, {
        timeout: 100
      })

      await postCommand(page, roomId, actorId, actorSession, {
        type: 'DecideCharacterCreationAnagathics',
        characterId,
        useAnagathics: false
      })
      await page.reload({ waitUntil: 'domcontentloaded' })
      await expect(page.locator('#boardCanvas')).toBeVisible()
      await page
        .locator('#creationPresenceDock .creation-presence-card')
        .filter({ hasText: characterName })
        .click()
      await spectator.reload({ waitUntil: 'domcontentloaded' })
      await openOrExpectFollowedCreation(spectator, characterName)

      await expect(page.locator('#characterCreationFields')).toContainText(
        /Roll aging|Roll reenlistment/,
        { timeout: 15_000 }
      )
      await expect(spectatorFields).toContainText(
        /Roll aging|Roll reenlistment/,
        { timeout: 15_000 }
      )

      const rollAging = page.getByRole('button', { name: 'Roll aging' })
      if (await rollAging.isVisible().catch(() => false)) {
        const agingAccepted = page.waitForResponse(
          (response) =>
            response.request().method() === 'POST' &&
            response.url().includes(`/rooms/${roomId}/command`) &&
            (response.request().postData() ?? '').includes(
              'ResolveCharacterCreationAging'
            )
        )
        await rollAging.click()
        await expect((await agingAccepted).ok()).toBe(true)

        await expect(spectator.locator('#diceOverlay.visible')).toBeVisible({
          timeout: 5_000
        })
        await expect(spectator.locator('#diceStage .roll-total')).toHaveText(
          'Rolling...',
          { timeout: 100 }
        )
        await expect(spectatorFields).not.toContainText(/Aging \d+:/, {
          timeout: 100
        })

        await waitForDiceReveal(page)
        await expect(spectator.locator('#diceStage .roll-total')).not.toHaveText(
          'Rolling...',
          { timeout: 5_000 }
        )
        await expect(spectatorFields).toContainText(/Aging \d+:/, {
          timeout: 5_000
        })
        await expect(rollAging).toHaveCount(0, { timeout: 5_000 })
        for (let index = 0; index < 4; index += 1) {
          const agingChoice = page
            .locator('.creation-term-actions button')
            .first()
          if (
            (await agingChoice.count()) === 0 ||
            !(await agingChoice.isVisible())
          ) {
            break
          }
          await agingChoice.click()
        }
      }
      let rollReenlistment = page.getByRole('button', {
        name: 'Roll reenlistment'
      })
      if ((await rollReenlistment.count()) === 0) {
        await page.reload({ waitUntil: 'domcontentloaded' })
        await expect(page.locator('#boardCanvas')).toBeVisible()
        await page
          .locator('#creationPresenceDock .creation-presence-card')
          .filter({ hasText: characterName })
          .click()
        await openOrExpectFollowedCreation(spectator, characterName)
        rollReenlistment = page.getByRole('button', {
          name: 'Roll reenlistment'
        })
      }
      await expect(rollReenlistment).toBeVisible({ timeout: 15_000 })
      await expect(spectatorFields).not.toContainText(/Reenlistment \d+:/, {
        timeout: 100
      })

      const reenlistmentAccepted = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().includes(`/rooms/${roomId}/command`) &&
          (response.request().postData() ?? '').includes(
            'ResolveCharacterCreationReenlistment'
          )
      )
      await rollReenlistment.click()
      await expect((await reenlistmentAccepted).ok()).toBe(true)

      await expect(spectator.locator('#diceOverlay.visible')).toBeVisible({
        timeout: 5_000
      })
      await expect(spectator.locator('#diceStage .roll-total')).toHaveText(
        'Rolling...',
        { timeout: 100 }
      )
      await expect(spectatorFields).not.toContainText(/Reenlistment \d+:/, {
        timeout: 100
      })

      await waitForDiceReveal(page)
      await expect(spectator.locator('#diceStage .roll-total')).not.toHaveText(
        'Rolling...',
        { timeout: 5_000 }
      )
      await expect(spectatorFields).toContainText(/Reenlistment \d+:/, {
        timeout: 5_000
      })
    } finally {
      await spectator.close()
    }

    const musterOut = page.getByRole('button', { name: 'Muster out' })
    await expect(musterOut).toBeVisible({ timeout: 5_000 })
    await musterOut.click()

    await expect(page.locator('#characterCreationFields')).toContainText(
      /Skills|Review the skill list/,
      { timeout: 5_000 }
    )

    await page.getByRole('button', { name: 'Continue to equipment' }).click()
    await expect(page.locator('#characterCreationFields')).toContainText(
      /Equipment|Add starting equipment/,
      { timeout: 5_000 }
    )
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'RollCharacterCreationMusteringBenefit',
      characterId,
      career: 'Merchant',
      kind: 'cash'
    })
    postedCommandTypes.push('RollCharacterCreationMusteringBenefit')
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'ContinueCharacterCreationAfterMustering',
      characterId
    })
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'StartCharacterCareerTerm',
      characterId,
      career: 'Scout',
      drafted: false
    })
    postedCommandTypes.push('StartCharacterCareerTerm')

    const roomState = await fetchRoomState(page, roomId, actorId)
    const creationJson = JSON.stringify(
      roomState.state?.characters[characterId]?.creation ?? null
    )
    expect(creationJson).toContain('Merchant')
    expect(creationJson).toContain('Scout')

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('#boardCanvas')).toBeVisible()
    await page
      .locator('#creationPresenceDock .creation-presence-card')
      .filter({ hasText: characterName })
      .click()

    const secondCareerSpectator = await browser.newPage()
    try {
      await openRoom(secondCareerSpectator, {
        roomId,
        userId: 'e2e-second-spectator',
        viewer: 'player'
      })
      await openOrExpectFollowedCreation(secondCareerSpectator, characterName)
      await expect(
        secondCareerSpectator.locator('#characterCreationFields')
      ).toContainText(/Scout|Apply basic training/, { timeout: 5_000 })
    } finally {
      await secondCareerSpectator.close()
    }

    await expect.poll(() => postedCommandTypes).toContain(
      'CompleteCharacterCreationBasicTraining'
    )
    await expect.poll(() => postedCommandTypes).toContain(
      'ResolveCharacterCreationSurvival'
    )
    await expect.poll(() => postedCommandTypes).toContain(
      'RollCharacterCreationTermSkill'
    )
    await expect.poll(() => postedCommandTypes).toContain(
      'ResolveCharacterCreationReenlistment'
    )
    await expect.poll(() => postedCommandTypes).toContain(
      'RollCharacterCreationMusteringBenefit'
    )
  })

  test('keeps early character creation screens usable at phone width', async ({
    page
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const roomId = await openUniqueRoom(page)
    const actorId = actorIdFromPage(page)
    const actorSession = await actorSessionFromPage(page, roomId, actorId)

    await page.locator('#createCharacterRailButton').click()
    const characterName =
      (await page.locator('#characterCreatorTitle').textContent()) ?? ''
    const characterId = await activeCreationCharacterId(page, roomId, actorId)

    await expect(page.locator('#characterCreationFields')).toContainText(
      'Characteristics',
      { timeout: 5_000 }
    )
    await expectMobileCreatorControlsFit(page)

    await seedCreationToHomeworld(page, {
      roomId,
      actorId,
      actorSession,
      characterId
    })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('#boardCanvas')).toBeVisible()
    await openOrExpectFollowedCreation(page, characterName)
    await expect(page.locator('#characterCreationFields')).toContainText(
      'Homeworld',
      { timeout: 5_000 }
    )
    await expectMobileCreatorControlsFit(page)

    await postCommand(page, roomId, actorId, actorSession, {
      type: 'SetCharacterCreationHomeworld',
      characterId,
      homeworld: {
        name: null,
        lawLevel: 'No Law',
        tradeCodes: ['Asteroid']
      }
    })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('#boardCanvas')).toBeVisible()
    await openOrExpectFollowedCreation(page, characterName)
    await expect(page.locator('#characterCreationFields')).toContainText(
      'Background skills',
      { timeout: 5_000 }
    )
    await expectMobileCreatorControlsFit(page)

    await postCommand(page, roomId, actorId, actorSession, {
      type: 'ResolveCharacterCreationCascadeSkill',
      characterId,
      cascadeSkill: 'Gun Combat-0',
      selection: 'Slug Rifle'
    })
    for (const skill of ['Admin', 'Advocate', 'Comms']) {
      await postCommand(page, roomId, actorId, actorSession, {
        type: 'SelectCharacterCreationBackgroundSkill',
        characterId,
        skill
      })
    }
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'CompleteCharacterCreationHomeworld',
      characterId
    })

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('#boardCanvas')).toBeVisible()
    await openOrExpectFollowedCreation(page, characterName)
    await expect(page.locator('#characterCreationFields')).toContainText(
      'Career',
      { timeout: 5_000 }
    )
    await expectMobileCreatorControlsFit(page)
  })
})
