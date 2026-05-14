import type { GameId, UserId } from '../../../../shared/ids'
import type { LiveDiceRollRevealTarget } from '../../../../shared/live-activity'
import type { BenefitKind } from '../../../../shared/character-creation/types.js'
import type {
  CharacteristicKey,
  DiceRollState,
  GameState
} from '../../../../shared/state'
import type { CharacterCreationCommand } from '../../core/command-router.js'
import {
  applyCharacterCreationAgingRoll,
  applyCharacterCreationAnagathicsDecision,
  applyCharacterCreationBasicTraining,
  applyCharacterCreationCareerRoll,
  applyCharacterCreationCharacteristicRoll,
  applyCharacterCreationMusteringBenefit,
  applyCharacterCreationReenlistmentRoll,
  applyCharacterCreationTermSkillRoll,
  applyParsedCharacterCreationDraftPatch,
  deriveCharacterCreationAgingChangeOptions,
  deriveCharacterCreationTermSkillTableActions,
  deriveNextCharacterCreationAgingRoll,
  deriveNextCharacterCreationCharacteristicRoll,
  resolveCharacterCreationDraftCareer,
  nextCharacterCreationMusteringBenefitCareer,
  updateCharacterCreationFields,
  type CharacterCreationAgingSelection,
  type CharacterCreationFlow,
  type CharacterCreationTermSkillTable
} from './flow.js'
import { flowFromProjectedCharacter } from './projection.js'
import {
  deriveCharacterCreationCareerRollButton,
  deriveCharacterCreationCharacteristicRollButton,
  parseCharacterCreationDraftPatch
} from './view.js'

export interface CharacterCreationCommandResponse {
  state: GameState | null
}

