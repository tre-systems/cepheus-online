import type { GameId, UserId } from '../../../../shared/ids'
import type {
  CharacterCreationHomeworld,
  CharacterCreationProjection,
  GameState
} from '../../../../shared/state'
import type { CharacterCreationCommand } from '../../core/command-router'
import type { CharacterCreationDraft, CharacterCreationFlow } from './flow'
import { projectedCharacterCreation } from './follow'
import { deriveCharacterCreationValidationSummary } from './view'

export interface CharacterCreationHomeworldPublisher {
  publishProgress: (flow: CharacterCreationFlow | null) => Promise<void>
  flush: () => Promise<void>
  publishBackgroundCascadeSelection: (
    flow: CharacterCreationFlow | null,
    skill: string
  ) => Promise<void>
  publishCascadeResolution: (
    flow: CharacterCreationFlow | null,
    cascadeSkill: string,
    selection: string
  ) => Promise<void>
}

export interface CharacterCreationHomeworldPublisherDeps {
  getState: () => GameState | null
  isReadOnly: () => boolean
  commandIdentity: () => { gameId: GameId; actorId: UserId }
  ensurePublished: () => Promise<void>
  postCharacterCreationCommand: (
    command: CharacterCreationCommand,
    requestId: string
  ) => Promise<unknown>
  requestId: (scope: string) => string
  setError: (message: string) => void
}

const homeworldForCommand = (
  homeworld: CharacterCreationDraft['homeworld']
): CharacterCreationHomeworld => ({
  name: null,
  lawLevel: homeworld.lawLevel ?? null,
  tradeCodes: Array.isArray(homeworld.tradeCodes)
    ? [...homeworld.tradeCodes]
    : homeworld.tradeCodes
      ? [homeworld.tradeCodes]
      : []
})

const sameHomeworldCommandValue = (
  left: CharacterCreationHomeworld | null | undefined,
  right: CharacterCreationHomeworld
): boolean => {
  if (!left || !right) return false
  const leftTradeCodes = Array.isArray(left.tradeCodes)
    ? left.tradeCodes
    : left.tradeCodes
      ? [left.tradeCodes]
      : []
  const rightTradeCodes = Array.isArray(right.tradeCodes)
    ? right.tradeCodes
    : right.tradeCodes
      ? [right.tradeCodes]
      : []
  return (
    (left.name ?? null) === (right.name ?? null) &&
    (left.lawLevel ?? null) === (right.lawLevel ?? null) &&
    leftTradeCodes.length === rightTradeCodes.length &&
    leftTradeCodes.every((code, index) => code === rightTradeCodes[index])
  )
}

const backgroundSkillAllowance = (edu: number | null): number =>
  3 + (edu == null ? 0 : Math.floor(edu / 3) - 2)

const projectedHomeworldIsComplete = (
  creation: CharacterCreationProjection | null,
  draft: CharacterCreationDraft
): boolean =>
  Boolean(
    creation?.state.status === 'HOMEWORLD' &&
      (creation.pendingCascadeSkills ?? []).length === 0 &&
      (creation.backgroundSkills ?? []).length >=
        backgroundSkillAllowance(draft.characteristics.edu)
  )

