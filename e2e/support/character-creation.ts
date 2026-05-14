import { expect, type Page } from '@playwright/test'

export type CharacterCreationProjection = {
  creationComplete?: boolean
  pendingCascadeSkills?: string[]
  characteristicChanges?: Array<{
    type: 'PHYSICAL' | 'MENTAL'
    modifier: number
  }>
  actionPlan?: {
    legalActions?: Array<{
      key: string
      commandTypes?: string[]
    }>
  }
  state?: {
    status?: string
  }
  terms?: Array<{
    career: string
    skillsAndTraining?: string[]
  }>
  history?: Array<{
    type?: string
    musteringBenefit?: {
      career: string
      kind: string
      tableRoll: number
      value: string
    }
    termSkill?: {
      career?: string
      table?: string
      tableRoll?: number
      rawSkill?: string
      skill?: string | null
    }
  }>
}

export type RoomStateMessage = {
  type: 'roomState'
  state: {
    characters: Record<
      string,
      {
        age?: number | null
        credits?: number
        equipment?: Array<{ name?: string; quantity?: number; notes?: string }>
        notes?: string
        skills?: string[]
        characteristics?: Record<string, number | null>
        creation?: CharacterCreationProjection
      }
    >
  } | null
}

export type ProjectedCharacter = NonNullable<
  RoomStateMessage['state']
>['characters'][string]

export type ProjectedTermSkill = {
  career: string
  table: string
  tableRoll: number
  skill: string
}

const actorSessionKey = (roomId: string, actorId: string): string =>
  `cepheus.actorSession.${roomId}.${actorId}`

const characteristicKeys = ['str', 'dex', 'end', 'int', 'edu', 'soc'] as const

export const actorIdFromPage = (page: Page): string =>
  new URL(page.url()).searchParams.get('user') ?? 'local-user'

export const actorSessionFromPage = async (
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

export const fetchRoomState = async (
  page: Page,
  roomId: string,
  actorId: string,
  viewer: 'referee' | 'player' | 'spectator' = 'referee'
): Promise<RoomStateMessage> => {
  const response = await page.request.get(
    `/rooms/${encodeURIComponent(roomId)}/state?viewer=${viewer}&user=${encodeURIComponent(actorId)}`
  )
  return (await response.json()) as RoomStateMessage
}

export const fetchProjectedCharacter = async (
  page: Page,
  roomId: string,
  actorId: string,
  characterId: string,
  viewer: 'referee' | 'player' | 'spectator' = 'referee'
): Promise<ProjectedCharacter | null> => {
  const message = await fetchRoomState(page, roomId, actorId, viewer)
  return message.state?.characters[characterId] ?? null
}

export const latestProjectedTermSkill = async (
  page: Page,
  roomId: string,
  actorId: string,
  characterId: string
): Promise<ProjectedTermSkill | null> => {
  const message = await fetchRoomState(page, roomId, actorId)
  const creation = message.state?.characters[characterId]?.creation
  const termSkill = [...(creation?.history ?? [])]
    .reverse()
    .find((event) => event.type === 'ROLL_TERM_SKILL')?.termSkill
  if (
    !termSkill?.career ||
    !termSkill.table ||
    typeof termSkill.tableRoll !== 'number'
  ) {
    return null
  }
  const skill = termSkill.skill ?? termSkill.rawSkill
  if (!skill) return null
  return {
    career: termSkill.career,
    table: termSkill.table,
    tableRoll: termSkill.tableRoll,
    skill
  }
}

export const creationCharacterIds = async (
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

export const waitForDiceReveal = async (page: Page): Promise<void> => {
  await expect(page.locator('#diceOverlay.visible')).toBeVisible({
    timeout: 5_000
  })
  await expect(page.locator('#diceStage .roll-total')).not.toHaveText(
    'Rolling...',
    { timeout: 5_000 }
  )
}

export const normalizedText = async (
  locator: ReturnType<Page['locator']>
): Promise<string> =>
  ((await locator.textContent()) ?? '').replace(/\s+/g, ' ').trim()

export const openOrExpectFollowedCreation = async (
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

export const spectatorCreationProjectionSnapshot = async (
  page: Page,
  roomId: string,
  spectatorId: string,
  characterId: string
): Promise<string> => {
  const character = await fetchProjectedCharacter(
    page,
    roomId,
    spectatorId,
    characterId,
    'spectator'
  )
  return JSON.stringify(character?.creation ?? null)
}

export const expectSpectatorRefreshPreservesCreationProjection = async ({
  spectator,
  roomId,
  spectatorId,
  characterId,
  characterName
}: {
  spectator: Page
  roomId: string
  spectatorId: string
  characterId: string
  characterName: string
}): Promise<string> => {
  const liveProjection = await spectatorCreationProjectionSnapshot(
    spectator,
    roomId,
    spectatorId,
    characterId
  )

  await spectator.reload({ waitUntil: 'domcontentloaded' })
  await expect(spectator.locator('#boardCanvas')).toBeVisible()
  await openOrExpectFollowedCreation(spectator, characterName)
  await expect
    .poll(() =>
      spectatorCreationProjectionSnapshot(
        spectator,
        roomId,
        spectatorId,
        characterId
      )
    )
    .toBe(liveProjection)

  return liveProjection
}

export const rollCareerOutcomeWithSpectatorReveal = async ({
  owner,
  spectator,
  roomId,
  actionName,
  commandType,
  fieldName,
  outcomePattern
}: {
  owner: Page
  spectator: Page
  roomId: string
  actionName: 'Roll commission' | 'Roll advancement'
  commandType:
    | 'ResolveCharacterCreationCommission'
    | 'ResolveCharacterCreationAdvancement'
  fieldName: 'commissionRoll' | 'advancementRoll'
  outcomePattern: RegExp
}): Promise<string | null> => {
  const ownerAction = owner.getByRole('button', { name: actionName })
  if (!(await ownerAction.isVisible().catch(() => false))) return null

  const spectatorFields = spectator.locator('#characterCreationFields')
  const spectatorRoll = spectator.locator(
    `[data-character-creation-field="${fieldName}"]`
  )
  const spectatorOutcome = spectatorFields.locator('.creation-career-outcome')

  await expect(spectatorRoll).toHaveValue('')
  await expect(spectatorOutcome).not.toContainText(outcomePattern, {
    timeout: 100
  })

  const commandAccepted = owner.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().includes(`/rooms/${roomId}/command`) &&
      (response.request().postData() ?? '').includes(commandType)
  )
  await ownerAction.click()
  await expect((await commandAccepted).ok()).toBe(true)

  await expect(spectator.locator('#diceOverlay.visible')).toBeVisible({
    timeout: 5_000
  })
  await expect(spectator.locator('#diceStage .roll-total')).toHaveText(
    'Rolling...',
    { timeout: 100 }
  )
  await expect(spectatorRoll).toHaveValue('', { timeout: 100 })
  await expect(spectatorOutcome).not.toContainText(outcomePattern, {
    timeout: 100
  })

  await waitForDiceReveal(owner)
  await expect(spectator.locator('#diceStage .roll-total')).not.toHaveText(
    'Rolling...',
    { timeout: 5_000 }
  )
  await expect(spectatorRoll).toHaveValue(/\d+/, { timeout: 5_000 })
  await expect(spectatorOutcome).toContainText(outcomePattern, {
    timeout: 5_000
  })

  return normalizedText(spectatorOutcome)
}

export const postCommand = async (
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

export const activeCreationCharacterId = async (
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

export const seedCreationToHomeworld = async (
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

export const seedCreationToCareerSelection = async (
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
