import type { GameId, UserId } from '../../../../shared/ids'
import type { LiveDiceRollRevealTarget } from '../../../../shared/live-activity'
import type { BenefitKind } from '../../../../shared/character-creation/types.js'
import type {
  InjuryResolutionMethod,
  InjurySecondaryChoice
} from '../../../../shared/characterCreation.js'
import type {
  CharacteristicKey,
  DiceRollState,
  GameState
} from '../../../../shared/state'
import type { CharacterCreationCommand } from '../../core/command-router.js'
import {
  deriveCharacterCreationAgingChangeOptions,
  deriveNextCharacterCreationCharacteristicRoll,
  nextCharacterCreationMusteringBenefitCareer,
  updateCharacterCreationFields,
  type CharacterCreationAgingSelection,
  type CharacterCreationFlow,
  type CharacterCreationTermSkillTable
} from './flow.js'
import { deriveCharacterCreationCharacteristicRollButton } from './view.js'

export interface CharacterCreationCommandResponse {
  state: GameState | null
}

export interface CharacterCreationCommandController {
  publishTermCascadeResolution: (
    flow: CharacterCreationFlow | null,
    cascadeSkill: string,
    selection: string
  ) => Promise<void>
  rollCharacteristic: (
    characteristicKey?: CharacteristicKey | null
  ) => Promise<void>
  resolveCareerQualification: (career: string) => Promise<void>
  resolveFailedQualificationOption: (
    option: 'Drifter' | 'Draft'
  ) => Promise<void>
  completeBasicTraining: (skill?: string) => Promise<void>
  rollTermSkill: (table: CharacterCreationTermSkillTable) => Promise<void>
  rollMusteringBenefit: (kind: BenefitKind, career?: string) => Promise<void>
  rollReenlistment: () => Promise<void>
  completeTerm: (continueCareer: boolean) => Promise<void>
  decideAnagathics: (useAnagathics: boolean) => Promise<void>
  resolveMishap: () => Promise<void>
  resolveInjury: (
    primaryCharacteristic: CharacteristicKey,
    secondaryChoice?: InjurySecondaryChoice | null,
    method?: InjuryResolutionMethod
  ) => Promise<void>
  rollAging: () => Promise<void>
  resolveAgingLoss: (
    index: number,
    characteristic: CharacteristicKey
  ) => Promise<void>
  rollCareerCheck: () => Promise<void>
}

export interface CharacterCreationCommandControllerDeps {
  getFlow: () => CharacterCreationFlow | null
  setFlow: (flow: CharacterCreationFlow | null) => void
  setError: (message: string) => void
  isReadOnly: () => boolean
  syncFields: () => void
  getState: () => GameState | null
  flushHomeworldProgress: () => Promise<void>
  ensurePublished: () => Promise<void>
  postCharacterCreationCommand: (
    command: CharacterCreationCommand,
    requestId: string
  ) => Promise<CharacterCreationCommandResponse>
  commandIdentity: () => { gameId: GameId; actorId: UserId }
  requestId: (scope: string) => string
  waitForDiceRevealOrDelay: (
    roll: LiveDiceRollRevealTarget | DiceRollState
  ) => Promise<void>
  refreshStateAfterDiceReveal?: () => Promise<void>
  syncFlowFromRoomState: (
    roomState: GameState | null,
    characterId: CharacterCreationFlow['draft']['characterId'],
    fallbackFlow: CharacterCreationFlow | null
  ) => CharacterCreationFlow | null
  autoAdvanceSetup: () => boolean
  renderWizard: () => void
  scrollToTop: () => void
}

const latestDiceRoll = (
  response: CharacterCreationCommandResponse
): DiceRollState | null =>
  response.state?.diceLog?.[response.state.diceLog.length - 1] ?? null

const diceRollHasVisibleResult = (roll: DiceRollState): boolean =>
  Array.isArray(roll.rolls) && typeof roll.total === 'number'