export const createCharacterCreationHomeworldPublisher = ({
  getState,
  isReadOnly,
  commandIdentity,
  ensurePublished,
  postCharacterCreationCommand,
  requestId,
  setError
}: CharacterCreationHomeworldPublisherDeps): CharacterCreationHomeworldPublisher => {
  let publishPromise = Promise.resolve()

  const currentCreation = (
    characterId: CharacterCreationDraft['characterId']
  ) => projectedCharacterCreation(getState(), characterId)

  const publishProgressNow = async (
    flow: CharacterCreationFlow | null
  ): Promise<void> => {
    if (isReadOnly() || !flow || flow.step !== 'homeworld') return

    const { draft } = flow
    const homeworld = homeworldForCommand(draft.homeworld)
    if (!homeworld.lawLevel || homeworld.tradeCodes.length === 0) return

    await ensurePublished()

    let creation = currentCreation(draft.characterId)
    if (!creation || creation.state.status !== 'HOMEWORLD') return

    const baseCommand = {
      ...commandIdentity(),
      characterId: draft.characterId
    }

    if (!sameHomeworldCommandValue(creation.homeworld, homeworld)) {
      await postCharacterCreationCommand(
        {
          type: 'SetCharacterCreationHomeworld',
          ...baseCommand,
          homeworld
        },
        requestId('set-character-homeworld')
      )
      creation = currentCreation(draft.characterId)
    }

    if (!creation || creation.state.status !== 'HOMEWORLD') return

    if (projectedHomeworldIsComplete(creation, draft)) {
      await postCharacterCreationCommand(
        {
          type: 'CompleteCharacterCreationHomeworld',
          ...baseCommand
        },
        requestId('complete-character-homeworld')
      )
      return
    }

    const projectedBackgroundSkills = new Set(creation.backgroundSkills ?? [])
    const projectedPendingCascadeSkills = new Set(
      creation.pendingCascadeSkills ?? []
    )
    for (const skill of draft.backgroundSkills) {
      if (projectedBackgroundSkills.has(skill)) continue
      if (projectedPendingCascadeSkills.has(skill)) continue
      await postCharacterCreationCommand(
        {
          type: 'SelectCharacterCreationBackgroundSkill',
          ...baseCommand,
          skill
        },
        requestId('select-character-background-skill')
      )
      creation = currentCreation(draft.characterId)
      if (!creation || creation.state.status !== 'HOMEWORLD') return
      projectedBackgroundSkills.clear()
      for (const nextSkill of creation.backgroundSkills ?? []) {
        projectedBackgroundSkills.add(nextSkill)
      }
      projectedPendingCascadeSkills.clear()
      for (const nextSkill of creation.pendingCascadeSkills ?? []) {
        projectedPendingCascadeSkills.add(nextSkill)
      }
    }

    const validation = deriveCharacterCreationValidationSummary({
      ...flow,
      step: 'homeworld'
    })
    creation = currentCreation(draft.characterId)
    if (
      validation.ok &&
      creation?.state.status === 'HOMEWORLD' &&
      (creation.pendingCascadeSkills ?? []).length === 0
    ) {
      await postCharacterCreationCommand(
        {
          type: 'CompleteCharacterCreationHomeworld',
          ...baseCommand
        },
        requestId('complete-character-homeworld')
      )
    }
  }

  const enqueue = (task: () => Promise<void>): Promise<void> => {
    publishPromise = publishPromise
      .catch(() => {
        // Keep the queue alive after an earlier rejected command.
      })
      .then(task)
      .catch((error) => setError(error.message))
    return publishPromise
  }

  return {
    publishProgress: (flow) => enqueue(() => publishProgressNow(flow)),
    flush: () => publishPromise,
    publishBackgroundCascadeSelection: (flow, skill) =>
      enqueue(async () => {
        if (isReadOnly() || !flow || flow.step !== 'homeworld') return
        await publishProgressNow(flow)
        const creation = currentCreation(flow.draft.characterId)
        if (
          !creation ||
          creation.state.status !== 'HOMEWORLD' ||
          (creation.pendingCascadeSkills ?? []).includes(skill)
        ) {
          return
        }
        await postCharacterCreationCommand(
          {
            type: 'SelectCharacterCreationBackgroundSkill',
            ...commandIdentity(),
            characterId: flow.draft.characterId,
            skill
          },
          requestId('select-character-background-cascade')
        )
      }),
    publishCascadeResolution: (flow, cascadeSkill, selection) =>
      enqueue(async () => {
        if (isReadOnly() || !flow || flow.step !== 'homeworld') return
        await ensurePublished()
        const creation = currentCreation(flow.draft.characterId)
        if (
          !creation ||
          creation.state.status !== 'HOMEWORLD' ||
          !(creation.pendingCascadeSkills ?? []).includes(cascadeSkill)
        ) {
          return
        }
        await postCharacterCreationCommand(
          {
            type: 'ResolveCharacterCreationCascadeSkill',
            ...commandIdentity(),
            characterId: flow.draft.characterId,
            cascadeSkill,
            selection
          },
          requestId('resolve-character-background-cascade')
        )
        await publishProgressNow(flow)
      })
  }
}
