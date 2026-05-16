import type {
  CareerCreationActionKey,
  CascadeSkillChoice,
  TermSkillTableActionOption
} from '../../../../shared/character-creation/types.js'
import type {
  CharacterCreationProjection,
  CharacteristicKey
} from '../../../../shared/state'
import type { CharacterCreationFlow } from './flow.js'
import {
  deriveCharacterCreationAgingChangeOptions,
  deriveCharacterCreationAnagathicsDecision,
  deriveCharacterCreationTermSkillTableActions,
  deriveNextCharacterCreationAgingRoll,
  deriveNextCharacterCreationReenlistmentRoll,
  isCharacterCreationCareerTermResolved,
  remainingCharacterCreationTermSkillRolls,
  requiredCharacterCreationTermSkillRolls
} from './flow.js'
import { plural } from './view-common.js'
import {
  characteristicDefinitions,
  formatCharacterCreationCharacteristicModifier,
  formatCharacterCreationReenlistmentOutcome
} from './view-format.js'
import { deriveCharacterCreationCascadeSkillChoiceViewModels } from './view-homeworld-model.js'
import type {
  CharacterCreationAgingChoicesViewModel,
  CharacterCreationAgingRollViewModel,
  CharacterCreationAnagathicsDecisionViewModel,
  CharacterCreationDeathViewModel,
  CharacterCreationInjuryResolutionViewModel,
  CharacterCreationMishapResolutionViewModel,
  CharacterCreationReenlistmentRollViewModel,
  CharacterCreationTermCascadeChoicesViewModel,
  CharacterCreationTermResolutionActionViewModel,
  CharacterCreationTermResolutionViewModel,
  CharacterCreationTermSkillTrainingViewModel,
  CharacterCreationViewRulesOptions
} from './view-types.js'

export const deriveCharacterCreationDeathViewModel = (
  flow: Pick<CharacterCreationFlow, 'step' | 'draft'>,
  { available }: { available?: boolean } = {}
): CharacterCreationDeathViewModel | null => {
  const plan = flow.draft.careerPlan
  if (flow.step !== 'career' || plan?.survivalPassed !== false) return null
  if (available === false) return null

  const name = flow.draft.name.trim() || 'This traveller'
  const career = plan?.career.trim() || 'career'
  const roll = plan.survivalRoll === null ? '-' : String(plan.survivalRoll)

  return {
    open: true,
    title: 'Killed in service',
    detail: `${name} failed the ${career} survival roll. Character creation ends here.`,
    roll,
    career
  }
}

export const deriveCharacterCreationMishapResolutionViewModel = (
  flow: Pick<CharacterCreationFlow, 'step' | 'draft'>,
  { available }: { available?: boolean } = {}
): CharacterCreationMishapResolutionViewModel | null => {
  const plan = flow.draft.careerPlan
  if (flow.step !== 'career') return null
  if (available === false) return null
  if (available !== true && plan?.survivalPassed !== false) return null

  const career = plan?.career.trim() || 'career'

  return {
    title: `${career} mishap`,
    message: `${
      plan?.survivalPassed === false
        ? 'Survival failed.'
        : 'A mishap must be resolved.'
    } Resolve the mishap before this traveller musters out.`,
    buttonLabel: 'Resolve mishap'
  }
}

const injuryTargetKeys = (
  projection: CharacterCreationProjection
): CharacteristicKey[] => {
  const injury = projection.terms.at(-1)?.facts?.mishap?.outcome.injury
  if (!injury) return []
  if (injury.type === 'roll') return ['str', 'dex']
  if (injury.injuryRoll === 3) return ['str', 'dex']

  return ['str', 'dex', 'end']
}

const injuryChoiceHint = (
  injury: NonNullable<
    NonNullable<
      NonNullable<
        CharacterCreationProjection['terms'][number]['facts']
      >['mishap']
    >['outcome']['injury']
  >
): string => {
  if (injury.type === 'roll') {
    return 'Roll the injury table first. If the result needs a loss target, choose the affected physical characteristic here.'
  }
  if (injury.injuryRoll === 1) {
    return 'Nearly killed: choose the first physical characteristic to lose 1D6. The other two physical characteristics each lose 1D6 by the rules.'
  }
  if (injury.injuryRoll === 2) {
    return 'Severely injured: choose the physical characteristic that loses 1D6.'
  }
  if (injury.injuryRoll === 3) {
    return 'Missing eye or limb: choose whether Strength or Dexterity takes the -2 loss.'
  }

  return 'Choose the physical characteristic that takes the permanent loss.'
}

