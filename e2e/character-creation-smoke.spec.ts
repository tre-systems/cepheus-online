import {
  expect,
  test,
  type Page,
  type TestInfo
} from '@playwright/test'
import {
  openRoom,
  openUniqueRoom,
  setRoomSeed,
  setSeedForNextRoll
} from './support/app'
import {
  activeCreationCharacterId,
  actorIdFromPage,
  actorSessionFromPage,
  creationCharacterIds,
  expectSpectatorRefreshPreservesCreationProjection,
  fetchProjectedCharacter,
  fetchRoomState,
  latestProjectedTermSkill,
  normalizedText,
  openOrExpectFollowedCreation,
  postCommand,
  projectedMusteringBenefits,
  projectedTermSkillCount,
  rollCareerOutcomeWithSpectatorReveal,
  seedCreationToCareerSelection,
  seedCreationToHomeworld,
  waitForDiceReveal,
  type ProjectedTermSkill,
  type RoomStateMessage
} from './support/character-creation'

type RepeatTravellerContext = {
  label: string
  seed: number
  characterId?: string
  characterName?: string
  phase: string
  action: string
  commandTypes: string[]
  consoleErrors: string[]
  serverResponses: Array<{
    commandType: string
    status: number
    body: string
  }>
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

const cascadeSelectionFor = (cascadeSkill: string): string => {
  const normalized = cascadeSkill.replace(/\*$/, '')
  switch (normalized) {
    case 'Aircraft':
      return 'Grav Vehicle'
    case 'Animals':
      return 'Survival'
    case 'Gun Combat':
      return 'Slug Rifle'
    case 'Gunnery':
      return 'Turret Weapons'
    case 'Melee Combat':
      return 'Slashing Weapons'
    case 'Sciences':
      return 'Life Sciences'
    case 'Vehicle':
      return 'Grav Vehicle'
    case 'Watercraft':
      return 'Motorboats'
    case 'Weapon':
      return 'Gun Combat'
    default:
      return normalized
  }
}

const resolveProjectedTermCascadeSkills = async ({
  page,
  roomId,
  actorId,
  actorSession,
  characterId
}: {
  page: Page
  roomId: string
  actorId: string
  actorSession: string
  characterId: string
}): Promise<void> => {
  for (let index = 0; index < 8; index += 1) {
    const character = await fetchProjectedCharacter(
      page,
      roomId,
      actorId,
      characterId
    )
    const pendingCascadeSkill = character?.creation?.pendingCascadeSkills?.[0]
    if (!pendingCascadeSkill) return
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'ResolveCharacterCreationTermCascadeSkill',
      characterId,
      cascadeSkill: pendingCascadeSkill,
      selection: cascadeSelectionFor(pendingCascadeSkill)
    })
  }
}

const legalCreationActionKeys = async ({
  page,
  roomId,
  actorId,
  characterId
}: {
  page: Page
  roomId: string
  actorId: string
  characterId: string
}): Promise<string[]> => {
  const character = await fetchProjectedCharacter(
    page,
    roomId,
    actorId,
    characterId
  )
  return character?.creation?.actionPlan?.legalActions?.map(
    (action) => action.key
  ) ?? []
}

const completeProjectedTermSkills = async ({
  page,
  roomId,
  actorId,
  actorSession,
  characterId
}: {
  page: Page
  roomId: string
  actorId: string
  actorSession: string
  characterId: string
}): Promise<void> => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await resolveProjectedTermCascadeSkills({
      page,
      roomId,
      actorId,
      actorSession,
      characterId
    })

    const legalActions = await legalCreationActionKeys({
      page,
      roomId,
      actorId,
      characterId
    })
    if (legalActions.includes('completeSkills')) {
      await postCommand(page, roomId, actorId, actorSession, {
        type: 'CompleteCharacterCreationSkills',
        characterId
      })
      return
    }
    if (!legalActions.includes('rollTermSkill')) return

    await postCommand(page, roomId, actorId, actorSession, {
      type: 'RollCharacterCreationTermSkill',
      characterId,
      table: 'serviceSkills'
    })
  }

  throw new Error('Projected term skills did not reach completion')
}

const nextEventSeq = async (
  page: Page,
  roomId: string,
  actorId: string
): Promise<number> => {
  const message = await fetchRoomState(page, roomId, actorId)
  return (message.state?.eventSeq ?? 0) + 1
}

const selectedAgingLosses = (
  changes: Array<{ type: 'PHYSICAL' | 'MENTAL'; modifier: number }>
): Array<{
  type: 'PHYSICAL' | 'MENTAL'
  modifier: number
  characteristic: 'str' | 'dex' | 'end' | 'int' | 'edu' | 'soc'
}> => {
  const physical = ['str', 'dex', 'end'] as const
  const mental = ['int', 'edu', 'soc'] as const
  let physicalIndex = 0
  let mentalIndex = 0
  return changes.map((change) => ({
    ...change,
    characteristic:
      change.type === 'PHYSICAL'
        ? physical[Math.min(physicalIndex++, physical.length - 1)]
        : mental[Math.min(mentalIndex++, mental.length - 1)]
  }))
}

const completeSecondScoutTermAndFinalize = async ({
  page,
  roomId,
  actorId,
  actorSession,
  characterId
}: {
  page: Page
  roomId: string
  actorId: string
  actorSession: string
  characterId: string
}): Promise<void> => {
  await postCommand(page, roomId, actorId, actorSession, {
    type: 'CompleteCharacterCreationBasicTraining',
    characterId,
    skill: 'Comms-0'
  })
  await postCommand(page, roomId, actorId, actorSession, {
    type: 'ResolveCharacterCreationSurvival',
    characterId
  })
  for (const table of ['serviceSkills', 'specialistSkills'] as const) {
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'RollCharacterCreationTermSkill',
      characterId,
      table
    })
    await resolveProjectedTermCascadeSkills({
      page,
      roomId,
      actorId,
      actorSession,
      characterId
    })
  }
  await postCommand(page, roomId, actorId, actorSession, {
    type: 'CompleteCharacterCreationSkills',
    characterId
  })

  let legalActions = await legalCreationActionKeys({
    page,
    roomId,
    actorId,
    characterId
  })
  if (legalActions.includes('decideAnagathics')) {
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'DecideCharacterCreationAnagathics',
      characterId,
      useAnagathics: false
    })
  }
  legalActions = await legalCreationActionKeys({
    page,
    roomId,
    actorId,
    characterId
  })
  if (legalActions.includes('resolveAging')) {
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'ResolveCharacterCreationAging',
      characterId
    })
    const agingCharacter = await fetchProjectedCharacter(
      page,
      roomId,
      actorId,
      characterId
    )
    const changes = agingCharacter?.creation?.characteristicChanges ?? []
    if (changes.length > 0) {
      await postCommand(page, roomId, actorId, actorSession, {
        type: 'ResolveCharacterCreationAgingLosses',
        characterId,
        selectedLosses: selectedAgingLosses(changes)
      })
    }
  }

  await postCommand(page, roomId, actorId, actorSession, {
    type: 'ResolveCharacterCreationReenlistment',
    characterId
  })
  legalActions = await legalCreationActionKeys({
    page,
    roomId,
    actorId,
    characterId
  })
  if (!legalActions.includes('leaveCareer')) {
    throw new Error(
      `Expected Scout term to be able to leave career; legal actions were ${legalActions.join(', ')}`
    )
  }
  await postCommand(page, roomId, actorId, actorSession, {
    type: 'LeaveCharacterCreationCareer',
    characterId
  })

  for (let index = 0; index < 4; index += 1) {
    legalActions = await legalCreationActionKeys({
      page,
      roomId,
      actorId,
      characterId
    })
    if (!legalActions.includes('resolveMusteringBenefit')) break
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'RollCharacterCreationMusteringBenefit',
      characterId,
      career: 'Scout',
      kind: 'material'
    })
  }
  legalActions = await legalCreationActionKeys({
    page,
    roomId,
    actorId,
    characterId
  })
  if (legalActions.includes('finishMustering')) {
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'CompleteCharacterCreationMustering',
      characterId
    })
  }
  legalActions = await legalCreationActionKeys({
    page,
    roomId,
    actorId,
    characterId
  })
  if (!legalActions.includes('completeCreation')) {
    throw new Error(
      `Expected creation completion to be legal; legal actions were ${legalActions.join(', ')}`
    )
  }
  await postCommand(page, roomId, actorId, actorSession, {
    type: 'FinalizeCharacterCreation',
    characterId
  })
}

const characterCreationCareerButton = (page: Page, career: string) =>
  page
    .locator('#characterCreationFields .creation-career-list button')
    .filter({
      has: page.locator('.creation-career-title').filter({ hasText: career })
    })

const creatorSkillStrip = (page: Page) =>
  page.locator('#characterCreationFields .creation-skill-strip')

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

const expectMobileControlUsable = async (
  locator: ReturnType<Page['locator']>,
  label: string
): Promise<void> => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await expect(locator, label).toBeVisible()
    await expect(locator, label).toBeEnabled()
    try {
      await locator.scrollIntoViewIfNeeded({ timeout: 1_000 })
      break
    } catch (error) {
      if (attempt === 4) throw error
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }
  await expect
    .poll(
      () =>
        locator
          .evaluate((element) => {
            const rect = element.getBoundingClientRect()
            if (rect.width <= 0 || rect.height <= 0) return false

            const x = Math.min(
              Math.max(rect.left + rect.width / 2, 0),
              window.innerWidth - 1
            )
            const y = Math.min(
              Math.max(rect.top + rect.height / 2, 0),
              window.innerHeight - 1
            )
            const topElement = document.elementFromPoint(x, y)
            return topElement ? element.contains(topElement) : false
          })
          .catch(() => false),
      { message: `${label} center point is not covered` }
    )
    .toBe(true)
}

const continueCreationWizardToSkills = async ({
  page,
  fields,
  mobile = false
}: {
  page: Page
  fields: ReturnType<Page['locator']>
  mobile?: boolean
}): Promise<void> => {
  const continueToSkills = page.getByRole('button', {
    name: 'Continue to skills'
  })
  if (await continueToSkills.isVisible().catch(() => false)) {
    if (mobile) {
      await expectMobileControlUsable(continueToSkills, 'Continue to skills')
    } else {
      await expect(continueToSkills).toBeEnabled()
    }
    await continueToSkills.click()
  }
  await expect(fields).toContainText(/Skills|Review the skill list/, {
    timeout: 5_000
  })
}

const expectMusteringEquipmentStep = async (
  fields: ReturnType<Page['locator']>
): Promise<void> => {
  await expect(fields).toContainText(/Mustering out|Equipment|benefit/i, {
    timeout: 5_000
  })
}

const expectDiceRollPending = async (page: Page): Promise<void> => {
  await expect(page.locator('#diceStage .roll-total')).toHaveText(
    /^(Rolling\.\.\.|\?)$/,
    { timeout: 100 }
  )
}

const attachRepeatTravellerContext = async (
  page: Page,
  roomId: string,
  actorId: string,
  testInfo: TestInfo,
  context: RepeatTravellerContext
): Promise<void> => {
  let roomState: RoomStateMessage | null = null
  try {
    roomState = await fetchRoomState(page, roomId, actorId)
  } catch {
    roomState = null
  }

  await testInfo.attach(`${context.label}-context.json`, {
    contentType: 'application/json',
    body: JSON.stringify(
      {
        ...context,
        url: page.url(),
        stateSummary: roomState
          ? {
              characterCount: Object.keys(roomState.state?.characters ?? {})
                .length,
              character: context.characterId
                ? roomState.state?.characters[context.characterId] ?? null
                : null
            }
          : null
      },
      null,
      2
    )
  })
}

const repeatTravellerStep = async (
  page: Page,
  roomId: string,
  actorId: string,
  testInfo: TestInfo,
  context: RepeatTravellerContext,
  phase: string,
  action: string,
  body: () => Promise<void>
): Promise<void> => {
  context.phase = phase
  context.action = action

  await test.step(`${context.label}: ${phase} / ${action}`, async () => {
    try {
      await body()
    } catch (error) {
      await attachRepeatTravellerContext(
        page,
        roomId,
        actorId,
        testInfo,
        context
      )
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(
        `${context.label} failed during ${phase} / ${action}: ${message}`
      )
    }
  })
}