export interface CharacterCreationCommandController {
  publishTermCascadeResolution: (
    flow: CharacterCreationFlow | null,
    cascadeSkill: string,
    selection: string,
    fallbackFlow: CharacterCreationFlow
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
  rollMusteringBenefit: (kind: BenefitKind) => Promise<void>
  rollReenlistment: () => Promise<void>
  decideAnagathics: (useAnagathics: boolean) => Promise<void>
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
  syncFlowFromRoomState: (
    roomState: GameState | null,
    characterId: CharacterCreationFlow['draft']['characterId'],
    fallbackFlow: CharacterCreationFlow
  ) => CharacterCreationFlow | null
  autoAdvanceSetup: () => boolean
  renderWizard: () => void
  scrollToTop: () => void
}

const latestDiceRoll = (
  response: CharacterCreationCommandResponse
): DiceRollState | null =>
  response.state?.diceLog?.[response.state.diceLog.length - 1] ?? null

const hasDiceRollResult = (roll: DiceRollState | null): roll is DiceRollState =>
  Array.isArray(roll?.rolls) && typeof roll?.total === 'number'

const syncAndRender = (
  {
    syncFlowFromRoomState,
    renderWizard,
    scrollToTop
  }: Pick<
    CharacterCreationCommandControllerDeps,
    'syncFlowFromRoomState' | 'renderWizard' | 'scrollToTop'
  >,
  response: CharacterCreationCommandResponse,
  fallbackFlow: CharacterCreationFlow
): void => {
  syncFlowFromRoomState(
    response.state,
    fallbackFlow.draft.characterId,
    fallbackFlow
  )
  renderWizard()
  scrollToTop()
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

  const syncDiceFlow = async (
    response: CharacterCreationCommandResponse,
    fallback: (
      flow: CharacterCreationFlow,
      roll: DiceRollState
    ) => {
      flow: CharacterCreationFlow
    },
    missingRollMessage: string
  ): Promise<boolean> => {
    const roll = latestDiceRoll(response)
    if (!roll) {
      setError(missingRollMessage)
      return false
    }

    await waitForDiceRevealOrDelay(roll)
    const flow = getFlow()
    if (!flow) return false
    if (!hasDiceRollResult(roll)) {
      syncFlowFromRoomState(response.state, flow.draft.characterId, flow)
      return true
    }
    const fallbackFlow = fallback(flow, roll).flow
    syncFlowFromRoomState(
      response.state,
      fallbackFlow.draft.characterId,
      fallbackFlow
    )
    return true
  }

  return {
    publishTermCascadeResolution: async (
      flow,
      cascadeSkill,
      selection,
      fallbackFlow
    ) => {
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
      syncAndRender(
        { syncFlowFromRoomState, renderWizard, scrollToTop },
        nextResponse,
        fallbackFlow
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
          (nextFlow, roll) =>
            applyCharacterCreationCharacteristicRoll(
              nextFlow,
              roll.total,
              targetKey
            ),
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

      const flowWithCareer = applyParsedCharacterCreationDraftPatch(
        flow,
        parseCharacterCreationDraftPatch({
          career,
          qualificationRoll: null,
          qualificationPassed: null
        })
      ).flow

      await flushHomeworldProgress()
      await ensurePublished()

      let response: CharacterCreationCommandResponse | null = null
      try {
        response = await postCharacterCreationCommand(
          {
            type: 'ResolveCharacterCreationQualification',
            ...commandIdentity(),
            characterId: flowWithCareer.draft.characterId,
            career
          },
          requestId('resolve-character-qualification')
        )
      } catch (error) {
        syncFlowFromRoomState(
          getState(),
          flowWithCareer.draft.characterId,
          flow
        )
        renderWizard()
        scrollToTop()
        throw error
      }

      const roll = latestDiceRoll(response)
      if (!roll) {
        setError('Qualification roll did not return a dice result')
        return
      }

      await waitForDiceRevealOrDelay(roll)
      const projectedCharacter =
        response.state?.characters?.[flowWithCareer.draft.characterId] ?? null
      const projectedFlow = projectedCharacter
        ? flowFromProjectedCharacter(projectedCharacter)
        : null
      const localResolvedFlow = applyCharacterCreationCareerRoll(
        flowWithCareer,
        roll.total
      ).flow
      const fallbackFlow =
        projectedFlow?.draft.careerPlan ||
        projectedCharacter?.creation?.state.status !== 'CAREER_SELECTION'
          ? (projectedFlow ?? localResolvedFlow)
          : localResolvedFlow

      setFlow(fallbackFlow)
      renderWizard()
      scrollToTop()
    },

    resolveFailedQualificationOption: async (option) => {
      const flow = guardEditableFlow()
      if (!flow) return
      setError('')
      syncFields()
      await flushHomeworldProgress()
      await ensurePublished()

      if (option === 'Drifter') {
        const fallbackFlow = applyParsedCharacterCreationDraftPatch(flow, {
          careerPlan: {
            career: 'Drifter',
            qualificationRoll: null,
            qualificationPassed: true,
            survivalRoll: null,
            survivalPassed: null,
            commissionRoll: null,
            commissionPassed: null,
            advancementRoll: null,
            advancementPassed: null,
            canCommission: null,
            canAdvance: null,
            drafted: false
          }
        }).flow
        const response = await postCharacterCreationCommand(
          {
            type: 'EnterCharacterCreationDrifter',
            ...commandIdentity(),
            characterId: flow.draft.characterId,
            option: 'Drifter'
          },
          requestId('enter-character-drifter')
        )
        syncAndRender(
          { syncFlowFromRoomState, renderWizard, scrollToTop },
          response,
          fallbackFlow
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
      await waitForDiceRevealOrDelay(roll)
      const career = resolveCharacterCreationDraftCareer(roll.total)
      if (!career) {
        setError('Draft roll did not resolve a career')
        return
      }
      const fallbackFlow = applyParsedCharacterCreationDraftPatch(flow, {
        careerPlan: {
          career,
          qualificationRoll: roll.total,
          qualificationPassed: true,
          survivalRoll: null,
          survivalPassed: null,
          commissionRoll: null,
          commissionPassed: null,
          advancementRoll: null,
          advancementPassed: null,
          canCommission: null,
          canAdvance: null,
          drafted: true
        }
      }).flow
      syncAndRender(
        { syncFlowFromRoomState, renderWizard, scrollToTop },
        response,
        fallbackFlow
      )
    },

    completeBasicTraining: async (skill) => {
      const flow = guardEditableFlow()
      if (!flow) return
      const fallbackFlow = applyCharacterCreationBasicTraining(flow, skill).flow

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
      syncAndRender(
        { syncFlowFromRoomState, renderWizard, scrollToTop },
        response,
        fallbackFlow
      )
    },

    rollTermSkill: async (table) => {
      const flow = guardEditableFlow()
      if (!flow) return
      setError('')
      syncFields()

      const action = deriveCharacterCreationTermSkillTableActions(flow).find(
        (candidate) => candidate.table === table
      )
      if (!action || action.disabled) return

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
          (nextFlow, roll) =>
            applyCharacterCreationTermSkillRoll({
              flow: nextFlow,
              table,
              roll: roll.total
            }),
          'Term skill roll did not return a dice result'
        )
      ) {
        renderWizard()
        scrollToTop()
      }
    },

    rollMusteringBenefit: async (kind) => {
      const flow = guardEditableFlow()
      if (!flow) return
      setError('')
      syncFields()

      const career = nextCharacterCreationMusteringBenefitCareer(flow.draft)
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
          (nextFlow, roll) =>
            applyCharacterCreationMusteringBenefit({
              flow: nextFlow,
              kind,
              roll: roll.total
            }),
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
          (nextFlow, roll) =>
            applyCharacterCreationReenlistmentRoll(nextFlow, roll.total),
          'Reenlistment roll did not return a dice result'
        )
      ) {
        renderWizard()
        scrollToTop()
      }
    },

    decideAnagathics: async (useAnagathics) => {
      const flow = guardEditableFlow()
      if (!flow) return
      setError('')
      syncFields()

      const fallbackFlow = applyCharacterCreationAnagathicsDecision({
        flow,
        useAnagathics
      }).flow

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
      syncAndRender(
        { syncFlowFromRoomState, renderWizard, scrollToTop },
        response,
        fallbackFlow
      )
    },

    rollAging: async () => {
      const flow = guardEditableFlow()
      if (!flow) return
      setError('')
      syncFields()

      const action = deriveNextCharacterCreationAgingRoll(flow)
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
        await syncDiceFlow(
          response,
          (nextFlow, roll) =>
            applyCharacterCreationAgingRoll(
              nextFlow,
              roll.total + (action?.modifier ?? 0)
            ),
          'Aging roll did not return a dice result'
        )
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
      syncAndRender(
        { syncFlowFromRoomState, renderWizard, scrollToTop },
        response,
        flow
      )
    },

    rollCareerCheck: async () => {
      const flow = guardEditableFlow()
      if (!flow) return
      setError('')
      syncFields()

      const rollAction = deriveCharacterCreationCareerRollButton(flow)
      if (!rollAction) return

      const characterId = flow.draft.characterId
      let command: CharacterCreationCommand | null = null
      if (rollAction.key === 'survivalRoll') {
        command = {
          type: 'ResolveCharacterCreationSurvival',
          ...commandIdentity(),
          characterId
        }
      } else if (rollAction.key === 'commissionRoll') {
        command = {
          type: 'ResolveCharacterCreationCommission',
          ...commandIdentity(),
          characterId
        }
      } else if (rollAction.key === 'advancementRoll') {
        command = {
          type: 'ResolveCharacterCreationAdvancement',
          ...commandIdentity(),
          characterId
        }
      }
      if (!command) return

      await ensurePublished()
      const response = await postCharacterCreationCommand(
        command,
        requestId('career-roll')
      )
      if (
        await syncDiceFlow(
          response,
          (nextFlow, roll) =>
            applyCharacterCreationCareerRoll(nextFlow, roll.total),
          'Career roll did not return a dice result'
        )
      ) {
        renderWizard()
        scrollToTop()
      }
    }
  }
}
