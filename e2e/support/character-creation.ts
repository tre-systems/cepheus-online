import { expect, type Page } from '@playwright/test'
import type { CareerCreationTermSkillTable } from '../../src/shared/characterCreation'
import { setSeedForNextRoll } from './app'

export type CharacterCreationProjection = {
  creationComplete?: boolean
  pendingCascadeSkills?: string[]
  characteristicChanges?: Array<{
    type: 'PHYSICAL' | 'MENTAL'
    modifier: number
  }>
  actionPlan?: {
    cascadeSkillChoices?: Array<{
      cascadeSkill: string
      label: string
      level: number
      options: Array<{ value: string; label: string; cascade: boolean }>
    }>
    legalActions?: Array<{
      key: string
      commandTypes?: string[]
      termSkillTableOptions?: Array<{
        table: CareerCreationTermSkillTable
        label?: string
      }>
    }>
  }
  state?: {
    status?: string
  }
  terms?: Array<{
    career: string
    skillsAndTraining?: string[]
    facts?: {
      termSkillRolls?: Array<{
        career?: string
        table?: string
        tableRoll?: number
        rawSkill?: string
        skill?: string | null
        pendingCascadeSkill?: string | null
      }>
      termCascadeSelections?: Array<{
        cascadeSkill: string
        selection: string
      }>
      musteringBenefits?: ProjectedMusteringBenefit[]
    }
  }>
}