export const deriveCharacterCreationInjuryResolutionViewModel = (
  flow: Pick<CharacterCreationFlow, 'step' | 'draft'>,
  {
    available,
    projection
  }: {
    available?: boolean
    projection?: CharacterCreationProjection | null
  } = {}
): CharacterCreationInjuryResolutionViewModel | null => {
  if (available === false || flow.step !== 'career' || !projection) return null
  const term = projection.terms.at(-1)
  const mishap = term?.facts?.mishap
  const injury = mishap?.outcome.injury
  if (!term || !injury || term.facts?.injury) return null

  const targets = injuryTargetKeys(projection)
  if (targets.length === 0) return null
  const methods =
    projection.actionPlan?.legalActions.find(
      (action) => action.key === 'resolveInjury'
    )?.injuryResolutionOptions ?? []

  const career = term.career.trim() || flow.draft.careerPlan?.career || 'Career'
  const characteristics = flow.draft.characteristics

  return {
    title: `${career} injury`,
    message:
      injury.type === 'roll'
        ? `${mishap.outcome.description} Roll the injury table, then choose where any permanent loss applies.`
        : `${mishap.outcome.description} Resolve this injury before mustering out.`,
    choiceHint: injuryChoiceHint(injury),
    targets: targets.map((characteristic) => {
      const definition = characteristicDefinitions.find(
        (candidate) => candidate.key === characteristic
      )
      const value = characteristics[characteristic]

      return {
        characteristic,
        label: definition?.label ?? characteristic.toUpperCase(),
        value: value === null ? '-' : String(value),
        modifier:
          value === null
            ? ''
            : formatCharacterCreationCharacteristicModifier(value)
      }
    }),
    methods,
    secondaryChoice: { mode: 'both_other_physical' }
  }
}

export const deriveCharacterCreationTermSkillTrainingViewModel = (
  flow: CharacterCreationFlow,
  {
    termSkillTableOptions
  }: {
    termSkillTableOptions?: readonly TermSkillTableActionOption[]
  } = {}
): CharacterCreationTermSkillTrainingViewModel | null => {
  if (flow.step !== 'career') return null

  const required = requiredCharacterCreationTermSkillRolls(flow.draft)
  const remaining = remainingCharacterCreationTermSkillRolls(flow.draft)
  const localActions = deriveCharacterCreationTermSkillTableActions(flow)
  const localActionsByTable = new Map(
    localActions.map((action) => [action.table, action])
  )
  const actions = termSkillTableOptions
    ? termSkillTableOptions.map((option) => {
        const localAction = localActionsByTable.get(option.table)
        return {
          table: option.table,
          label: option.label,
          reason: localAction?.reason ?? 'Roll this term skill table.',
          disabled: localAction?.disabled ?? false
        }
      })
    : localActions
  const rolled =
    flow.draft.careerPlan?.termSkillRolls?.map((roll) => ({
      label: roll.skill,
      detail: `${roll.roll} on ${roll.table}`
    })) ?? []

  if (required === 0 && remaining === 0 && rolled.length === 0) return null

  return {
    open: actions.length > 0 || remaining > 0,
    title: 'Skills and training',
    prompt:
      remaining > 0
        ? `Choose a table and roll ${plural(
            remaining,
            'more skill',
            'more skills'
          )}.`
        : 'Term skills are complete.',
    required,
    remaining,
    rolled,
    actions: actions.map((action) => ({
      table: action.table,
      label: action.label,
      reason: action.reason,
      disabled: action.disabled
    }))
  }
}

export const deriveCharacterCreationReenlistmentRollViewModel = (
  flow: CharacterCreationFlow,
  { available }: { available?: boolean } = {}
): CharacterCreationReenlistmentRollViewModel | null => {
  if (available === false) return null
  const action = deriveNextCharacterCreationReenlistmentRoll(flow)
  if (!action) return null

  return {
    label: action.label,
    reason: action.reason
  }
}

export const deriveCharacterCreationAgingRollViewModel = (
  flow: CharacterCreationFlow,
  { available }: { available?: boolean } = {}
): CharacterCreationAgingRollViewModel | null => {
  if (available === false) return null
  const action = deriveNextCharacterCreationAgingRoll(flow)
  if (!action) return null

  const modifier =
    action.modifier === 0
      ? ''
      : action.modifier > 0
        ? `+${action.modifier}`
        : String(action.modifier)

  return {
    label: action.label,
    reason: action.reason,
    modifier: action.modifier,
    modifierText: modifier
  }
}

export const deriveCharacterCreationAgingChoicesViewModel = (
  flow: CharacterCreationFlow
): CharacterCreationAgingChoicesViewModel | null => {
  const choices = deriveCharacterCreationAgingChangeOptions(flow)
  if (choices.length === 0) return null

  return {
    open: true,
    title: 'Aging effects',
    prompt: 'Choose where each aging effect applies.',
    choices: choices.map((choice) => ({
      index: choice.index,
      label: `${choice.type.toLowerCase()} ${choice.modifier}`,
      options: choice.options.map((option) => ({
        characteristic: option,
        label: option.toUpperCase()
      }))
    }))
  }
}