const syncAcceptedProjectionAndRender = (
  {
    syncFlowFromRoomState,
    setError,
    renderWizard,
    scrollToTop
  }: Pick<
    CharacterCreationCommandControllerDeps,
    'syncFlowFromRoomState' | 'setError' | 'renderWizard' | 'scrollToTop'
  >,
  response: CharacterCreationCommandResponse,
  characterId: CharacterCreationFlow['draft']['characterId']
): boolean => {
  const syncedFlow = syncFlowFromRoomState(response.state, characterId, null)
  if (!syncedFlow) {
    setError('Waiting for character projection; refresh and try again')
    return false
  }
  renderWizard()
  scrollToTop()
  return true
}

const shouldCompleteSkillsAfterTermCascade = (
  state: GameState | null,
  characterId: CharacterCreationFlow['draft']['characterId']
): boolean => {
  const creation = state?.characters[characterId]?.creation
  return (
    creation?.state.status === 'SKILLS_TRAINING' &&
    (creation.pendingCascadeSkills?.length ?? 0) === 0
  )
}

const projectedCareerRollCommand = (
  state: GameState | null,
  flow: CharacterCreationFlow,
  identity: { gameId: GameId; actorId: UserId }
): CharacterCreationCommand | null => {
  const characterId = flow.draft.characterId
  const legalActions =
    state?.characters[characterId]?.creation?.actionPlan?.legalActions ?? []
  const legalAction = legalActions.find(
    (action) =>
      action.key === 'rollSurvival' ||
      action.key === 'rollCommission' ||
      action.key === 'rollAdvancement'
  )

  switch (legalAction?.key) {
    case 'rollSurvival':
      return {
        type: 'ResolveCharacterCreationSurvival',
        ...identity,
        characterId
      }
    case 'rollCommission':
      return {
        type: 'ResolveCharacterCreationCommission',
        ...identity,
        characterId
      }
    case 'rollAdvancement':
      return {
        type: 'ResolveCharacterCreationAdvancement',
        ...identity,
        characterId
      }
    default:
      return null
  }
}