export type RoomStateMessage = {
  type: 'roomState'
  state: {
    diceLog?: Array<{
      revealAt?: string
      rolls?: number[]
      total?: number
    }>
    eventSeq?: number
    pieces?: Record<
      string,
      {
        id?: string
        name?: string
        characterId?: string | null
      }
    >
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
  liveActivities?: Array<{
    type?: string
    details?: unknown
    rolls?: number[]
    total?: number
  }>
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

export type ProjectedMusteringBenefit = {
  career: string
  kind: string
  tableRoll: number
  value: string
  credits?: number
  roll?: {
    rolls?: number[]
    total?: number
  }
}

const characteristicKeys = ['str', 'dex', 'end', 'int', 'edu', 'soc'] as const

export type NormalizedCharacteristicCreationSlice = {
  characteristics: Record<
    (typeof characteristicKeys)[number],
    number | null
  >
  diceRolls: Array<{
    rolls: number[] | null
    total: number | null
  }>
  status: string | null
}

export type NormalizedCareerContinuationSlice = {
  status: string | null
  terms: Array<{
    career: string
    termSkillRolls: Array<{
      career?: string
      table?: string
      tableRoll?: number
      rawSkill?: string
      skill?: string | null
      pendingCascadeSkill?: string | null
      roll?: {
        rolls?: number[]
        total?: number
      }
    }>
    termCascadeSelections: Array<{
      cascadeSkill: string
      selection: string
    }>
    musteringBenefits: ProjectedMusteringBenefit[]
  }>
}

export type NormalizedLaterTermRollSlice = {
  status: string | null
  termCareers: string[]
  latestDiceRoll: {
    rolls: number[] | null
    total: number | null
  } | null
}

const actorSessionKey = (roomId: string, actorId: string): string =>
  `cepheus.actorSession.${roomId}.${actorId}`

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

export const waitForRoomStateResponse = async (
  page: Page,
  {
    roomId,
    userId,
    viewer
  }: {
    roomId: string
    userId: string
    viewer: 'referee' | 'player' | 'spectator'
  }
): Promise<RoomStateMessage> => {
  let state: Promise<RoomStateMessage> | null = null
  await page.waitForResponse((candidate) => {
    const url = new URL(candidate.url())
    const matches =
      candidate.request().method() === 'GET' &&
      url.pathname === `/rooms/${roomId}/state` &&
      url.searchParams.get('viewer') === viewer &&
      url.searchParams.get('user') === userId
    if (matches) {
      state = candidate.json() as Promise<RoomStateMessage>
    }
    return matches
  })
  if (!state) throw new Error(`Missing ${viewer} state for ${userId}`)
  return state
}

export const expectLatestRollRedacted = (
  message: RoomStateMessage
): void => {
  const latestRoll = message.state?.diceLog?.at(-1)
  const creationActivity = message.liveActivities?.find(
    (activity) => activity.type === 'characterCreation'
  )

  expect(message.type).toBe('roomState')
  expect(latestRoll).toBeTruthy()
  expect(typeof latestRoll?.revealAt).toBe('string')
  expect(latestRoll?.rolls).toBeUndefined()
  expect(latestRoll?.total).toBeUndefined()
  expect(creationActivity?.details).toBeUndefined()
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

export const seedNextProjectedRoll = async (
  page: Page,
  roomId: string,
  actorId: string,
  expectedRolls: readonly number[],
  sides = 6
): Promise<void> => {
  const message = await fetchRoomState(page, roomId, actorId)
  await setSeedForNextRoll(
    page,
    roomId,
    (message.state?.eventSeq ?? 0) + 1,
    expectedRolls,
    sides
  )
}

export const latestProjectedTermSkill = async (
  page: Page,
  roomId: string,
  actorId: string,
  characterId: string
): Promise<ProjectedTermSkill | null> => {
  const message = await fetchRoomState(page, roomId, actorId)
  const creation = message.state?.characters[characterId]?.creation
  const projectedTermSkill = projectedTermSkillEntries(creation).at(-1)
  const termSkill = projectedTermSkill?.termSkill
  if (
    !termSkill?.career ||
    !termSkill.table ||
    typeof termSkill.tableRoll !== 'number'
  ) {
    return null
  }
  const skill =
    termSkill.skill ??
    resolveProjectedTermCascadeSkill(
      projectedTermSkill?.term ?? null,
      termSkill.pendingCascadeSkill ?? null
    ) ??
    termSkill.pendingCascadeSkill ??
    creation?.pendingCascadeSkills?.at(-1) ??
    termSkill.rawSkill
  if (!skill) return null
  return {
    career: termSkill.career,
    table: termSkill.table,
    tableRoll: termSkill.tableRoll,
    skill
  }
}

const projectedTermSkillEntries = (
  creation: CharacterCreationProjection | null | undefined
): Array<{
  term: NonNullable<CharacterCreationProjection['terms']>[number]
  termSkill: NonNullable<
    NonNullable<
      NonNullable<CharacterCreationProjection['terms']>[number]['facts']
    >['termSkillRolls']
  >[number]
}> =>
  (creation?.terms ?? []).flatMap((term) =>
    (term.facts?.termSkillRolls ?? []).map((termSkill) => ({
      term,
      termSkill
    }))
  )

const resolveProjectedTermCascadeSkill = (
  term: NonNullable<CharacterCreationProjection['terms']>[number] | null,
  cascadeSkill: string | null
): string | null => {
  if (!term || !cascadeSkill) return null

  let current = cascadeSkill
  const visited = new Set<string>()

  while (!visited.has(current)) {
    visited.add(current)
    const selection = term.facts?.termCascadeSelections?.find(
      (entry) => entry.cascadeSkill === current
    )?.selection
    if (!selection) return null

    const level = Number.parseInt(current.match(/-(\d+)$/)?.[1] ?? '0', 10)
    if (selection.endsWith('*')) {
      current = selection.replace(/\*$/, `-${level}`)
      continue
    }

    return `${selection}-${level}`
  }

  return null
}

export const projectedTermSkillFacts = (
  creation: CharacterCreationProjection | null | undefined
): Array<{
  career?: string
  table?: string
  tableRoll?: number
  rawSkill?: string
  skill?: string | null
  pendingCascadeSkill?: string | null
}> =>
  (creation?.terms ?? []).flatMap((term) => term.facts?.termSkillRolls ?? [])

export const projectedTermSkillCount = (
  creation: CharacterCreationProjection | null | undefined
): number => projectedTermSkillFacts(creation).length

export const projectedMusteringBenefits = (
  creation: CharacterCreationProjection | null | undefined
): ProjectedMusteringBenefit[] =>
  (creation?.terms ?? []).flatMap(
    (term) => term.facts?.musteringBenefits ?? []
  )

export const normalizedCharacteristicCreationSlice = (
  message: RoomStateMessage,
  characterId: string
): NormalizedCharacteristicCreationSlice => {
  const character = message.state?.characters[characterId]
  return {
    characteristics: Object.fromEntries(
      characteristicKeys.map((key) => [
        key,
        character?.characteristics?.[key] ?? null
      ])
    ) as NormalizedCharacteristicCreationSlice['characteristics'],
    diceRolls: (message.state?.diceLog ?? []).slice(-6).map((roll) => ({
      rolls: roll.rolls ?? null,
      total: roll.total ?? null
    })),
    status: character?.creation?.state?.status ?? null
  }
}

export const normalizedCareerContinuationSlice = (
  message: RoomStateMessage,
  characterId: string
): NormalizedCareerContinuationSlice => {
  const creation = message.state?.characters[characterId]?.creation
  return {
    status: creation?.state?.status ?? null,
    terms: (creation?.terms ?? []).map((term) => ({
      career: term.career,
      termSkillRolls: (term.facts?.termSkillRolls ?? []).map(
        ({
          career,
          table,
          tableRoll,
          rawSkill,
          skill,
          pendingCascadeSkill,
          roll
        }) => ({
          career,
          table,
          tableRoll,
          rawSkill,
          skill,
          pendingCascadeSkill,
          roll
        })
      ),
      termCascadeSelections: term.facts?.termCascadeSelections ?? [],
      musteringBenefits: (term.facts?.musteringBenefits ?? []).map(
        ({ career, kind, tableRoll, value, credits, roll }) => ({
          career,
          kind,
          tableRoll,
          value,
          credits,
          roll
        })
      )
    }))
  }
}

export const normalizedLaterTermRollSlice = (
  message: RoomStateMessage,
  characterId: string
): NormalizedLaterTermRollSlice => {
  const creation = message.state?.characters[characterId]?.creation
  const latestRoll = message.state?.diceLog?.at(-1)
  return {
    status: creation?.state?.status ?? null,
    termCareers: (creation?.terms ?? []).map((term) => term.career),
    latestDiceRoll: latestRoll
      ? {
          rolls: latestRoll.rolls ?? null,
          total: latestRoll.total ?? null
        }
      : null
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
  const overlay = page.locator('#diceOverlay')
  await expect(page.locator('#diceOverlay.visible')).toBeVisible({
    timeout: 5_000
  })
  const visibleTotal = page.locator('#diceOverlay.visible #diceStage .roll-total')
  if (((await visibleTotal.textContent()) ?? '').trim() === 'Rolling...') {
    await Promise.race([
      expect(visibleTotal).not.toHaveText('Rolling...', { timeout: 5_000 }),
      expect(overlay).not.toHaveClass(/visible/, { timeout: 5_000 })
    ])
  }
  await expect(overlay).not.toHaveClass(/visible/, { timeout: 5_000 })
}

export const waitForLatestDiceRevealBoundary = async (
  page: Page,
  roomId: string,
  actorId: string,
  viewer: 'referee' | 'player' | 'spectator' = 'referee'
): Promise<void> => {
  await expect
    .poll(
      async () => {
        const message = await fetchRoomState(page, roomId, actorId, viewer)
        const revealAt = message.state?.diceLog?.at(-1)?.revealAt
        if (!revealAt) return true
        const revealAtMs = Date.parse(revealAt)
        return Number.isFinite(revealAtMs) && Date.now() >= revealAtMs + 50
      },
      { timeout: 7_000 }
    )
    .toBe(true)
}

export const normalizedText = async (
  locator: ReturnType<Page['locator']>
): Promise<string> =>
  ((await locator.textContent()) ?? '').replace(/\s+/g, ' ').trim()

export const openOrExpectFollowedCreation = async (
  page: Page,
  characterName: string
): Promise<void> => {
  const panel = page.locator('#characterCreator')
  const title = page.locator('#characterCreatorTitle')
  const card = page
    .locator('#creationPresenceDock .creation-presence-card')
    .filter({ hasText: characterName })

  const url = new URL(page.url())
  const roomId = url.searchParams.get('game') ?? ''
  const actorId = url.searchParams.get('user') ?? 'local-user'
  const viewer =
    (url.searchParams.get('viewer') as 'referee' | 'player' | 'spectator') ??
    'player'
  let reloadedAfterProjection = false
  const deadline = Date.now() + 25_000
  while (Date.now() < deadline) {
    if (
      (await panel.isVisible().catch(() => false)) &&
      ((await title.textContent().catch(() => null)) ?? '').trim() ===
        characterName
    ) {
      return
    }
    if (await card.isVisible().catch(() => false)) {
      await card.click()
      await expect(panel).toBeVisible({ timeout: 5_000 })
      if (
        ((await title.textContent().catch(() => null)) ?? '').trim() ===
        characterName
      ) {
        return
      }
    }
    if (roomId && !reloadedAfterProjection) {
      const message = await fetchRoomState(page, roomId, actorId, viewer).catch(
        () => null
      )
      const hasProjectedCreation = Object.values(
        message?.state?.characters ?? {}
      ).some(
        (character) =>
          character.creation &&
          (character.creation.name === characterName ||
            character.name === characterName)
      )
      if (hasProjectedCreation) {
        reloadedAfterProjection = true
        await page.reload({ waitUntil: 'domcontentloaded' })
        await expect(page.locator('#boardCanvas')).toBeVisible()
      }
    }
    await page.waitForTimeout(100)
  }

  await expect(panel).toBeVisible({ timeout: 5_000 })
  await expect(title).toHaveText(characterName, { timeout: 5_000 })
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
  await waitForLatestDiceRevealBoundary(page, roomId, actorId, 'player')
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

const projectedLegalAction = async (
  page: Page,
  roomId: string,
  actorId: string,
  characterId: string,
  key: string
) => {
  const character = await fetchProjectedCharacter(
    page,
    roomId,
    actorId,
    characterId
  )
  return character?.creation?.actionPlan?.legalActions?.find(
    (action) => action.key === key
  )
}

const resolvePendingProjectionCascadeSkills = async (
  page: Page,
  roomId: string,
  actorId: string,
  actorSession: string,
  characterId: string
): Promise<void> => {
  for (let index = 0; index < 8; index += 1) {
    const character = await fetchProjectedCharacter(
      page,
      roomId,
      actorId,
      characterId
    )
    const cascadeSkill = character?.creation?.pendingCascadeSkills?.[0]
    if (!cascadeSkill) return
    const cascadeChoice = character.creation?.actionPlan?.cascadeSkillChoices
      ?.find((choice) => choice.cascadeSkill === cascadeSkill)
      ?.options.find((option) => !option.cascade)
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'ResolveCharacterCreationTermCascadeSkill',
      characterId,
      cascadeSkill,
      selection: cascadeChoice?.value ?? cascadeSkill.replace(/\*$/, '')
    })
  }
}

export const seedCreationToAnagathicsDecision = async (
  page: Page,
  {
    roomId,
    actorId,
    actorSession,
    characterId,
    career = 'Scout'
  }: {
    roomId: string
    actorId: string
    actorSession: string
    characterId: string
    career?: string
  }
): Promise<void> => {
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
  await seedNextProjectedRoll(page, roomId, actorId, [6, 6])
  await postCommand(page, roomId, actorId, actorSession, {
    type: 'ResolveCharacterCreationQualification',
    characterId,
    career
  })
  await waitForLatestDiceRevealBoundary(page, roomId, actorId, 'player')
  const basicTraining = await projectedLegalAction(
    page,
    roomId,
    actorId,
    characterId,
    'completeBasicTraining'
  )
  if (basicTraining) {
    const character = await fetchProjectedCharacter(
      page,
      roomId,
      actorId,
      characterId
    )
    const previousTermCount = Math.max(
      0,
      (character?.creation?.terms?.length ?? 1) - 1
    )
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'CompleteCharacterCreationBasicTraining',
      characterId,
      ...(previousTermCount > 0 ? { skill: 'Comms-0' } : {})
    })
  }
  await seedNextProjectedRoll(page, roomId, actorId, [6, 6])
  await postCommand(page, roomId, actorId, actorSession, {
    type: 'ResolveCharacterCreationSurvival',
    characterId
  })
  await waitForLatestDiceRevealBoundary(page, roomId, actorId, 'player')

  for (let index = 0; index < 8; index += 1) {
    const action = await projectedLegalAction(
      page,
      roomId,
      actorId,
      characterId,
      'rollTermSkill'
    )
    if (!action) break
    const table =
      'termSkillTableOptions' in action &&
      Array.isArray(action.termSkillTableOptions)
        ? action.termSkillTableOptions[0]?.table
        : undefined
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'RollCharacterCreationTermSkill',
      characterId,
      table: table ?? 'serviceSkills'
    })
    await waitForLatestDiceRevealBoundary(page, roomId, actorId, 'player')
    await resolvePendingProjectionCascadeSkills(
      page,
      roomId,
      actorId,
      actorSession,
      characterId
    )
  }

  const completeSkills = await projectedLegalAction(
    page,
    roomId,
    actorId,
    characterId,
    'completeSkills'
  )
  if (completeSkills) {
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'CompleteCharacterCreationSkills',
      characterId
    })
  }
  await expect
    .poll(async () => {
      const action = await projectedLegalAction(
        page,
        roomId,
        actorId,
        characterId,
        'decideAnagathics'
      )
      return Boolean(action)
    })
    .toBe(true)
}