export const deriveCharacterCreationTermCascadeChoicesViewModel = (
  flow: CharacterCreationFlow,
  options: {
    termCascadeChoices?: readonly CascadeSkillChoice[]
  } & Pick<CharacterCreationViewRulesOptions, 'ruleset'> = {}
): CharacterCreationTermCascadeChoicesViewModel | null => {
  if (flow.step !== 'career') return null

  const choices =
    options.termCascadeChoices === undefined
      ? deriveCharacterCreationCascadeSkillChoiceViewModels(
          flow.draft.pendingTermCascadeSkills,
          [],
          options
        )
      : flow.draft.pendingTermCascadeSkills.flatMap((cascadeSkill) => {
          const projected = options.termCascadeChoices?.find(
            (choice) => choice.cascadeSkill === cascadeSkill
          )
          return projected
            ? deriveCharacterCreationCascadeSkillChoiceViewModels(
                [cascadeSkill],
                [projected],
                options
              )
            : []
        })
  if (choices.length === 0) return null

  return {
    open: true,
    title: 'Choose a specialty',
    prompt: 'Resolve the rolled cascade skill before continuing.',
    choices
  }
}

export const deriveCharacterCreationAnagathicsDecisionViewModel = (
  flow: CharacterCreationFlow,
  { available }: { available?: boolean } = {}
): CharacterCreationAnagathicsDecisionViewModel | null => {
  if (available === false) return null
  const decision = deriveCharacterCreationAnagathicsDecision(flow)
  if (!decision) return null

  return {
    title: 'Anagathics',
    prompt:
      'Choose whether this term used anagathics before aging and reenlistment.',
    reason: decision.reason,
    useLabel: 'Use anagathics',
    skipLabel: 'Skip'
  }
}

export const deriveCharacterCreationTermResolutionViewModel = (
  flow: CharacterCreationFlow,
  {
    availableActionKeys
  }: { availableActionKeys?: ReadonlySet<CareerCreationActionKey> } = {}
): CharacterCreationTermResolutionViewModel | null => {
  if (flow.step !== 'career') return null

  const plan = flow.draft.careerPlan
  if (!plan?.career) return null

  const title = 'Career term'
  const actionAvailable = (key: CareerCreationActionKey): boolean =>
    availableActionKeys ? availableActionKeys.has(key) : true
  const anyActionAvailable = (
    keys: readonly CareerCreationActionKey[]
  ): boolean =>
    availableActionKeys
      ? keys.some((key) => availableActionKeys.has(key))
      : true
  if (
    !isCharacterCreationCareerTermResolved(flow.draft) &&
    anyActionAvailable([
      'selectCareer',
      'rollSurvival',
      'rollCommission',
      'skipCommission',
      'rollAdvancement',
      'skipAdvancement'
    ])
  ) {
    return {
      title,
      message: 'Roll each required check. The next roll appears above.',
      actions: []
    }
  }

  if (
    deriveCharacterCreationTermSkillTableActions(flow).length > 0 &&
    actionAvailable('rollTermSkill')
  ) {
    return {
      title,
      message: 'Roll this term’s skills before deciding what happens next.',
      actions: []
    }
  }

  if (flow.draft.pendingTermCascadeSkills.length > 0) {
    return {
      title,
      message:
        'Choose the rolled skill specialty before deciding what happens next.',
      actions: []
    }
  }

  if (
    deriveCharacterCreationAnagathicsDecision(flow) &&
    actionAvailable('decideAnagathics')
  ) {
    return {
      title,
      message:
        'Decide whether this term used anagathics before deciding what happens next.',
      actions: []
    }
  }

  if (
    deriveNextCharacterCreationAgingRoll(flow) &&
    actionAvailable('resolveAging')
  ) {
    return {
      title,
      message: 'Roll aging before deciding what happens next.',
      actions: []
    }
  }

  if (flow.draft.pendingAgingChanges.length > 0) {
    return {
      title,
      message: 'Apply aging effects before deciding what happens next.',
      actions: []
    }
  }

  if (
    plan.survivalPassed === true &&
    !plan.reenlistmentOutcome &&
    actionAvailable('rollReenlistment')
  ) {
    return {
      title,
      message: 'Roll reenlistment before deciding what happens next.',
      actions: []
    }
  }

  if (plan.survivalPassed !== true) {
    return {
      title,
      message:
        'Killed in service. This character cannot muster out or become playable.',
      actions: []
    }
  }

  const actions: CharacterCreationTermResolutionActionViewModel[] = []
  if (
    plan.reenlistmentOutcome === 'allowed' ||
    plan.reenlistmentOutcome === 'forced'
  ) {
    const continueAllowed =
      plan.reenlistmentOutcome === 'forced'
        ? anyActionAvailable(['forcedReenlist', 'continueCareer'])
        : anyActionAvailable(['reenlist', 'continueCareer'])
    if (continueAllowed) {
      actions.push({
        label:
          plan.reenlistmentOutcome === 'forced'
            ? 'Serve required term'
            : 'Serve another term',
        continueCareer: true
      })
    }
  }

  if (anyActionAvailable(['leaveCareer', 'finishMustering'])) {
    actions.push({ label: 'Muster out', continueCareer: false })
  }

  if (availableActionKeys && actions.length === 0) return null

  return {
    title,
    message: formatCharacterCreationReenlistmentOutcome(plan),
    actions
  }
}