const postRepeatCommand = async (
  page: Page,
  roomId: string,
  actorId: string,
  actorSession: string,
  context: RepeatTravellerContext,
  command: Record<string, unknown>
): Promise<void> => {
  const commandType = String(command.type)
  context.commandTypes.push(commandType)
  const response = await page.request.post(
    `/rooms/${encodeURIComponent(roomId)}/command`,
    {
      headers: {
        'content-type': 'application/json',
        'x-cepheus-actor-session': actorSession
      },
      data: {
        type: 'command',
        requestId: `e2e-repeat-${commandType}-${Date.now()}`,
        command: {
          gameId: roomId,
          actorId,
          ...command
        }
      }
    }
  )
  const responseText = await response.text()
  context.serverResponses.push({
    commandType,
    status: response.status(),
    body: responseText.slice(0, 1_000)
  })
  expect(response.ok(), responseText).toBe(true)
  expect(JSON.parse(responseText).type, responseText).toBe('commandAccepted')
}

const postRepeatCommandIfAccepted = async (
  page: Page,
  roomId: string,
  actorId: string,
  actorSession: string,
  context: RepeatTravellerContext,
  command: Record<string, unknown>,
  allowedRejection: RegExp
): Promise<boolean> => {
  const commandType = String(command.type)
  context.commandTypes.push(commandType)
  const response = await page.request.post(
    `/rooms/${encodeURIComponent(roomId)}/command`,
    {
      headers: {
        'content-type': 'application/json',
        'x-cepheus-actor-session': actorSession
      },
      data: {
        type: 'command',
        requestId: `e2e-repeat-${commandType}-${Date.now()}`,
        command: {
          gameId: roomId,
          actorId,
          ...command
        }
      }
    }
  )
  const responseText = await response.text()
  context.serverResponses.push({
    commandType,
    status: response.status(),
    body: responseText.slice(0, 1_000)
  })
  if (response.ok()) {
    expect(JSON.parse(responseText).type, responseText).toBe('commandAccepted')
    return true
  }
  if (allowedRejection.test(responseText)) return false
  expect(response.ok(), responseText).toBe(true)
  return false
}

const firstRepeatCascadeSelection = (cascadeSkill: string): string => {
  const skill = cascadeSkill.replace(/\*$/, '').replace(/-\d+$/, '')
  if (skill === 'Aircraft' || skill === 'Vehicle') return 'Grav Vehicle'
  if (skill === 'Gun Combat') return 'Slug Rifle'
  if (skill === 'Melee Combat') return 'Blade'
  if (skill === 'Weapon') return 'Gun Combat'
  return skill
}

const resolveRepeatPendingTermCascades = async (
  page: Page,
  roomId: string,
  actorId: string,
  actorSession: string,
  context: RepeatTravellerContext
): Promise<void> => {
  if (!context.characterId) throw new Error('Missing repeat character id')

  for (let index = 0; index < 6; index += 1) {
    const character = await fetchProjectedCharacter(
      page,
      roomId,
      actorId,
      context.characterId
    )
    const pendingCascade = character?.creation?.pendingCascadeSkills?.at(-1)
    if (!pendingCascade) return
    await postRepeatCommand(page, roomId, actorId, actorSession, context, {
      type: 'ResolveCharacterCreationTermCascadeSkill',
      characterId: context.characterId,
      cascadeSkill: pendingCascade,
      selection: firstRepeatCascadeSelection(pendingCascade)
    })
  }

  throw new Error('Pending term cascade choices did not settle')
}

const createRepeatTraveller = async (
  page: Page,
  roomId: string,
  actorId: string,
  actorSession: string,
  context: RepeatTravellerContext
): Promise<void> => {
  context.characterId = `repeat-${context.label}-${Date.now()}`
  context.characterName = `Repeat ${context.label}`
  await postRepeatCommand(page, roomId, actorId, actorSession, context, {
    type: 'CreateCharacter',
    characterId: context.characterId,
    characterType: 'PLAYER',
    name: context.characterName
  })
  await postRepeatCommand(page, roomId, actorId, actorSession, context, {
    type: 'StartCharacterCreation',
    characterId: context.characterId
  })
}

const createRepeatContext = (
  label: string,
  seed: number,
  consoleErrors: string[]
): RepeatTravellerContext => ({
  label,
  seed,
  phase: 'setup',
  action: 'not started',
  commandTypes: [],
  consoleErrors,
  serverResponses: []
})

const seedLowStatRepeatTravellerToCareerSelection = async (
  page: Page,
  roomId: string,
  actorId: string,
  actorSession: string,
  context: RepeatTravellerContext
): Promise<void> => {
  await setRoomSeed(page, roomId, context.seed)
  await createRepeatTraveller(page, roomId, actorId, actorSession, context)
  if (!context.characterId) throw new Error('Missing repeat character')
  await seedCreationToCareerSelection(page, {
    roomId,
    actorId,
    actorSession,
    characterId: context.characterId
  })
  await postRepeatCommand(page, roomId, actorId, actorSession, context, {
    type: 'UpdateCharacterSheet',
    characterId: context.characterId,
    characteristics: {
      str: 2,
      dex: 2,
      end: 2,
      int: 2,
      edu: 2,
      soc: 2
    }
  })
}

const completeRepeatRequiredTermSkills = async (
  page: Page,
  roomId: string,
  actorId: string,
  actorSession: string,
  context: RepeatTravellerContext
): Promise<void> => {
  if (!context.characterId) throw new Error('Missing repeat character id')

  for (let roll = 0; roll < 4; roll += 1) {
    await postRepeatCommand(page, roomId, actorId, actorSession, context, {
      type: 'RollCharacterCreationTermSkill',
      characterId: context.characterId,
      table: 'personalDevelopment'
    })
    await resolveRepeatPendingTermCascades(
      page,
      roomId,
      actorId,
      actorSession,
      context
    )

    const character = await fetchProjectedCharacter(
      page,
      roomId,
      actorId,
      context.characterId
    )
    if (character?.creation?.state?.status !== 'SKILLS_TRAINING') return

    const completed = await postRepeatCommandIfAccepted(
      page,
      roomId,
      actorId,
      actorSession,
      context,
      {
        type: 'CompleteCharacterCreationSkills',
        characterId: context.characterId
      },
      /required term skills are rolled/i
    )
    if (completed) return
  }

  throw new Error('Required term skills were not completed after four rolls')
}

const driveRepeatTravellerToFinalized = async (
  page: Page,
  roomId: string,
  actorId: string,
  actorSession: string,
  context: RepeatTravellerContext
): Promise<void> => {
  if (!context.characterId) throw new Error('Missing repeat character id')
  await seedCreationToCareerSelection(page, {
    roomId,
    actorId,
    actorSession,
    characterId: context.characterId
  })
  await postRepeatCommand(page, roomId, actorId, actorSession, context, {
    type: 'UpdateCharacterSheet',
    characterId: context.characterId,
    characteristics: {
      str: 15,
      dex: 15,
      end: 15,
      int: 15,
      edu: 15,
      soc: 15
    }
  })
  await postRepeatCommand(page, roomId, actorId, actorSession, context, {
    type: 'ResolveCharacterCreationQualification',
    characterId: context.characterId,
    career: 'Scout'
  })
  await postRepeatCommand(page, roomId, actorId, actorSession, context, {
    type: 'CompleteCharacterCreationBasicTraining',
    characterId: context.characterId
  })
  await postRepeatCommand(page, roomId, actorId, actorSession, context, {
    type: 'ResolveCharacterCreationSurvival',
    characterId: context.characterId
  })
  await completeRepeatRequiredTermSkills(
    page,
    roomId,
    actorId,
    actorSession,
    context
  )
  await postRepeatCommand(page, roomId, actorId, actorSession, context, {
    type: 'DecideCharacterCreationAnagathics',
    characterId: context.characterId,
    useAnagathics: false
  })
  await postRepeatCommand(page, roomId, actorId, actorSession, context, {
    type: 'ResolveCharacterCreationAging',
    characterId: context.characterId
  })
  await postRepeatCommand(page, roomId, actorId, actorSession, context, {
    type: 'ResolveCharacterCreationReenlistment',
    characterId: context.characterId
  })
  await postRepeatCommand(page, roomId, actorId, actorSession, context, {
    type: 'LeaveCharacterCreationCareer',
    characterId: context.characterId
  })
  await postRepeatCommand(page, roomId, actorId, actorSession, context, {
    type: 'RollCharacterCreationMusteringBenefit',
    characterId: context.characterId,
    career: 'Scout',
    kind: 'material'
  })
  await postRepeatCommand(page, roomId, actorId, actorSession, context, {
    type: 'CompleteCharacterCreationMustering',
    characterId: context.characterId
  })
  await postRepeatCommand(page, roomId, actorId, actorSession, context, {
    type: 'FinalizeCharacterCreation',
    characterId: context.characterId
  })
}

const seedCreationToReenlistmentDecision = async (
  page: Page,
  {
    roomId,
    actorId,
    actorSession,
    context
  }: {
    roomId: string
    actorId: string
    actorSession: string
    context: RepeatTravellerContext & { characterId: string }
  }
): Promise<void> => {
  await seedCreationToCareerSelection(page, {
    roomId,
    actorId,
    actorSession,
    characterId: context.characterId
  })
  await postCommand(page, roomId, actorId, actorSession, {
    type: 'UpdateCharacterSheet',
    characterId: context.characterId,
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
    characterId: context.characterId,
    career: 'Scout'
  })
  await postCommand(page, roomId, actorId, actorSession, {
    type: 'CompleteCharacterCreationBasicTraining',
    characterId: context.characterId
  })
  await postCommand(page, roomId, actorId, actorSession, {
    type: 'ResolveCharacterCreationSurvival',
    characterId: context.characterId
  })
  await completeRepeatRequiredTermSkills(
    page,
    roomId,
    actorId,
    actorSession,
    context
  )
  await postCommand(page, roomId, actorId, actorSession, {
    type: 'DecideCharacterCreationAnagathics',
    characterId: context.characterId,
    useAnagathics: false
  })
  await postCommand(page, roomId, actorId, actorSession, {
    type: 'ResolveCharacterCreationAging',
    characterId: context.characterId
  })
}

