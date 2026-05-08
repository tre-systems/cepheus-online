import type { GameId, UserId } from '../../shared/ids'
import type { LiveDiceRollRevealTarget } from '../../shared/live-activity'
import type {
  CharacteristicKey,
  DiceRollState,
  GameState
} from '../../shared/state'
import type { CharacterCreationCommand } from './app-command-router.js'
import {
  applyCharacterCreationAgingRoll,
  applyCharacterCreationBasicTraining,
  applyCharacterCreationCareerRoll,
  applyCharacterCreationCharacteristicRoll,
  applyCharacterCreationReenlistmentRoll,
  applyCharacterCreationTermSkillRoll,
  deriveCharacterCreationTermSkillTableActions,
  deriveNextCharacterCreationAgingRoll,
  deriveNextCharacterCreationCharacteristicRoll,
  type CharacterCreationFlow,
  type CharacterCreationTermSkillTable
} from './character-creation-flow.js'
import {
  deriveCharacterCreationCareerRollButton,
  deriveCharacterCreationCharacteristicRollButton
} from './character-creation-view.js'

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
  completeBasicTraining: () => Promise<void>
  rollTermSkill: (table: CharacterCreationTermSkillTable) => Promise<void>
  rollReenlistment: () => Promise<void>
  rollAging: () => Promise<void>
  rollCareerCheck: () => Promise<void>
}

export interface CharacterCreationCommandControllerDeps {
  getFlow: () => CharacterCreationFlow | null
  setError: (message: string) => void
  isReadOnly: () => boolean
  syncFields: () => void
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

export const createCharacterCreationCommandController = (
  deps: CharacterCreationCommandControllerDeps
): CharacterCreationCommandController => {
  const {
    getFlow,
    setError,
    isReadOnly,
    syncFields,
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
      syncAndRender(
        { syncFlowFromRoomState, renderWizard, scrollToTop },
        response,
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

    completeBasicTraining: async () => {
      const flow = guardEditableFlow()
      if (!flow) return
      const fallbackFlow = applyCharacterCreationBasicTraining(flow).flow

      await ensurePublished()
      const response = await postCharacterCreationCommand(
        {
          type: 'CompleteCharacterCreationBasicTraining',
          ...commandIdentity(),
          characterId: flow.draft.characterId
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
