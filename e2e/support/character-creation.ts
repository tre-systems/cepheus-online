import { expect, type Page } from '@playwright/test'

export type CharacterCreationProjection = {
  creationComplete?: boolean
  pendingCascadeSkills?: string[]
  state?: {
    status?: string
  }
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