test.describe('character creation smoke', () => {
  test('repeat-runs disposable seeded travellers with failure context', async ({
    page
  }, testInfo) => {
    test.setTimeout(120_000)
    const consoleErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })

    const roomId = await openUniqueRoom(page)
    await setRoomSeed(page, roomId, 13_579)
    const actorId = actorIdFromPage(page)
    const actorSession = await actorSessionFromPage(page, roomId, actorId)
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'CreateGame',
      slug: roomId,
      name: 'Repeat runner smoke'
    })

    const finalized = createRepeatContext('finalized-scout', 5, consoleErrors)
    await repeatTravellerStep(
      page,
      roomId,
      actorId,
      testInfo,
      finalized,
      'setup',
      'create traveller',
      async () => {
        await setRoomSeed(page, roomId, finalized.seed)
        await createRepeatTraveller(
          page,
          roomId,
          actorId,
          actorSession,
          finalized
        )
      }
    )
    await repeatTravellerStep(
      page,
      roomId,
      actorId,
      testInfo,
      finalized,
      'career',
      'drive to finalized Scout',
      async () => {
        await driveRepeatTravellerToFinalized(
          page,
          roomId,
          actorId,
          actorSession,
          finalized
        )
      }
    )
    await repeatTravellerStep(
      page,
      roomId,
      actorId,
      testInfo,
      finalized,
      'assert',
      'projected playable sheet',
      async () => {
        await expect
          .poll(async () => {
            if (!finalized.characterId) return null
            const character = await fetchProjectedCharacter(
              page,
              roomId,
              actorId,
              finalized.characterId
            )
            return {
              status: character?.creation?.state?.status,
              creationComplete: character?.creation?.creationComplete,
              notes: character?.notes ?? ''
            }
          })
          .toMatchObject({
            status: 'PLAYABLE',
            creationComplete: true,
            notes: expect.stringContaining('Term 1: Scout, survived.')
          })
      }
    )

    const drifter = createRepeatContext('fallback-drifter', 4, consoleErrors)
    const fallbackRoomId = await openUniqueRoom(page)
    const fallbackActorId = actorIdFromPage(page)
    const fallbackActorSession = await actorSessionFromPage(
      page,
      fallbackRoomId,
      fallbackActorId
    )
    await postCommand(page, fallbackRoomId, fallbackActorId, fallbackActorSession, {
      type: 'CreateGame',
      slug: fallbackRoomId,
      name: 'Repeat runner fallback smoke'
    })
    await repeatTravellerStep(
      page,
      fallbackRoomId,
      fallbackActorId,
      testInfo,
      drifter,
      'setup',
      'create low-stat traveller',
      async () => {
        await seedLowStatRepeatTravellerToCareerSelection(
          page,
          fallbackRoomId,
          fallbackActorId,
          fallbackActorSession,
          drifter
        )
      }
    )
    await repeatTravellerStep(
      page,
      fallbackRoomId,
      fallbackActorId,
      testInfo,
      drifter,
      'career',
      'fail Scout qualification and enter Drifter',
      async () => {
        if (!drifter.characterName) throw new Error('Missing Drifter name')
        await page.reload({ waitUntil: 'domcontentloaded' })
        await expect(page.locator('#boardCanvas')).toBeVisible()
        await openOrExpectFollowedCreation(page, drifter.characterName)

        const fields = page.locator('#characterCreationFields')
        const scoutCareer = characterCreationCareerButton(page, 'Scout')
        await expect(scoutCareer).toBeVisible({ timeout: 5_000 })
        await scoutCareer.click()
        await waitForDiceReveal(page)

        await expect(fields.locator('.creation-draft-fallback')).toBeVisible({
          timeout: 5_000
        })
        await expect(fields).toContainText('Qualification failed')
        await fields.getByRole('button', { name: 'Become a Drifter' }).click()
        drifter.commandTypes.push('EnterCharacterCreationDrifter')
        await expect(fields).toContainText(/Drifter|Apply basic training/, {
          timeout: 5_000
        })
      }
    )
    await repeatTravellerStep(
      page,
      fallbackRoomId,
      fallbackActorId,
      testInfo,
      drifter,
      'assert',
      'projected Drifter fallback',
      async () => {
        if (!drifter.characterId) throw new Error('Missing Drifter character')
        const roomState = await fetchRoomState(
          page,
          fallbackRoomId,
          fallbackActorId
        )
        const creationJson = JSON.stringify(
          roomState.state?.characters[drifter.characterId]?.creation ?? null
        )
        expect(creationJson).toContain('Drifter')
      }
    )

    const drafted = createRepeatContext('fallback-draft', 4, consoleErrors)
    await repeatTravellerStep(
      page,
      fallbackRoomId,
      fallbackActorId,
      testInfo,
      drafted,
      'setup',
      'create low-stat draft traveller',
      async () => {
        await seedLowStatRepeatTravellerToCareerSelection(
          page,
          fallbackRoomId,
          fallbackActorId,
          fallbackActorSession,
          drafted
        )
      }
    )
    await repeatTravellerStep(
      page,
      fallbackRoomId,
      fallbackActorId,
      testInfo,
      drafted,
      'career',
      'fail Entertainer qualification and roll Draft',
      async () => {
        if (!drafted.characterName) throw new Error('Missing Draft name')
        await page.reload({ waitUntil: 'domcontentloaded' })
        await expect(page.locator('#boardCanvas')).toBeVisible()
        await openOrExpectFollowedCreation(page, drafted.characterName)

        const fields = page.locator('#characterCreationFields')
        const entertainerCareer = characterCreationCareerButton(
          page,
          'Entertainer'
        )
        await expect(entertainerCareer).toBeVisible({ timeout: 5_000 })
        await entertainerCareer.click()
        await waitForDiceReveal(page)

        await expect(fields.locator('.creation-draft-fallback')).toBeVisible({
          timeout: 5_000
        })
        await expect(fields).toContainText('Qualification failed')
        const draftButton = fields.getByRole('button', {
          name: 'Roll draft (1d6)'
        })
        await expect(draftButton).toBeVisible()
        await draftButton.click()
        drafted.commandTypes.push('ResolveCharacterCreationDraft')
        await waitForDiceReveal(page)
        await expect(fields.locator('.creation-draft-fallback')).toHaveCount(
          0,
          { timeout: 5_000 }
        )

        if (!drafted.characterId) throw new Error('Missing Draft character')
        const roomState = await fetchRoomState(
          page,
          fallbackRoomId,
          fallbackActorId
        )
        const creation =
          (roomState.state?.characters[drafted.characterId]?.creation as
            | {
                canEnterDraft?: boolean
                terms?: Array<{ career?: string; draft?: 1 }>
              }
            | undefined) ?? null
        expect(creation?.canEnterDraft).toBe(false)
        const draftedCareer = creation?.terms?.find(
          (term) => term.draft === 1
        )?.career
        expect(draftedCareer).toBeTruthy()
        if (!draftedCareer) throw new Error('Drafted career was not persisted')
        await expect(fields).toContainText(draftedCareer, { timeout: 5_000 })
      }
    )
    await repeatTravellerStep(
      page,
      fallbackRoomId,
      fallbackActorId,
      testInfo,
      drafted,
      'assert',
      'projected Draft fallback after refresh',
      async () => {
        if (!drafted.characterId) throw new Error('Missing Draft character')
        await page.reload({ waitUntil: 'domcontentloaded' })
        await expect(page.locator('#boardCanvas')).toBeVisible()
        if (!drafted.characterName) throw new Error('Missing Draft name')
        await openOrExpectFollowedCreation(page, drafted.characterName)

        const roomState = await fetchRoomState(
          page,
          fallbackRoomId,
          fallbackActorId
        )
        const creation =
          (roomState.state?.characters[drafted.characterId]?.creation as
            | {
                canEnterDraft?: boolean
                terms?: Array<{ career?: string; draft?: 1 }>
              }
            | undefined) ?? null
        const draftedCareer = creation?.terms?.find(
          (term) => term.draft === 1
        )?.career
        expect(creation?.canEnterDraft).toBe(false)
        expect(draftedCareer).toBeTruthy()
        if (!draftedCareer) throw new Error('Drafted career was not persisted')
        await expect(page.locator('#characterCreationFields')).toContainText(
          draftedCareer,
          { timeout: 5_000 }
        )
      }
    )
  })

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

  test('keeps spectator follow selection isolated across active creations during reveal', async ({
    browser,
    page
  }) => {
    test.setTimeout(90_000)
    const roomId = await openUniqueRoom(page)
    await setRoomSeed(page, roomId, 24_680)
    const actorId = actorIdFromPage(page)
    const actorSession = await actorSessionFromPage(page, roomId, actorId)
    await page.locator('#createCharacterRailButton').click()

    const firstCharacterName =
      (await page.locator('#characterCreatorTitle').textContent()) ?? ''
    await activeCreationCharacterId(page, roomId, actorId)

    const secondCharacterId = 'follow-selection-isolation-second'
    const secondCharacterName = 'Follow Selection Isolation Second'
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'CreateCharacter',
      characterId: secondCharacterId,
      characterType: 'PLAYER',
      name: secondCharacterName
    })
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'StartCharacterCreation',
      characterId: secondCharacterId
    })

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('#boardCanvas')).toBeVisible()
    await openOrExpectFollowedCreation(page, firstCharacterName)

    const spectator = await browser.newPage()
    try {
      await openRoom(spectator, {
        roomId,
        userId: 'e2e-follow-isolation-spectator',
        viewer: 'spectator'
      })

      const spectatorTitle = spectator.locator('#characterCreatorTitle')
      const spectatorStrValue = spectator
        .locator('#characterCreationFields .creation-stat-cell')
        .filter({ hasText: 'Str' })
        .locator('strong')
      const dock = spectator.locator('#creationPresenceDock')
      const secondCard = dock
        .locator('.creation-presence-card')
        .filter({ hasText: secondCharacterName })

      await expect(dock.locator('.creation-presence-card')).toHaveCount(2)
      await secondCard.click()
      await expect(spectatorTitle).toHaveText(secondCharacterName)
      await expect(spectatorStrValue).toHaveCount(0)

      const characteristicAccepted = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().includes(`/rooms/${roomId}/command`) &&
          (response.request().postData() ?? '').includes(
            'RollCharacterCreationCharacteristic'
          )
      )
      await page.getByRole('button', { name: 'Roll Str' }).click()
      await expect((await characteristicAccepted).ok()).toBe(true)

      await expect(spectator.locator('#diceOverlay.visible')).toBeVisible({
        timeout: 5_000
      })
      await expect(spectatorTitle).toHaveText(secondCharacterName)
      await expect(spectatorStrValue).toHaveCount(0, { timeout: 100 })

      await waitForDiceReveal(page)
    } finally {
      await spectator.close()
    }
  })

  test('lets a spectator follow semantic characteristic rolls without early reveal and recover after refresh', async ({
    browser,
    page
  }) => {
    test.setTimeout(45_000)
    const roomId = await openUniqueRoom(page)
    const actorId = actorIdFromPage(page)
    await page.locator('#createCharacterRailButton').click()

    const characterName =
      (await page.locator('#characterCreatorTitle').textContent()) ?? ''
    const characterId = await activeCreationCharacterId(page, roomId, actorId)

    const spectatorId = 'e2e-spectator'
    const spectator = await browser.newPage()
    try {
      await openRoom(spectator, {
        roomId,
        userId: spectatorId,
        viewer: 'spectator'
      })

      await openOrExpectFollowedCreation(spectator, characterName)

      const ownerStatValue = (stat: string) =>
        page
          .locator('#characterCreationFields .creation-stat-cell')
          .filter({ hasText: stat })
          .locator('strong')
      const spectatorStatValue = (stat: string) =>
        spectator
          .locator('#characterCreationFields .creation-stat-cell')
          .filter({ hasText: stat })
          .locator('strong')

      await page.getByRole('button', { name: 'Roll Str' }).click()

      await expect(spectator.locator('#diceOverlay.visible')).toBeVisible({
        timeout: 5_000
      })
      await expectDiceRollPending(spectator)
      await expect(spectatorStatValue('Str')).toHaveCount(0)

      await waitForDiceReveal(page)
      await expect(ownerStatValue('Str')).toHaveText(/\d+/, {
        timeout: 5_000
      })
      const rolledStr = (await ownerStatValue('Str').textContent()) ?? ''
      await expect(spectatorStatValue('Str')).toHaveText(rolledStr, {
        timeout: 5_000
      })

      await spectator.reload({ waitUntil: 'domcontentloaded' })
      await openOrExpectFollowedCreation(spectator, characterName)
      await expect(spectatorStatValue('Str')).toHaveText(rolledStr, {
        timeout: 5_000
      })

      for (const stat of ['Dex', 'End', 'Int', 'Edu'] as const) {
        await page.getByRole('button', { name: `Roll ${stat}` }).click()
        await waitForDiceReveal(page)
        await expect(ownerStatValue(stat)).toHaveText(/\d+/, {
          timeout: 5_000
        })
        const rolledValue = (await ownerStatValue(stat).textContent()) ?? ''
        await expect(spectatorStatValue(stat)).toHaveText(rolledValue, {
          timeout: 5_000
        })
      }

      await page.getByRole('button', { name: 'Roll Soc' }).click()
      await expect(spectator.locator('#diceOverlay.visible')).toBeVisible({
        timeout: 5_000
      })
      await expectDiceRollPending(spectator)
      await expect(spectator.locator('#characterCreationFields')).not.toContainText(
        'Homeworld',
        { timeout: 100 }
      )

      await waitForDiceReveal(page)
      await expect(spectator.locator('#characterCreationFields')).toContainText(
        'Homeworld',
        { timeout: 5_000 }
      )
      const ownerCharacter = await fetchProjectedCharacter(
        page,
        roomId,
        actorId,
        characterId
      )
      const spectatorCharacter = await fetchProjectedCharacter(
        spectator,
        roomId,
        spectatorId,
        characterId,
        'spectator'
      )
      expect(spectatorCharacter?.characteristics?.soc).toBe(
        ownerCharacter?.characteristics?.soc
      )
      expect(spectatorCharacter?.creation?.state?.status).toBe('HOMEWORLD')

      await expectSpectatorRefreshPreservesCreationProjection({
        spectator,
        roomId,
        spectatorId,
        characterId,
        characterName
      })
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
      await expect(creatorSkillStrip(page)).toHaveText(
        'Admin-0, Slug Rifle-0, Zero-G-0'
      )
      await expect(creatorSkillStrip(spectator)).toHaveText(
        'Admin-0, Slug Rifle-0, Zero-G-0',
        { timeout: 5_000 }
      )
    } finally {
      await spectator.close()
    }
  })

  test('keeps rolled term cascade choices visible to spectators through refresh', async ({
    browser,
    page
  }) => {
    test.setTimeout(60_000)
    const roomId = await openUniqueRoom(page)
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
    await setSeedForNextRoll(
      page,
      roomId,
      await nextEventSeq(page, roomId, actorId),
      [6, 6]
    )
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'ResolveCharacterCreationQualification',
      characterId,
      career: 'Aerospace'
    })
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'CompleteCharacterCreationBasicTraining',
      characterId
    })
    await setSeedForNextRoll(
      page,
      roomId,
      await nextEventSeq(page, roomId, actorId),
      [6, 6]
    )
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'ResolveCharacterCreationSurvival',
      characterId
    })

    for (;;) {
      const legalKeys = await legalCreationActionKeys({
        page,
        roomId,
        actorId,
        characterId
      })
      if (legalKeys.includes('skipCommission')) {
        await postCommand(page, roomId, actorId, actorSession, {
          type: 'SkipCharacterCreationCommission',
          characterId
        })
        continue
      }
      if (legalKeys.includes('skipAdvancement')) {
        await postCommand(page, roomId, actorId, actorSession, {
          type: 'SkipCharacterCreationAdvancement',
          characterId
        })
        continue
      }
      break
    }

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('#boardCanvas')).toBeVisible()
    await page
      .locator('#creationPresenceDock .creation-presence-card')
      .filter({ hasText: characterName })
      .click()
    await expect(page.locator('#characterCreationFields')).toContainText(
      'Skills and training',
      { timeout: 5_000 }
    )

    const spectator = await browser.newPage()
    try {
      await openRoom(spectator, {
        roomId,
        userId: 'e2e-term-cascade-spectator',
        viewer: 'spectator'
      })
      await openOrExpectFollowedCreation(spectator, characterName)
      const spectatorFields = spectator.locator('#characterCreationFields')
      await expect(spectatorFields).not.toContainText('Choose a specialty', {
        timeout: 100
      })

      await setSeedForNextRoll(
        page,
        roomId,
        await nextEventSeq(page, roomId, actorId),
        [2]
      )
      const serviceSkills = page.getByRole('button', {
        name: 'Service skills'
      })
      const rollAccepted = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().includes(`/rooms/${roomId}/command`) &&
          (response.request().postData() ?? '').includes(
            'RollCharacterCreationTermSkill'
          )
      )
      await expect(serviceSkills).toBeVisible({ timeout: 5_000 })
      await serviceSkills.click()
      await expect((await rollAccepted).ok()).toBe(true)
      await expect(spectator.locator('#diceOverlay.visible')).toBeVisible({
        timeout: 5_000
      })
      await expect(spectatorFields).not.toContainText('Choose a specialty', {
        timeout: 100
      })

      await waitForDiceReveal(page)
      await expect(spectatorFields).toContainText('Choose a specialty', {
        timeout: 5_000
      })
      await expect(spectatorFields).toContainText('Gun Combat', {
        timeout: 5_000
      })
      await expect(spectatorFields).toContainText('Slug Rifle', {
        timeout: 5_000
      })

      const liveProjection = JSON.stringify(
        (
          await fetchProjectedCharacter(
            spectator,
            roomId,
            'e2e-term-cascade-spectator',
            characterId,
            'spectator'
          )
        )?.creation?.actionPlan?.cascadeSkillChoices ?? []
      )
      await spectator.reload({ waitUntil: 'domcontentloaded' })
      await expect(spectator.locator('#boardCanvas')).toBeVisible()
      await openOrExpectFollowedCreation(spectator, characterName)
      await expect(spectatorFields).toContainText('Choose a specialty', {
        timeout: 5_000
      })
      await expect
        .poll(async () =>
          JSON.stringify(
            (
              await fetchProjectedCharacter(
                spectator,
                roomId,
                'e2e-term-cascade-spectator',
                characterId,
                'spectator'
              )
            )?.creation?.actionPlan?.cascadeSkillChoices ?? []
          )
        )
        .toBe(liveProjection)

      const resolveAccepted = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().includes(`/rooms/${roomId}/command`) &&
          (response.request().postData() ?? '').includes(
            'ResolveCharacterCreationTermCascadeSkill'
          )
      )
      await page
        .locator('.creation-cascade-choice')
        .getByRole('button', { name: 'Slug Rifle' })
        .click()
      await expect((await resolveAccepted).ok()).toBe(true)
      await expect.poll(() => postedCommandTypes).toContain(
        'ResolveCharacterCreationTermCascadeSkill'
      )
      await expect(spectatorFields).not.toContainText('Choose a specialty', {
        timeout: 5_000
      })
      await expect(spectatorFields).toContainText('Slug Rifle-1', {
        timeout: 5_000
      })
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
      career: 'Merchant'
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
    await expectDiceRollPending(page)
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
    await expectDiceRollPending(page)
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
    const replacementCharacterId = restartedCreationIds.find(
      (id) => id !== characterId
    )
    expect(replacementCharacterId).toBeTruthy()
    const replacementCharacterName =
      (await page.locator('#characterCreatorTitle').textContent()) ?? ''

    await expect(deathCard).toHaveCount(0, { timeout: 5_000 })
    await expect(fields).toContainText('Characteristics', { timeout: 5_000 })
    await expect(
      fields.getByRole('button', { name: 'Roll Str' })
    ).toBeVisible()

    const restartedState = await fetchRoomState(page, roomId, actorId)
    expect(
      restartedState.state?.characters[characterId]?.creation?.state?.status
    ).toBe('DECEASED')
    expect(
      restartedState.state?.characters[replacementCharacterId ?? '']?.creation
        ?.state?.status
    ).toBe('CHARACTERISTICS')

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('#boardCanvas')).toBeVisible()
    await openOrExpectFollowedCreation(page, replacementCharacterName)
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
      await expectDiceRollPending(spectator)
      await expect(spectatorSurvivalRoll).toHaveValue('', { timeout: 100 })
      await expect(spectatorDeathCard).toHaveCount(0, { timeout: 100 })
      await expect(spectatorFields).not.toContainText(
        /Survival \d+|Killed in service|dead/i,
        { timeout: 100 }
      )

      await waitForDiceReveal(spectator)
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

  test('lets a spectator follow commission and advancement rolls without early reveal and recover after refresh', async ({
    browser,
    page
  }) => {
    test.setTimeout(60_000)
    const roomId = await openUniqueRoom(page)
    await setRoomSeed(page, roomId, 13_579)
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
      career: 'Merchant'
    })

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('#boardCanvas')).toBeVisible()
    await openOrExpectFollowedCreation(page, characterName)
    await resolveVisibleCascadeChoices(page)
    await page.getByRole('button', { name: 'Apply basic training' }).click()

    const rollSurvival = page.getByRole('button', { name: 'Roll survival' })
    await expect(rollSurvival).toBeVisible({ timeout: 5_000 })
    await rollSurvival.click()
    await waitForDiceReveal(page)

    const spectator = await browser.newPage()
    try {
      await openRoom(spectator, {
        roomId,
        userId: 'e2e-spectator',
        viewer: 'spectator'
      })
      await openOrExpectFollowedCreation(spectator, characterName)

      const projectedOutcomes: string[] = []
      const commissionOutcome = await rollCareerOutcomeWithSpectatorReveal({
        owner: page,
        spectator,
        roomId,
        actionName: 'Roll commission',
        commandType: 'ResolveCharacterCreationCommission',
        fieldName: 'commissionRoll',
        outcomePattern: /Commission \d+: (commissioned|not commissioned)/
      })
      if (commissionOutcome) projectedOutcomes.push(commissionOutcome)

      const advancementOutcome = await rollCareerOutcomeWithSpectatorReveal({
        owner: page,
        spectator,
        roomId,
        actionName: 'Roll advancement',
        commandType: 'ResolveCharacterCreationAdvancement',
        fieldName: 'advancementRoll',
        outcomePattern: /Advancement \d+: (advanced|held rank)/
      })
      if (advancementOutcome) projectedOutcomes.push(advancementOutcome)

      expect(projectedOutcomes.length).toBeGreaterThan(0)
      const finalProjectedOutcome = projectedOutcomes.at(-1) ?? ''

      await spectator.reload({ waitUntil: 'domcontentloaded' })
      await expect(spectator.locator('#boardCanvas')).toBeVisible()
      await openOrExpectFollowedCreation(spectator, characterName)
      const refreshedOutcome = spectator.locator(
        '#characterCreationFields .creation-career-outcome'
      )
      await expect
        .poll(() => normalizedText(refreshedOutcome))
        .toBe(finalProjectedOutcome)
    } finally {
      await spectator.close()
    }
  })

  test('lets spectators reload and join a term skill roll without early reveal and recover after refresh', async ({
    browser,
    page
  }) => {
    test.setTimeout(60_000)
    const roomId = await openUniqueRoom(page)
    await setRoomSeed(page, roomId, 13_579)
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
      career: 'Merchant'
    })

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('#boardCanvas')).toBeVisible()
    await openOrExpectFollowedCreation(page, characterName)
    await resolveVisibleCascadeChoices(page)
    await page.getByRole('button', { name: 'Apply basic training' }).click()

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

    const fields = page.locator('#characterCreationFields')
    await expect(fields).toContainText('Skills and training', {
      timeout: 5_000
    })

    const spectatorId = 'e2e-spectator'
    const lateSpectatorId = 'e2e-term-skill-late-spectator'
    const spectator = await browser.newPage()
    const lateSpectator = await browser.newPage()
    try {
      await openRoom(spectator, {
        roomId,
        userId: spectatorId,
        viewer: 'spectator'
      })
      await openOrExpectFollowedCreation(spectator, characterName)

      const spectatorFields = spectator.locator('#characterCreationFields')
      const spectatorTermSkillRolls = spectatorFields.locator(
        '.creation-term-skill-rolls span'
      )
      const spectatorServiceSkills = spectatorFields
        .locator('.creation-term-actions')
        .getByRole('button', { name: 'Service skills' })
      const termSkillPattern =
        /\d+ on (personalDevelopment|serviceSkills|specialistSkills|advancedEducation)/
      const expectRedactedTermSkillState = (
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

      await expect(spectatorFields).toContainText('Skills and training', {
        timeout: 5_000
      })
      await expect(spectatorServiceSkills).toBeDisabled()
      await expect(spectatorTermSkillRolls).toHaveCount(0)
      await expect(spectatorFields).not.toContainText(termSkillPattern, {
        timeout: 100
      })

      const ownerServiceSkills = fields
        .locator('.creation-term-actions')
        .getByRole('button', { name: 'Service skills' })
      const termSkillAccepted = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().includes(`/rooms/${roomId}/command`) &&
          (response.request().postData() ?? '').includes(
            'RollCharacterCreationTermSkill'
          )
      )
      await expect(ownerServiceSkills).toBeVisible({ timeout: 5_000 })
      await ownerServiceSkills.click()
      await expect((await termSkillAccepted).ok()).toBe(true)

      await expect(spectator.locator('#diceOverlay.visible')).toBeVisible({
        timeout: 5_000
      })
      await expectDiceRollPending(spectator)
      await expect(spectatorTermSkillRolls).toHaveCount(0, { timeout: 100 })
      await expect(spectatorFields).not.toContainText(termSkillPattern, {
        timeout: 100
      })

      const waitForSpectatorState = async (
        spectatorPage: Page,
        userId: string
      ): Promise<RoomStateMessage> => {
        const response = await spectatorPage.waitForResponse((candidate) => {
          const url = new URL(candidate.url())
          return (
            candidate.request().method() === 'GET' &&
            url.pathname === `/rooms/${roomId}/state` &&
            url.searchParams.get('viewer') === 'spectator' &&
            url.searchParams.get('user') === userId
          )
        })
        return (await response.json()) as RoomStateMessage
      }
      const reloadedState = waitForSpectatorState(spectator, spectatorId)
      const joinedState = waitForSpectatorState(lateSpectator, lateSpectatorId)

      await Promise.all([
        spectator.reload({ waitUntil: 'domcontentloaded' }),
        openRoom(lateSpectator, {
          roomId,
          userId: lateSpectatorId,
          viewer: 'spectator'
        })
      ])
      const [reloadState, joinState] = await Promise.all([
        reloadedState,
        joinedState
      ])
      expectRedactedTermSkillState(reloadState)
      expectRedactedTermSkillState(joinState)

      await expect(spectator.locator('#boardCanvas')).toBeVisible()
      await openOrExpectFollowedCreation(spectator, characterName)
      await openOrExpectFollowedCreation(lateSpectator, characterName)
      const lateSpectatorFields = lateSpectator.locator(
        '#characterCreationFields'
      )
      const lateSpectatorTermSkillRolls = lateSpectatorFields.locator(
        '.creation-term-skill-rolls span'
      )

      await waitForDiceReveal(page)

      let termSkill: ProjectedTermSkill | null = null
      await expect
        .poll(async () => {
          termSkill = await latestProjectedTermSkill(
            page,
            roomId,
            actorId,
            characterId
          )
          return termSkill
        })
        .not.toBeNull()
      if (!termSkill) throw new Error('Term skill was not projected')

      await expect(spectatorTermSkillRolls).toHaveCount(1, {
        timeout: 5_000
      })
      await expect(spectatorTermSkillRolls.first()).toContainText(
        termSkill.skill
      )
      await expect(spectatorTermSkillRolls.first()).toContainText(
        `${termSkill.tableRoll} on ${termSkill.table}`
      )
      await expect(lateSpectatorTermSkillRolls).toHaveCount(1, {
        timeout: 5_000
      })
      await expect(lateSpectatorTermSkillRolls.first()).toContainText(
        termSkill.skill
      )
      await expect(lateSpectatorTermSkillRolls.first()).toContainText(
        `${termSkill.tableRoll} on ${termSkill.table}`
      )

      await spectator.reload({ waitUntil: 'domcontentloaded' })
      await expect(spectator.locator('#boardCanvas')).toBeVisible()
      await openOrExpectFollowedCreation(spectator, characterName)
      await expect(spectatorTermSkillRolls).toHaveCount(1, {
        timeout: 5_000
      })
      await expect(spectatorTermSkillRolls.first()).toContainText(
        termSkill.skill
      )
      await expect(spectatorTermSkillRolls.first()).toContainText(
        `${termSkill.tableRoll} on ${termSkill.table}`
      )
      await expect
        .poll(() =>
          latestProjectedTermSkill(
            spectator,
            roomId,
            spectatorId,
            characterId
          )
        )
        .toEqual(termSkill)
    } finally {
      await spectator.close()
      await lateSpectator.close()
    }
  })

  test('requires two projected term skill rolls for careers without promotion checks', async ({
    page
  }) => {
    test.setTimeout(60_000)
    const roomId = await openUniqueRoom(page)
    await setRoomSeed(page, roomId, 13_579)
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

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('#boardCanvas')).toBeVisible()
    await openOrExpectFollowedCreation(page, characterName)

    await setSeedForNextRoll(
      page,
      roomId,
      await nextEventSeq(page, roomId, actorId),
      [3, 3]
    )
    const scoutCareer = characterCreationCareerButton(page, 'Scout')
    await expect(scoutCareer).toBeVisible({ timeout: 5_000 })
    await scoutCareer.click()
    await waitForDiceReveal(page)

    await resolveVisibleCascadeChoices(page)
    await page.getByRole('button', { name: 'Apply basic training' }).click()

    await setSeedForNextRoll(
      page,
      roomId,
      await nextEventSeq(page, roomId, actorId),
      [4, 4]
    )
    const rollSurvival = page.getByRole('button', { name: 'Roll survival' })
    await expect(rollSurvival).toBeVisible({ timeout: 5_000 })
    await rollSurvival.click()
    await waitForDiceReveal(page)

    const fields = page.locator('#characterCreationFields')
    const progress = fields.locator('.creation-term-skill-progress')
    const serviceSkills = fields
      .locator('.creation-term-actions')
      .getByRole('button', { name: 'Service skills' })

    await expect(fields).toContainText('Skills and training', {
      timeout: 5_000
    })
    await expect(progress).toHaveText('0/2 rolled')
    await expect(page.getByRole('button', { name: 'Roll aging' })).toHaveCount(
      0
    )
    await expect(
      page.getByRole('button', { name: 'Roll reenlistment' })
    ).toHaveCount(0)

    await setSeedForNextRoll(
      page,
      roomId,
      await nextEventSeq(page, roomId, actorId),
      [1]
    )
    await expect(serviceSkills).toBeVisible({ timeout: 5_000 })
    await serviceSkills.click()
    await waitForDiceReveal(page)

    await expect(progress).toHaveText('1/2 rolled', { timeout: 5_000 })
    await expect(fields.locator('.creation-term-skill-rolls span')).toHaveCount(
      1
    )
    await expect(page.getByRole('button', { name: 'Roll aging' })).toHaveCount(
      0
    )
    await expect(
      page.getByRole('button', { name: 'Roll reenlistment' })
    ).toHaveCount(0)
    await expect
      .poll(async () => {
        const character = await fetchProjectedCharacter(
          page,
          roomId,
          actorId,
          characterId
        )
        return character?.creation?.state?.status
      })
      .toBe('SKILLS_TRAINING')

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('#boardCanvas')).toBeVisible()
    await openOrExpectFollowedCreation(page, characterName)
    await expect(progress).toHaveText('1/2 rolled', { timeout: 5_000 })
    await expect(fields.locator('.creation-term-skill-rolls span')).toHaveCount(
      1
    )
    await expect(serviceSkills).toBeVisible({ timeout: 5_000 })

    await setSeedForNextRoll(
      page,
      roomId,
      await nextEventSeq(page, roomId, actorId),
      [2]
    )
    await serviceSkills.click()
    await waitForDiceReveal(page)

    await expect(fields).toContainText(/Anagathics|Roll aging/, {
      timeout: 5_000
    })
    await expect
      .poll(async () => {
        const character = await fetchProjectedCharacter(
          page,
          roomId,
          actorId,
          characterId
        )
        return {
          status: character?.creation?.state?.status,
          skillCount: projectedTermSkillCount(character?.creation)
        }
      })
      .toEqual({ status: 'AGING', skillCount: 2 })
  })

  test('lets a spectator follow mustering finalization and recover the projected sheet after refresh', async ({
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
    await openOrExpectFollowedCreation(page, characterName)

    await resolveVisibleCascadeChoices(page)
    await page.getByRole('button', { name: 'Apply basic training' }).click()

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

    const ownerFields = page.locator('#characterCreationFields')
    await expect(ownerFields).toContainText('Skills and training', {
      timeout: 5_000
    })

    await completeProjectedTermSkills({
      page,
      roomId,
      actorId,
      actorSession,
      characterId
    })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('#boardCanvas')).toBeVisible()
    await openOrExpectFollowedCreation(page, characterName)

    await expect(ownerFields).toContainText('Anagathics', {
      timeout: 5_000
    })
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'DecideCharacterCreationAnagathics',
      characterId,
      useAnagathics: false
    })

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('#boardCanvas')).toBeVisible()
    await openOrExpectFollowedCreation(page, characterName)
    await expect(ownerFields).toContainText(/Roll aging|Roll reenlistment/, {
      timeout: 15_000
    })

    const rollAging = page.getByRole('button', { name: 'Roll aging' })
    if (await rollAging.isVisible().catch(() => false)) {
      await rollAging.click()
      await waitForDiceReveal(page)
      for (let index = 0; index < 4; index += 1) {
        const agingChoice = page.locator('.creation-term-actions button').first()
        if (
          (await agingChoice.count()) === 0 ||
          !(await agingChoice.isVisible())
        ) {
          break
        }
        await agingChoice.click()
      }
    }

    const rollReenlistment = page.getByRole('button', {
      name: 'Roll reenlistment'
    })
    await expect(rollReenlistment).toBeVisible({ timeout: 15_000 })
    await rollReenlistment.click()
    await waitForDiceReveal(page)

    const musterOut = page.getByRole('button', { name: 'Muster out' })
    await expect(musterOut).toBeVisible({ timeout: 5_000 })
    await musterOut.click()
    await expectMusteringEquipmentStep(ownerFields)

    const spectator = await browser.newPage()
    try {
      await openRoom(spectator, {
        roomId,
        userId: 'e2e-finalizing-spectator',
        viewer: 'spectator'
      })
      await openOrExpectFollowedCreation(spectator, characterName)

      const spectatorFields = spectator.locator('#characterCreationFields')
      const spectatorBenefitList = spectatorFields.locator(
        '.creation-benefit-card'
      )
      const spectatorActivityFeed = spectator.locator('#creationActivityFeed')
      const projectedMusteringBenefit = async () => {
        const character = await fetchProjectedCharacter(
          spectator,
          roomId,
          'e2e-finalizing-spectator',
          characterId,
          'spectator'
        )
        return (
          projectedMusteringBenefits(character?.creation).find(
            (benefit) =>
              benefit.career === 'Merchant' && benefit.kind === 'cash'
          ) ?? null
        )
      }

      const rollCashBenefit = page.getByRole('button', { name: 'Roll cash' })
      await expect(rollCashBenefit).toBeVisible({ timeout: 5_000 })
      await expect(spectatorBenefitList).toHaveCount(0)
      await expect(spectatorFields).not.toContainText(/Merchant Cash.*Cr\d+/s, {
        timeout: 100
      })

      const benefitAccepted = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().includes(`/rooms/${roomId}/command`) &&
          (response.request().postData() ?? '').includes(
            'RollCharacterCreationMusteringBenefit'
          )
      )
      await rollCashBenefit.click()
      await expect((await benefitAccepted).ok()).toBe(true)

      await expect(spectator.locator('#diceOverlay.visible')).toBeVisible({
        timeout: 5_000
      })
      await expectDiceRollPending(spectator)
      await expect(spectatorBenefitList).toHaveCount(0, { timeout: 100 })
      await expect(spectatorFields).not.toContainText(/Merchant Cash.*Cr\d+/s, {
        timeout: 100
      })

      await waitForDiceReveal(page)
      await expect(spectator.locator('#diceStage .roll-total')).not.toHaveText(
        'Rolling...',
        { timeout: 5_000 }
      )

      const projectedBenefit = await projectedMusteringBenefit()
      if (!projectedBenefit) {
        throw new Error('Mustering benefit was not projected')
      }
      const cashCredits = Number(projectedBenefit.value)
      expect(cashCredits).toBeGreaterThan(0)
      await expect(spectatorFields).toContainText('Merchant Cash', {
        timeout: 5_000
      })
      await expect(spectatorFields).toContainText(
        `Cr${projectedBenefit.value}`,
        { timeout: 5_000 }
      )
      await expect(spectatorFields).toContainText(
        `Roll ${projectedBenefit.roll.total}`,
        { timeout: 5_000 }
      )

      await postCommand(page, roomId, actorId, actorSession, {
        type: 'CompleteCharacterCreationMustering',
        characterId
      })
      postedCommandTypes.push('CompleteCharacterCreationMustering')

      await expect
        .poll(async () => {
          const character = await fetchProjectedCharacter(
            spectator,
            roomId,
            'e2e-finalizing-spectator',
            characterId,
            'spectator'
          )
          return character?.creation?.state?.status
        })
        .toBe('ACTIVE')

      await postCommand(page, roomId, actorId, actorSession, {
        type: 'FinalizeCharacterCreation',
        characterId
      })
      postedCommandTypes.push('FinalizeCharacterCreation')

      await expect.poll(() => postedCommandTypes).toContain(
        'CompleteCharacterCreationMustering'
      )
      await expect.poll(() => postedCommandTypes).toContain(
        'FinalizeCharacterCreation'
      )
      await expect(spectatorActivityFeed).toContainText(
        'Character finalized',
        { timeout: 5_000 }
      )

      const projectedFinalizedSheet = async () => {
        const character = await fetchProjectedCharacter(
          spectator,
          roomId,
          'e2e-finalizing-spectator',
          characterId,
          'spectator'
        )
        if (!character) return null
        return {
          status: character.creation?.state?.status,
          creationComplete: character.creation?.creationComplete,
          credits: character.credits,
          notes: character.notes,
          skillCount: character.skills?.length ?? 0,
          equipmentCount: character.equipment?.length ?? 0
        }
      }

      await expect.poll(projectedFinalizedSheet).toMatchObject({
        status: 'PLAYABLE',
        creationComplete: true,
        credits: cashCredits,
        equipmentCount: 0
      })
      const liveSheet = await projectedFinalizedSheet()
      if (!liveSheet) throw new Error('Finalized sheet was not projected')
      expect(liveSheet.notes).toContain('Rules source: Cepheus Engine SRD.')
      expect(liveSheet.notes).toContain('Term 1: Merchant, survived.')
      expect(liveSheet.skillCount).toBeGreaterThan(0)

      await spectator.reload({ waitUntil: 'domcontentloaded' })
      await expect(spectator.locator('#boardCanvas')).toBeVisible()
      await expect.poll(projectedFinalizedSheet).toEqual(liveSheet)
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

    let termSkillSpectator = await browser.newPage()
    try {
      await openRoom(termSkillSpectator, {
        roomId,
        userId: 'e2e-term-refresh-spectator',
        viewer: 'spectator'
      })
      await openOrExpectFollowedCreation(termSkillSpectator, characterName)

      const spectatorFields = termSkillSpectator.locator(
        '#characterCreationFields'
      )
      const spectatorTermSkillRolls = () =>
        termSkillSpectator
          .locator('#characterCreationFields')
          .locator('.creation-term-skill-rolls span')
      const termSkillPattern =
        /\d+ on (personalDevelopment|serviceSkills|specialistSkills|advancedEducation)/
      const expectTermSkillRecovered = async (
        spectatorPage: Page,
        termSkill: ProjectedTermSkill
      ): Promise<void> => {
        const recoveredFields = spectatorPage.locator(
          '#characterCreationFields'
        )
        const recoveredRolls = recoveredFields.locator(
          '.creation-term-skill-rolls span'
        )

        await expect
          .poll(() =>
            latestProjectedTermSkill(
              spectatorPage,
              roomId,
              'e2e-term-refresh-spectator',
              characterId
            )
          )
          .toEqual(termSkill)
        if ((await recoveredRolls.count()) > 0) {
          await expect(recoveredRolls.first()).toContainText(termSkill.skill)
          await expect(recoveredRolls.first()).toContainText(
            `${termSkill.tableRoll} on ${termSkill.table}`
          )
          return
        }
        await expect(creatorSkillStrip(spectatorPage)).toContainText(
          termSkill.skill,
          { timeout: 5_000 }
        )
      }

      await expect(spectatorFields).toContainText('Skills and training', {
        timeout: 5_000
      })
      await expect(spectatorTermSkillRolls()).toHaveCount(0)
      await expect(spectatorFields).not.toContainText(termSkillPattern, {
        timeout: 100
      })

      const previousTermSkillCount = projectedTermSkillCount(
        (await fetchRoomState(page, roomId, actorId)).state?.characters[
          characterId
        ]?.creation
      )
      const termSkillTable = page
        .locator('#characterCreationFields button:not([disabled])')
        .filter({
          hasText:
            /Personal development|Service skills|Specialist skills|Advanced education/
        })
        .first()
      const termSkillAccepted = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().includes(`/rooms/${roomId}/command`) &&
          (response.request().postData() ?? '').includes(
            'RollCharacterCreationTermSkill'
          )
      )
      await expect(termSkillTable).toBeVisible({ timeout: 5_000 })
      await termSkillTable.click()
      await expect((await termSkillAccepted).ok()).toBe(true)

      await expect(
        termSkillSpectator.locator('#diceOverlay.visible')
      ).toBeVisible({ timeout: 5_000 })
      await expectDiceRollPending(termSkillSpectator)
      await expect(spectatorTermSkillRolls()).toHaveCount(0, { timeout: 100 })
      await expect(spectatorFields).not.toContainText(termSkillPattern, {
        timeout: 100
      })

      await waitForDiceReveal(page)
      await expect(
        termSkillSpectator.locator('#diceStage .roll-total')
      ).not.toHaveText('Rolling...', { timeout: 5_000 })

      let termSkill: ProjectedTermSkill | null = null
      await expect
        .poll(async () => {
          const message = await fetchRoomState(page, roomId, actorId)
          const termSkillCount = projectedTermSkillCount(
            message.state?.characters[characterId]?.creation
          )
          termSkill = await latestProjectedTermSkill(
            page,
            roomId,
            actorId,
            characterId
          )
          return termSkill && termSkillCount > previousTermSkillCount
            ? termSkill
            : null
        })
        .not.toBeNull()
      if (!termSkill) throw new Error('Term skill was not projected')

      await expectTermSkillRecovered(termSkillSpectator, termSkill)

      await termSkillSpectator.reload({ waitUntil: 'domcontentloaded' })
      await expect(termSkillSpectator.locator('#boardCanvas')).toBeVisible()
      await openOrExpectFollowedCreation(termSkillSpectator, characterName)
      await expectTermSkillRecovered(termSkillSpectator, termSkill)

      await termSkillSpectator.close()
      termSkillSpectator = await browser.newPage()
      await openRoom(termSkillSpectator, {
        roomId,
        userId: 'e2e-term-refresh-spectator',
        viewer: 'spectator'
      })
      await openOrExpectFollowedCreation(termSkillSpectator, characterName)
      await expectTermSkillRecovered(termSkillSpectator, termSkill)
      await resolveVisibleCascadeChoices(page)
    } finally {
      if (!termSkillSpectator.isClosed()) {
        await termSkillSpectator.close()
      }
    }

    await completeProjectedTermSkills({
      page,
      roomId,
      actorId,
      actorSession,
      characterId
    })

    const spectator = await browser.newPage()
    try {
      await openRoom(spectator, {
        roomId,
        userId: 'e2e-spectator',
        viewer: 'spectator'
      })
      await openOrExpectFollowedCreation(spectator, characterName)

      const spectatorFields = spectator.locator('#characterCreationFields')
      const spectatorReenlistmentOutcome = spectatorFields.locator(
        '.creation-term-resolution p'
      )
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
        await expectDiceRollPending(spectator)
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
      await expectDiceRollPending(spectator)
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
      const projectedReenlistmentOutcome = await normalizedText(
        spectatorReenlistmentOutcome
      )
      expect(projectedReenlistmentOutcome).toMatch(/Reenlistment \d+:/)

      await spectator.reload({ waitUntil: 'domcontentloaded' })
      await expect(spectator.locator('#boardCanvas')).toBeVisible()
      await openOrExpectFollowedCreation(spectator, characterName)
      await expect
        .poll(() => normalizedText(spectatorReenlistmentOutcome))
        .toBe(projectedReenlistmentOutcome)
    } finally {
      await spectator.close()
    }

    const musterOut = page.getByRole('button', { name: 'Muster out' })
    await expect(musterOut).toBeVisible({ timeout: 5_000 })
    const leaveCareerAccepted = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().includes(`/rooms/${roomId}/command`) &&
        (response.request().postData() ?? '').includes(
          'LeaveCharacterCreationCareer'
        )
    )
    await musterOut.click()
    await expect((await leaveCareerAccepted).ok()).toBe(true)

    await expect(page.locator('#characterCreationFields')).toContainText(
      /Mustering out|Equipment|benefit/i,
      { timeout: 5_000 }
    )

    const musteringSpectator = await browser.newPage()
    try {
      await openRoom(musteringSpectator, {
        roomId,
        userId: 'e2e-mustering-spectator',
        viewer: 'spectator'
      })
      await openOrExpectFollowedCreation(musteringSpectator, characterName)

      const spectatorFields = musteringSpectator.locator(
        '#characterCreationFields'
      )
      const spectatorBenefitList = spectatorFields.locator(
        '.creation-benefit-card'
      )
      const rollCashBenefit = page.getByRole('button', { name: 'Roll cash' })
      const spectatorActivityFeed = musteringSpectator.locator(
        '#creationActivityFeed'
      )
      const musteringBenefitFromProjection = async () => {
        const creation = (await fetchRoomState(
          musteringSpectator,
          roomId,
          'e2e-mustering-spectator'
        )).state?.characters[characterId]?.creation
        return (
          projectedMusteringBenefits(creation).find(
            (benefit) =>
              benefit.career === 'Merchant' && benefit.kind === 'cash'
          ) ?? null
        )
      }

      await expect(rollCashBenefit).toBeVisible({ timeout: 5_000 })
      await expect(spectatorFields).not.toContainText(/Merchant Cash.*Cr\d+/s, {
        timeout: 100
      })
      await expect(spectatorBenefitList).toHaveCount(0)
      await expect(spectatorActivityFeed).not.toContainText(
        /Mustering benefit|Merchant.*cash|table roll/i,
        { timeout: 100 }
      )

      const benefitAccepted = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().includes(`/rooms/${roomId}/command`) &&
          (response.request().postData() ?? '').includes(
            'RollCharacterCreationMusteringBenefit'
          )
      )
      await rollCashBenefit.click()
      await expect((await benefitAccepted).ok()).toBe(true)

      await expect(
        musteringSpectator.locator('#diceOverlay.visible')
      ).toBeVisible({ timeout: 5_000 })
      await expectDiceRollPending(musteringSpectator)
      await expect(spectatorFields).not.toContainText(/Merchant: cash \d+ ->/, {
        timeout: 100
      })
      await expect(spectatorBenefitList).toHaveCount(0, { timeout: 100 })
      await expect(spectatorActivityFeed).not.toContainText(
        /Mustering benefit|Merchant.*cash|table roll/i,
        { timeout: 100 }
      )

      await waitForDiceReveal(page)
      await expect(
        musteringSpectator.locator('#diceStage .roll-total')
      ).not.toHaveText('Rolling...', { timeout: 5_000 })

      const projectedBenefit = await musteringBenefitFromProjection()
      if (!projectedBenefit) {
        throw new Error('Mustering benefit was not projected')
      }
      await expect(spectatorFields).toContainText('Merchant Cash', {
        timeout: 5_000
      })
      await expect(spectatorFields).toContainText(
        `Cr${projectedBenefit.value}`,
        { timeout: 5_000 }
      )
      await expect(spectatorFields).toContainText(
        `Roll ${projectedBenefit.roll.total}`,
        { timeout: 5_000 }
      )
      await expectSpectatorRefreshPreservesCreationProjection({
        spectator: musteringSpectator,
        roomId,
        spectatorId: 'e2e-mustering-spectator',
        characterId,
        characterName
      })
      await expect
        .poll(async () => musteringBenefitFromProjection())
        .toEqual(projectedBenefit)
    } finally {
      await musteringSpectator.close()
    }

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
      ).toContainText(/Skills|Scout|Review the skill list/, {
        timeout: 5_000
      })
    } finally {
      await secondCareerSpectator.close()
    }

    const secondTermSpectatorId = 'e2e-second-term-spectator'
    const secondTermSpectator = await browser.newPage()
    try {
      await openRoom(secondTermSpectator, {
        roomId,
        userId: secondTermSpectatorId,
        viewer: 'spectator'
      })
      await openOrExpectFollowedCreation(secondTermSpectator, characterName)

      const spectatorFields = secondTermSpectator.locator(
        '#characterCreationFields'
      )

      await expect(spectatorFields).toContainText(/Skills|Review the skill list/, {
        timeout: 5_000
      })
      await expect
        .poll(async () => {
          const state = await fetchRoomState(
            secondTermSpectator,
            roomId,
            secondTermSpectatorId
          )
          return state.state?.characters[characterId]?.creation?.terms.map(
            (term) => term.career
          )
        })
        .toEqual(['Merchant', 'Scout'])
      await expectSpectatorRefreshPreservesCreationProjection({
        spectator: secondTermSpectator,
        roomId,
        spectatorId: secondTermSpectatorId,
        characterId,
        characterName
      })
      await expect
        .poll(async () => {
          const state = await fetchRoomState(
            secondTermSpectator,
            roomId,
            secondTermSpectatorId
          )
          return state.state?.characters[characterId]?.creation?.terms.map(
            (term) => term.career
          )
        })
        .toEqual(['Merchant', 'Scout'])
    } finally {
      await secondTermSpectator.close()
    }

    const finalizationSpectatorId = 'e2e-finalization-spectator'
    const finalizationSpectator = await browser.newPage()
    try {
      await openRoom(finalizationSpectator, {
        roomId,
        userId: finalizationSpectatorId,
        viewer: 'spectator'
      })
      await openOrExpectFollowedCreation(finalizationSpectator, characterName)

      await completeSecondScoutTermAndFinalize({
        page,
        roomId,
        actorId,
        actorSession,
        characterId
      })

      await expect(
        finalizationSpectator.locator('#creationActivityFeed')
      ).toContainText('Character finalized', { timeout: 5_000 })

      const projectedFinalizedSheet = async () => {
        const character = await fetchProjectedCharacter(
          finalizationSpectator,
          roomId,
          finalizationSpectatorId,
          characterId,
          'spectator'
        )
        if (!character) return null
        return {
          status: character.creation?.state?.status,
          creationComplete: character.creation?.creationComplete,
          terms: character.creation?.terms?.map((term) => term.career) ?? [],
          notes: character.notes ?? '',
          skillCount: character.skills?.length ?? 0
        }
      }

      await expect.poll(projectedFinalizedSheet).toMatchObject({
        status: 'PLAYABLE',
        creationComplete: true,
        terms: ['Merchant', 'Scout']
      })
      const liveSheet = await projectedFinalizedSheet()
      if (!liveSheet) throw new Error('Finalized sheet was not projected')
      expect(liveSheet.notes).toContain('Term 1: Merchant')
      expect(liveSheet.notes).toContain('Term 2: Scout')
      expect(liveSheet.skillCount).toBeGreaterThan(0)

      await finalizationSpectator.reload({ waitUntil: 'domcontentloaded' })
      await expect(finalizationSpectator.locator('#boardCanvas')).toBeVisible()
      await expect.poll(projectedFinalizedSheet).toEqual(liveSheet)
    } finally {
      await finalizationSpectator.close()
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

  test('keeps spectator follow cards usable at phone width', async ({
    browser,
    page
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const roomId = await openUniqueRoom(page)
    await setRoomSeed(page, roomId, 13_579)
    const actorId = actorIdFromPage(page)
    const actorSession = await actorSessionFromPage(page, roomId, actorId)

    await page.locator('#createCharacterRailButton').click()
    const firstCharacterName =
      (await page.locator('#characterCreatorTitle').textContent()) ?? ''
    await activeCreationCharacterId(page, roomId, actorId)

    const secondCharacterId = 'mobile-follow-card-second'
    const secondCharacterName = 'Mobile Follow Card Second'
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'CreateCharacter',
      characterId: secondCharacterId,
      characterType: 'PLAYER',
      name: secondCharacterName
    })
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'StartCharacterCreation',
      characterId: secondCharacterId
    })

    const spectator = await browser.newPage()
    try {
      await spectator.setViewportSize({ width: 390, height: 844 })
      await openRoom(spectator, {
        roomId,
        userId: 'e2e-mobile-follow-spectator',
        viewer: 'player'
      })

      const dock = spectator.locator('#creationPresenceDock')
      const cards = dock.locator('.creation-presence-card')
      const firstCard = cards.filter({ hasText: firstCharacterName })
      const secondCard = cards.filter({ hasText: secondCharacterName })

      await expect(dock).toBeVisible({ timeout: 5_000 })
      await expect(cards).toHaveCount(2)
      await expect(firstCard).toContainText(firstCharacterName)
      await expect(firstCard).toContainText(/stats · \d+ terms/)
      await expect(secondCard).toContainText(secondCharacterName)
      await expect(secondCard).toContainText(/stats · \d+ terms/)
      await expect
        .poll(() =>
          visibleHorizontalOverflow(
            spectator,
            [
              '#creationPresenceDock',
              '#creationPresenceDock .creation-presence-heading',
              '#creationPresenceDock .creation-presence-clear',
              '#creationPresenceDock .creation-presence-card',
              '#creationPresenceDock .creation-presence-card *'
            ].join(',')
          )
        )
        .toEqual([])

      await expectMobileControlUsable(firstCard, 'Spectator follow card')
      await firstCard.click()
      await expect(
        spectator.getByRole('complementary', { name: 'Character creator' })
      ).toBeVisible({ timeout: 5_000 })
      await expect(spectator.locator('#characterCreationFields')).toContainText(
        'Characteristics',
        { timeout: 5_000 }
      )
      await expectMobileCreatorControlsFit(spectator)
    } finally {
      await spectator.close()
    }
  })

  test('keeps term skill controls usable at phone width', async ({ page }) => {
    test.setTimeout(60_000)
    await page.setViewportSize({ width: 390, height: 844 })
    const roomId = await openUniqueRoom(page)
    await setRoomSeed(page, roomId, 13_579)
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
      career: 'Merchant'
    })

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('#boardCanvas')).toBeVisible()
    await openOrExpectFollowedCreation(page, characterName)
    await resolveVisibleCascadeChoices(page)

    const applyBasicTraining = page.getByRole('button', {
      name: 'Apply basic training'
    })
    await expectMobileControlUsable(applyBasicTraining, 'Apply basic training')
    await applyBasicTraining.click()

    const rollSurvival = page.getByRole('button', { name: 'Roll survival' })
    await expectMobileControlUsable(rollSurvival, 'Roll survival')
    await rollSurvival.click()
    await waitForDiceReveal(page)

    for (const actionName of ['Roll commission', 'Roll advancement']) {
      const action = page.getByRole('button', { name: actionName })
      if (await action.isVisible().catch(() => false)) {
        await expectMobileControlUsable(action, actionName)
        await action.click()
        await waitForDiceReveal(page)
      }
    }

    const fields = page.locator('#characterCreationFields')
    await expect(fields).toContainText('Skills and training', {
      timeout: 5_000
    })
    await expect(creatorSkillStrip(page)).toContainText('Admin-0')
    await expect(creatorSkillStrip(page)).toContainText('Gun Combat-0')
    await expect(creatorSkillStrip(page)).toContainText('Slug Rifle-0')
    await expectMobileCreatorControlsFit(page)

    const termSkillButtons = fields.locator(
      '.creation-term-actions button:not([disabled])'
    )
    const cascadeButtons = fields.locator('.creation-cascade-choice button')
    const activeLateControls = fields.locator(
      '.creation-term-actions button:not([disabled]), .creation-cascade-choice button'
    )
    await expect
      .poll(() => activeLateControls.count())
      .toBeGreaterThanOrEqual(1)

    const controlCount = Math.min(await activeLateControls.count(), 3)
    for (let index = 0; index < controlCount; index += 1) {
      await expectMobileControlUsable(
        activeLateControls.nth(index),
        `Late creator control ${index + 1}`
      )
    }

    if ((await termSkillButtons.count()) > 0) {
      await termSkillButtons.first().click()
      await waitForDiceReveal(page)
    }
    if ((await cascadeButtons.count()) > 0) {
      const pendingCascadeSkill = (
        await fields.locator('.creation-cascade-choice strong').last().textContent()
      )?.trim()
      if (pendingCascadeSkill) {
        await expect(creatorSkillStrip(page)).not.toContainText(
          pendingCascadeSkill
        )
      }
    }
    await resolveVisibleCascadeChoices(page)
    const rolledTermSkills = fields.locator('.creation-term-skill-rolls span')
    if (await rolledTermSkills.first().isVisible().catch(() => false)) {
      await expect(rolledTermSkills).toHaveCount(1, { timeout: 5_000 })
    } else {
      await expect(fields).toContainText(
        /Anagathics|Roll aging|Roll reenlistment|Muster out/,
        { timeout: 5_000 }
      )
    }
    await expectMobileCreatorControlsFit(page)
    if ((await cascadeButtons.count()) > 0) {
      await expectMobileControlUsable(cascadeButtons.first(), 'Cascade choice')
    }
  })

  test('keeps reenlistment controls usable at phone width', async ({
    page
  }) => {
    test.setTimeout(60_000)
    await page.setViewportSize({ width: 390, height: 844 })
    const roomId = await openUniqueRoom(page)
    await setRoomSeed(page, roomId, 5)
    const actorId = actorIdFromPage(page)
    const actorSession = await actorSessionFromPage(page, roomId, actorId)
    const context: RepeatTravellerContext & { characterId: string } = {
      label: 'mobile-reenlistment',
      seed: 5,
      characterId: '',
      phase: 'setup',
      action: 'not started',
      commandTypes: [],
      consoleErrors: [],
      serverResponses: []
    }

    await page.locator('#createCharacterRailButton').click()
    const characterName =
      (await page.locator('#characterCreatorTitle').textContent()) ?? ''
    context.characterId = await activeCreationCharacterId(
      page,
      roomId,
      actorId
    )

    await seedCreationToReenlistmentDecision(page, {
      roomId,
      actorId,
      actorSession,
      context
    })

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('#boardCanvas')).toBeVisible()
    await openOrExpectFollowedCreation(page, characterName)

    const fields = page.locator('#characterCreationFields')
    await expect(fields).toContainText('Roll reenlistment', {
      timeout: 15_000
    })
    await expectMobileCreatorControlsFit(page)

    const rollReenlistment = page.getByRole('button', {
      name: 'Roll reenlistment'
    })
    await expectMobileControlUsable(rollReenlistment, 'Roll reenlistment')
    await setSeedForNextRoll(
      page,
      roomId,
      await nextEventSeq(page, roomId, actorId),
      [4, 4]
    )
    await rollReenlistment.click()
    await waitForDiceReveal(page)

    await expect(fields).toContainText(/Reenlistment \d+:/, {
      timeout: 5_000
    })
    await expectMobileCreatorControlsFit(page)

    const termDecisionButtons = fields.locator(
      '.creation-term-resolution .creation-term-actions button:not([disabled])'
    )
    await expect
      .poll(() => termDecisionButtons.count())
      .toBeGreaterThanOrEqual(1)

    const decisionCount = Math.min(await termDecisionButtons.count(), 2)
    for (let index = 0; index < decisionCount; index += 1) {
      await expectMobileControlUsable(
        termDecisionButtons.nth(index),
        `Reenlistment decision ${index + 1}`
      )
    }
    await expectMobileControlUsable(
      page.getByRole('button', { name: 'Muster out' }),
      'Muster out after reenlistment'
    )

    const serveAnotherTerm = page.getByRole('button', {
      name: 'Serve another term'
    })
    await expectMobileControlUsable(
      serveAnotherTerm,
      'Serve another term after reenlistment'
    )
    const reenlisted = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().includes(`/rooms/${roomId}/command`) &&
        (response.request().postData() ?? '').includes(
          'ReenlistCharacterCreationCareer'
        )
    )
    await serveAnotherTerm.click()
    await expect((await reenlisted).ok()).toBe(true)
    await expect(fields).toContainText('Roll survival', { timeout: 5_000 })
    await expect(fields).not.toContainText('Roll reenlistment')
    await expectMobileCreatorControlsFit(page)

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('#boardCanvas')).toBeVisible()
    await openOrExpectFollowedCreation(page, characterName)
    await expect(fields).toContainText('Roll survival', { timeout: 15_000 })
    await expectMobileCreatorControlsFit(page)
  })

  test('keeps mustering out controls usable at phone width', async ({
    page
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const roomId = await openUniqueRoom(page)
    await setRoomSeed(page, roomId, 5)
    const actorId = actorIdFromPage(page)
    const actorSession = await actorSessionFromPage(page, roomId, actorId)
    const context: RepeatTravellerContext = {
      label: 'mobile-mustering',
      seed: 5,
      phase: 'setup',
      action: 'not started',
      commandTypes: [],
      consoleErrors: [],
      serverResponses: []
    }

    await page.locator('#createCharacterRailButton').click()
    const characterName =
      (await page.locator('#characterCreatorTitle').textContent()) ?? ''
    context.characterId = await activeCreationCharacterId(page, roomId, actorId)

    await seedCreationToCareerSelection(page, {
      roomId,
      actorId,
      actorSession,
      characterId: context.characterId
    })
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'UpdateCharacterSheet',
      characterId: context.characterId,
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
      characterId: context.characterId,
      career: 'Scout'
    })
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'CompleteCharacterCreationBasicTraining',
      characterId: context.characterId
    })
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'ResolveCharacterCreationSurvival',
      characterId: context.characterId
    })
    await completeRepeatRequiredTermSkills(
      page,
      roomId,
      actorId,
      actorSession,
      context
    )
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'DecideCharacterCreationAnagathics',
      characterId: context.characterId,
      useAnagathics: false
    })
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'ResolveCharacterCreationAging',
      characterId: context.characterId
    })
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'ResolveCharacterCreationReenlistment',
      characterId: context.characterId
    })

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('#boardCanvas')).toBeVisible()
    await openOrExpectFollowedCreation(page, characterName)

    const fields = page.locator('#characterCreationFields')
    const musterOut = page.getByRole('button', { name: 'Muster out' })
    await expectMobileControlUsable(musterOut, 'Muster out')
    const leftCareer = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().includes(`/rooms/${roomId}/command`) &&
        (response.request().postData() ?? '').includes(
          'LeaveCharacterCreationCareer'
        )
    )
    await musterOut.click()
    await expect((await leftCareer).ok()).toBe(true)
    await expect
      .poll(async () => {
        const character = await fetchProjectedCharacter(
          page,
          roomId,
          actorId,
          context.characterId
        )
        return character?.creation?.state?.status
      })
      .toBe('MUSTERING_OUT')

    await expectMusteringEquipmentStep(fields)
    await expectMobileCreatorControlsFit(page)

    await expect(fields).toContainText('Mustering out', { timeout: 5_000 })
    await expectMobileCreatorControlsFit(page)
    await expectMobileControlUsable(
      page.getByRole('button', { name: 'Roll benefit' }),
      'Roll benefit'
    )
  })

  test('keeps finalization controls usable at phone width and hands off to the final sheet', async ({
    page
  }) => {
    test.setTimeout(60_000)
    await page.setViewportSize({ width: 390, height: 844 })
    const roomId = await openUniqueRoom(page)
    await setRoomSeed(page, roomId, 5)
    const actorId = actorIdFromPage(page)
    const actorSession = await actorSessionFromPage(page, roomId, actorId)
    const context: RepeatTravellerContext & { characterId: string } = {
      label: 'mobile-finalization',
      seed: 5,
      characterId: '',
      phase: 'setup',
      action: 'not started',
      commandTypes: [],
      consoleErrors: [],
      serverResponses: []
    }
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
    context.characterId = await activeCreationCharacterId(
      page,
      roomId,
      actorId
    )

    await seedCreationToCareerSelection(page, {
      roomId,
      actorId,
      actorSession,
      characterId: context.characterId
    })
    await postCommand(page, roomId, actorId, actorSession, {
      type: 'UpdateCharacterSheet',
      characterId: context.characterId,
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
    await openOrExpectFollowedCreation(page, characterName)

    const fields = page.locator('#characterCreationFields')
    const scoutCareer = characterCreationCareerButton(page, 'Scout')
    await expectMobileControlUsable(scoutCareer, 'Scout career')
    await scoutCareer.click()
    await waitForDiceReveal(page)
    await resolveVisibleCascadeChoices(page)

    const applyBasicTraining = page.getByRole('button', {
      name: 'Apply basic training'
    })
    await expectMobileControlUsable(applyBasicTraining, 'Apply basic training')
    await applyBasicTraining.click()

    const rollSurvival = page.getByRole('button', { name: 'Roll survival' })
    await expectMobileControlUsable(rollSurvival, 'Roll survival')
    await rollSurvival.click()
    await waitForDiceReveal(page)

    for (const actionName of ['Roll commission', 'Roll advancement']) {
      const action = page.getByRole('button', { name: actionName })
      if (await action.isVisible().catch(() => false)) {
        await expectMobileControlUsable(action, actionName)
        await action.click()
        await waitForDiceReveal(page)
      }
    }

    await expect(fields).toContainText('Skills and training', {
      timeout: 5_000
    })
    for (let index = 0; index < 12; index += 1) {
      if (
        await page
          .getByRole('button', { name: /^(Roll aging|Roll reenlistment)$/ })
          .isVisible()
          .catch(() => false)
      ) {
        break
      }
      const action = fields
        .locator('.creation-term-actions button:not([disabled])')
        .first()
      if ((await action.count()) === 0) break
      await expectMobileControlUsable(action, `Term skill action ${index + 1}`)
      const label = ((await action.textContent()) ?? '').trim()
      await action.click()
      if (!/complete/i.test(label)) await waitForDiceReveal(page)
      await resolveVisibleCascadeChoices(page)
    }

    const skipAnagathics = page.getByRole('button', {
      name: /^(Skip|Skip anagathics)$/
    })
    if (await skipAnagathics.isVisible().catch(() => false)) {
      await expectMobileControlUsable(skipAnagathics, 'Skip anagathics')
      await skipAnagathics.click()
    }

    const rollAging = page.getByRole('button', { name: 'Roll aging' })
    if (await rollAging.isVisible().catch(() => false)) {
      await expectMobileControlUsable(rollAging, 'Roll aging')
      await rollAging.click()
      await waitForDiceReveal(page)
      for (let index = 0; index < 4; index += 1) {
        const agingChoice = page.locator('.creation-term-actions button').first()
        if (
          (await agingChoice.count()) === 0 ||
          !(await agingChoice.isVisible())
        ) {
          break
        }
        await expectMobileControlUsable(
          agingChoice,
          `Aging choice ${index + 1}`
        )
        await agingChoice.click()
      }
    }

    const rollReenlistment = page.getByRole('button', {
      name: 'Roll reenlistment'
    })
    await expectMobileControlUsable(rollReenlistment, 'Roll reenlistment')
    await rollReenlistment.click()
    await waitForDiceReveal(page)

    const musterOut = page.getByRole('button', { name: 'Muster out' })
    await expectMobileControlUsable(musterOut, 'Muster out')
    const leftCareer = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().includes(`/rooms/${roomId}/command`) &&
        (response.request().postData() ?? '').includes(
          'LeaveCharacterCreationCareer'
        )
    )
    await musterOut.click()
    await expect((await leftCareer).ok()).toBe(true)
    await expect
      .poll(async () => {
        const character = await fetchProjectedCharacter(
          page,
          roomId,
          actorId,
          context.characterId
        )
        return character?.creation?.state?.status
      })
      .toBe('MUSTERING_OUT')

    await expectMusteringEquipmentStep(fields)
    await expectMobileCreatorControlsFit(page)

    await expectMobileCreatorControlsFit(page)

    const rollBenefit = page.getByRole('button', { name: 'Roll benefit' })
    await expectMobileControlUsable(rollBenefit, 'Roll benefit')
    await rollBenefit.click()
    await waitForDiceReveal(page)
    await expect(fields).toContainText('Benefits complete.', {
      timeout: 5_000
    })
    await expectMobileCreatorControlsFit(page)

    const reviewCharacter = page.getByRole('button', {
      name: 'Review character'
    })
    await expectMobileControlUsable(reviewCharacter, 'Review character')
    await reviewCharacter.click()
    await expect(fields.locator('.character-creation-review')).toBeVisible({
      timeout: 5_000
    })
    await expectMobileCreatorControlsFit(page)

    await expect(fields).toContainText(/Create character|Fix the highlighted/, {
      timeout: 5_000
    })

    const createCharacter = page.getByRole('button', {
      name: 'Create character'
    })
    await expectMobileControlUsable(createCharacter, 'Create character')
    const finalized = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().includes(`/rooms/${roomId}/command`) &&
        (response.request().postData() ?? '').includes(
          'FinalizeCharacterCreation'
        )
    )
    const tokenCreated = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().includes(`/rooms/${roomId}/command`) &&
        (response.request().postData() ?? '').includes('CreatePiece')
    )
    await createCharacter.click()
    await expect((await finalized).ok()).toBe(true)
    await expect((await tokenCreated).ok()).toBe(true)
    await expect.poll(() => postedCommandTypes).toContain(
      'FinalizeCharacterCreation'
    )
    await expect.poll(() => postedCommandTypes).toContain('CreatePiece')
    const finalizedCommandIndex = postedCommandTypes.lastIndexOf(
      'FinalizeCharacterCreation'
    )
    const createdPieceCommandIndex = postedCommandTypes.lastIndexOf(
      'CreatePiece'
    )
    expect(createdPieceCommandIndex).toBeGreaterThan(finalizedCommandIndex)

    let finalizedPieceId: string | null = null
    await expect
      .poll(async () => {
        const message = await fetchRoomState(page, roomId, actorId)
        const character = message.state?.characters[context.characterId]
        const linkedPieces = Object.values(message.state?.pieces ?? {}).filter(
          (piece) => piece.characterId === context.characterId
        )
        finalizedPieceId = linkedPieces[0]?.id ?? null
        return {
          status: character?.creation?.state?.status,
          creationComplete: character?.creation?.creationComplete,
          pieceCount: linkedPieces.length,
          pieceId: linkedPieces[0]?.id ?? null,
          pieceName: linkedPieces[0]?.name ?? ''
        }
      })
      .toMatchObject({
        status: 'PLAYABLE',
        creationComplete: true,
        pieceCount: 1,
        pieceId: expect.any(String),
        pieceName: characterName
      })
    if (!finalizedPieceId) throw new Error('Finalized linked piece was missing')

    await expect(page.locator('#characterCreator')).not.toBeVisible({
      timeout: 5_000
    })
    await expect(page.locator('#characterSheet.open')).toBeVisible({
      timeout: 5_000
    })
    const selectedRailPiece = page.locator(
      '#initiativeRail .rail-piece.selected'
    )
    await expect(selectedRailPiece).toHaveCount(1)
    await expect(selectedRailPiece).toHaveAttribute('title', characterName)
    await expect(page.locator('#sheetName')).toContainText(characterName)
    const sheetBody = page.locator('#sheetBody')
    const finalizedCharacter = await fetchProjectedCharacter(
      page,
      roomId,
      actorId,
      context.characterId
    )
    const firstSkill = finalizedCharacter?.skills?.[0]
    if (!firstSkill) throw new Error('Finalized character had no skills')

    await expect(sheetBody).toContainText('Final Character')
    await expect(sheetBody).toContainText('UPP')
    await expect(sheetBody).toContainText('Scout')
    await expect(sheetBody).toContainText(firstSkill)
    await expect(sheetBody).toContainText(
      `Cr${finalizedCharacter?.credits ?? 0}`
    )
    await expect(sheetBody).toContainText('Career History')
    await expect(sheetBody).toContainText(/Term 1: Scout/)
    await expect(sheetBody).toContainText('Skills:')

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('#boardCanvas')).toBeVisible()
    await expect(page.locator('#initiativeRail .rail-piece').first()).toHaveAttribute(
      'title',
      characterName,
      { timeout: 5_000 }
    )
    await page.locator('#initiativeRail .rail-piece').first().click()
    await expect(page.locator('#characterSheet.open')).toBeVisible({
      timeout: 5_000
    })
    await expect(page.locator('#sheetName')).toContainText(characterName)
    await expect(sheetBody).toContainText('Final Character')
    await expect(sheetBody).toContainText(/Term 1: Scout/)
    await expect(sheetBody).toContainText(firstSkill)
  })
})