export const createCharacterCreationCommandController = (
  deps: CharacterCreationCommandControllerDeps
): CharacterCreationCommandController => {
  const {
    getFlow,
    setFlow,
    setError,
    isReadOnly,
    syncFields,
    getState,
    flushHomeworldProgress,
    ensurePublished,
    postCharacterCreationCommand,
    commandIdentity,
    requestId,
    waitForDiceRevealOrDelay,
    refreshStateAfterDiceReveal = async () => {},
    syncFlowFromRoomState,
    autoAdvanceSetup,
    renderWizard,
    scrollToTop
  } = deps

  const guardEditableFlow = (): CharacterCreationFlow | null => {
    if (isReadOnly()) return null
    const flow = getFlow()
    if (!flow) return null
    return flow
  }

  const stateAfterDiceReveal = async (
    response: CharacterCreationCommandResponse,
    roll: DiceRollState
  ): Promise<GameState | null> => {
    await waitForDiceRevealOrDelay(roll)
    if (diceRollHasVisibleResult(roll)) return response.state

    await refreshStateAfterDiceReveal()
    return getState()
  }

  const syncDiceFlow = async (
    response: CharacterCreationCommandResponse,
    missingRollMessage: string
  ): Promise<boolean> => {
    const roll = latestDiceRoll(response)
    if (!roll) {
      setError(missingRollMessage)
      return false
    }

    const revealedState = await stateAfterDiceReveal(response, roll)
    const flow = getFlow()
    if (!flow) return false
    const syncedFlow = syncFlowFromRoomState(
      revealedState,
      flow.draft.characterId,
      null
    )
    if (!syncedFlow) {
      setError('Waiting for character projection; refresh and try again')
      return false
    }
    return true
  }

  return {
    publishTermCascadeResolution: async (flow, cascadeSkill, selection) => {
      if (isReadOnly() || !flow || flow.step !== 'career') return
      await ensurePublished()
      const response = await postCharacterCreationCommand(
        {
          type: 'ResolveCharacterCreationTermCascadeSkill',
          ...commandIdentity(),
          characterId: flow.draft.characterId,
          cascadeSkill,
          selection
        },
        requestId('resolve-character-term-cascade')
      )
      const nextResponse = shouldCompleteSkillsAfterTermCascade(
        response.state,
        flow.draft.characterId
      )
        ? await postCharacterCreationCommand(
            {
              type: 'CompleteCharacterCreationSkills',
              ...commandIdentity(),
              characterId: flow.draft.characterId
            },
            requestId('complete-character-skills')
          )
        : response
      syncAcceptedProjectionAndRender(
        { syncFlowFromRoomState, setError, renderWizard, scrollToTop },
        nextResponse,
        flow.draft.characterId
      )
    },

    rollCharacteristic: async (characteristicKey = null) => {
      const flow = guardEditableFlow()
      if (!flow) return
      setError('')
      syncFields()

      const rollAction = deriveCharacterCreationCharacteristicRollButton(flow)
      if (!rollAction) return
      const targetKey =
        characteristicKey ??
        deriveNextCharacterCreationCharacteristicRoll(flow)?.key ??
        null

      if (!targetKey) {
        setError('Choose a characteristic to roll')
        return
      }

      await ensurePublished()
      const response = await postCharacterCreationCommand(
        {
          type: 'RollCharacterCreationCharacteristic',
          ...commandIdentity(),
          characterId: flow.draft.characterId,
          characteristic: targetKey
        },
        requestId('characteristic-roll')
      )

      if (
        !(await syncDiceFlow(
          response,
          'Characteristic roll did not return a dice result'
        ))
      ) {
        return
      }
      autoAdvanceSetup()
      renderWizard()
      scrollToTop()
    },

    resolveCareerQualification: async (career) => {
      const flow = guardEditableFlow()
      if (!flow) return
      setError('')
      syncFields()

      await flushHomeworldProgress()
      await ensurePublished()

      let response: CharacterCreationCommandResponse | null = null
      try {
        response = await postCharacterCreationCommand(
          {
            type: 'ResolveCharacterCreationQualification',
            ...commandIdentity(),
            characterId: flow.draft.characterId,
            career
          },
          requestId('resolve-character-qualification')
        )
      } catch (error) {
        syncFlowFromRoomState(getState(), flow.draft.characterId, flow)
        renderWizard()
        scrollToTop()
        throw error
      }

      const roll = latestDiceRoll(response)
      if (!roll) {
        setError('Qualification roll did not return a dice result')
        return
      }

      const revealedState = await stateAfterDiceReveal(response, roll)
      syncAcceptedProjectionAndRender(
        { syncFlowFromRoomState, setError, renderWizard, scrollToTop },
        { state: revealedState },
        flow.draft.characterId
      )
    },

    resolveFailedQualificationOption: async (option) => {
      const flow = guardEditableFlow()
      if (!flow) return
      setError('')
      syncFields()
      await flushHomeworldProgress()
      await ensurePublished()

      if (option === 'Drifter') {
        const response = await postCharacterCreationCommand(
          {
            type: 'EnterCharacterCreationDrifter',
            ...commandIdentity(),
            characterId: flow.draft.characterId,
            option: 'Drifter'
          },
          requestId('enter-character-drifter')
        )
        syncAcceptedProjectionAndRender(
          { syncFlowFromRoomState, setError, renderWizard, scrollToTop },
          response,
          flow.draft.characterId
        )
        return
      }

      const response = await postCharacterCreationCommand(
        {
          type: 'ResolveCharacterCreationDraft',
          ...commandIdentity(),
          characterId: flow.draft.characterId
        },
        requestId('resolve-character-draft')
      )
      const roll = latestDiceRoll(response)
      if (!roll) {
        setError('Draft roll did not return a dice result')
        return
      }
      const revealedState = await stateAfterDiceReveal(response, roll)
      syncAcceptedProjectionAndRender(
        { syncFlowFromRoomState, setError, renderWizard, scrollToTop },
        { state: revealedState },
        flow.draft.characterId
      )
    },

    completeBasicTraining: async (skill) => {
      const flow = guardEditableFlow()
      if (!flow) return

      await ensurePublished()
      const response = await postCharacterCreationCommand(
        {
          type: 'CompleteCharacterCreationBasicTraining',
          ...commandIdentity(),
          characterId: flow.draft.characterId,
          ...(skill ? { skill } : {})
        },
        requestId('complete-character-basic-training')
      )
      syncAcceptedProjectionAndRender(
        { syncFlowFromRoomState, setError, renderWizard, scrollToTop },
        response,
        flow.draft.characterId
      )
    },

    rollTermSkill: async (table) => {
      const flow = guardEditableFlow()
      if (!flow) return
      setError('')
      syncFields()

      await ensurePublished()
      const response = await postCharacterCreationCommand(
        {
          type: 'RollCharacterCreationTermSkill',
          ...commandIdentity(),
          characterId: flow.draft.characterId,
          table
        },
        requestId('term-skill-roll')
      )
      if (
        await syncDiceFlow(
          response,
          'Term skill roll did not return a dice result'
        )
      ) {
        renderWizard()
        scrollToTop()
      }
    },

    rollMusteringBenefit: async (kind, careerOverride) => {
      const flow = guardEditableFlow()
      if (!flow) return
      setError('')
      syncFields()

      const career =
        careerOverride ??
        nextCharacterCreationMusteringBenefitCareer(flow.draft)
      if (!career) return

      await ensurePublished()
      const response = await postCharacterCreationCommand(
        {
          type: 'RollCharacterCreationMusteringBenefit',
          ...commandIdentity(),
          characterId: flow.draft.characterId,
          career,
          kind
        },
        requestId('mustering-roll')
      )
      if (
        await syncDiceFlow(
          response,
          'Mustering roll did not return a dice result'
        )
      ) {
        renderWizard()
        scrollToTop()
      }
    },

    rollReenlistment: async () => {
      const flow = guardEditableFlow()
      if (!flow) return
      setError('')
      syncFields()

      await ensurePublished()
      const response = await postCharacterCreationCommand(
        {
          type: 'ResolveCharacterCreationReenlistment',
          ...commandIdentity(),
          characterId: flow.draft.characterId
        },
        requestId('reenlistment-roll')
      )
      if (
        await syncDiceFlow(
          response,
          'Reenlistment roll did not return a dice result'
        )
      ) {
        renderWizard()
        scrollToTop()
      }
    },

    completeTerm: async (continueCareer) => {
      const flow = guardEditableFlow()
      if (!flow) return
      setError('')
      syncFields()

      await ensurePublished()
      const response = await postCharacterCreationCommand(
        {
          type: continueCareer
            ? 'ReenlistCharacterCreationCareer'
            : 'LeaveCharacterCreationCareer',
          ...commandIdentity(),
          characterId: flow.draft.characterId
        },
        requestId(
          continueCareer
            ? 'continue-character-career'
            : 'leave-character-career'
        )
      )
      syncAcceptedProjectionAndRender(
        { syncFlowFromRoomState, setError, renderWizard, scrollToTop },
        response,
        flow.draft.characterId
      )
    },

    decideAnagathics: async (useAnagathics) => {
      const flow = guardEditableFlow()
      if (!flow) return
      setError('')
      syncFields()

      await ensurePublished()
      const response = await postCharacterCreationCommand(
        {
          type: 'DecideCharacterCreationAnagathics',
          ...commandIdentity(),
          characterId: flow.draft.characterId,
          useAnagathics
        },
        requestId('anagathics-decision')
      )
      syncAcceptedProjectionAndRender(
        { syncFlowFromRoomState, setError, renderWizard, scrollToTop },
        response,
        flow.draft.characterId
      )
    },

    resolveMishap: async () => {
      const flow = guardEditableFlow()
      if (!flow) return
      setError('')
      syncFields()

      await ensurePublished()
      const response = await postCharacterCreationCommand(
        {
          type: 'ResolveCharacterCreationMishap',
          ...commandIdentity(),
          characterId: flow.draft.characterId
        },
        requestId('mishap-roll')
      )
      if (
        await syncDiceFlow(response, 'Mishap roll did not return a dice result')
      ) {
        renderWizard()
        scrollToTop()
      }
    },

    resolveInjury: async (
      primaryCharacteristic,
      secondaryChoice = null,
      method
    ) => {
      const flow = guardEditableFlow()
      if (!flow) return
      setError('')
      syncFields()

      await ensurePublished()
      const response = await postCharacterCreationCommand(
        {
          type: 'ResolveCharacterCreationInjury',
          ...commandIdentity(),
          characterId: flow.draft.characterId,
          ...(method ? { method } : {}),
          primaryCharacteristic,
          ...(secondaryChoice ? { secondaryChoice } : {})
        },
        requestId('injury-roll')
      )
      if (
        await syncDiceFlow(response, 'Injury roll did not return a dice result')
      ) {
        renderWizard()
        scrollToTop()
      }
    },

    rollAging: async () => {
      const flow = guardEditableFlow()
      if (!flow) return
      setError('')
      syncFields()

      await ensurePublished()
      const response = await postCharacterCreationCommand(
        {
          type: 'ResolveCharacterCreationAging',
          ...commandIdentity(),
          characterId: flow.draft.characterId
        },
        requestId('aging-roll')
      )
      if (
        await syncDiceFlow(response, 'Aging roll did not return a dice result')
      ) {
        renderWizard()
        scrollToTop()
      }
    },

    resolveAgingLoss: async (index, characteristic) => {
      const flow = guardEditableFlow()
      if (!flow) return
      setError('')
      syncFields()

      const change = deriveCharacterCreationAgingChangeOptions(flow).find(
        (candidate) => candidate.index === index
      )
      if (!change?.options.includes(characteristic)) return

      const selections: CharacterCreationAgingSelection[] = [
        ...(flow.draft.careerPlan?.agingSelections ?? []),
        {
          type: change.type,
          modifier: change.modifier,
          characteristic
        }
      ]
      const selectedFlow = updateCharacterCreationFields(flow, {
        careerPlan: flow.draft.careerPlan
          ? {
              ...flow.draft.careerPlan,
              agingSelections: selections
            }
          : null
      })

      if (selections.length < flow.draft.pendingAgingChanges.length) {
        setFlow(selectedFlow)
        renderWizard()
        return
      }

      await ensurePublished()
      const response = await postCharacterCreationCommand(
        {
          type: 'ResolveCharacterCreationAgingLosses',
          ...commandIdentity(),
          characterId: flow.draft.characterId,
          selectedLosses: selections
        },
        requestId('aging-losses')
      )
      syncAcceptedProjectionAndRender(
        { syncFlowFromRoomState, setError, renderWizard, scrollToTop },
        response,
        flow.draft.characterId
      )
    },

    rollCareerCheck: async () => {
      const flow = guardEditableFlow()
      if (!flow) return
      setError('')
      syncFields()

      const command = projectedCareerRollCommand(
        getState(),
        flow,
        commandIdentity()
      )
      if (!command) return

      await ensurePublished()
      const response = await postCharacterCreationCommand(
        command,
        requestId('career-roll')
      )
      if (
        await syncDiceFlow(response, 'Career roll did not return a dice result')
      ) {
        renderWizard()
        scrollToTop()
      }
    }
  }
}
