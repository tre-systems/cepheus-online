import {
  canRollCashBenefit,
  deriveRemainingCareerBenefits
} from '../../shared/character-creation/benefits.js'
import {
  deriveCareerCreationActionContext,
  deriveLegalCareerCreationActionKeys
} from '../../shared/character-creation/legal-actions.js'
import type {
  BenefitKind,
  CareerCreationActionKey
} from '../../shared/character-creation/types.js'
import type { CareerCreationTermSkillTable } from '../../shared/characterCreation.js'
import type { Command, GameCommand } from '../../shared/commands'
import type {
  CharacterCreationProjection,
  CharacteristicKey,
  CharacterState
} from '../../shared/state'
import type { ClientIdentity } from '../game-commands.js'

export interface CharacterCreationActionViewModel {
  key: string
  label: string
  command: GameCommand | null
  variant: 'primary' | 'secondary'
}

export interface CharacterCreationActionPlan {
  title: string
  status: string
  summary: string
  actions: CharacterCreationActionViewModel[]
}

const statusLabel = (status: string): string =>
  status
    .toLowerCase()
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ')

const advanceCommand = (
  identity: ClientIdentity,
  character: CharacterState,
  creationEvent: Extract<
    Command,
    { type: 'AdvanceCharacterCreation' }
  >['creationEvent']
): Command => ({
  type: 'AdvanceCharacterCreation',
  gameId: identity.gameId,
  actorId: identity.actorId,
  characterId: character.id,
  creationEvent
})

const action = (
  key: string,
  label: string,
  command: GameCommand,
  variant: CharacterCreationActionViewModel['variant'] = 'primary'
): CharacterCreationActionViewModel => ({
  key,
  label,
  command,
  variant
})

const termSkillTableLabels: Record<CareerCreationTermSkillTable, string> = {
  personalDevelopment: 'Personal development',
  serviceSkills: 'Service skills',
  specialistSkills: 'Specialist skills',
  advancedEducation: 'Advanced education'
}

const termSkillActionKeys: Record<CareerCreationTermSkillTable, string> = {
  personalDevelopment: 'roll-personal-development',
  serviceSkills: 'roll-service-skills',
  specialistSkills: 'roll-specialist-skills',
  advancedEducation: 'roll-advanced-education'
}

const benefitKindLabels: Record<BenefitKind, string> = {
  cash: 'cash',
  material: 'material'
}

const characteristicKeys: readonly CharacteristicKey[] = [
  'str',
  'dex',
  'end',
  'int',
  'edu',
  'soc'
]

const requiredTermSkillCount = (
  creation: CharacterCreationProjection & { requiredTermSkillCount?: number }
): number => {
  if (creation.requiredTermSkillCount !== undefined) {
    return creation.requiredTermSkillCount
  }

  const term = creation.terms.at(-1)
  if (!term || term.survival === undefined) return 0

  return !creation.state.context.canCommission &&
    !creation.state.context.canAdvance
    ? 2
    : 1
}

const deriveTermSkillRollActions = (
  identity: ClientIdentity,
  character: CharacterState,
  creation: CharacterCreationProjection
): CharacterCreationActionViewModel[] => {
  if (creation.state.status !== 'SKILLS_TRAINING') return []
  if ((creation.pendingCascadeSkills ?? []).length > 0) return []

  const term = creation.terms.at(-1)
  if (!term?.career) return []
  if (term.skills.length >= requiredTermSkillCount(creation)) return []

  return (Object.keys(termSkillTableLabels) as CareerCreationTermSkillTable[])
    .filter(
      (table) =>
        table !== 'advancedEducation' ||
        (character.characteristics.edu ?? 0) >= 8
    )
    .map((table) =>
      action(termSkillActionKeys[table], termSkillTableLabels[table], {
        type: 'RollCharacterCreationTermSkill',
        gameId: identity.gameId,
        actorId: identity.actorId,
        characterId: character.id,
        table
      })
    )
}

const termsInCareer = (
  creation: CharacterCreationProjection,
  career: string
): number => creation.terms.filter((term) => term.career === career).length

const benefitsReceivedInCareer = (
  creation: CharacterCreationProjection,
  career: string
): number =>
  creation.terms
    .filter((term) => term.career === career)
    .reduce((total, term) => total + term.benefits.length, 0)

const currentCareerRank = (
  creation: CharacterCreationProjection,
  career: string
): number => creation.careers.find((entry) => entry.name === career)?.rank ?? 0

const cashBenefitsReceived = (creation: CharacterCreationProjection): number =>
  (creation.history ?? []).filter(
    (event) =>
      event.type === 'FINISH_MUSTERING' &&
      event.musteringBenefit?.kind === 'cash'
  ).length

const remainingBenefitsInCareer = (
  creation: CharacterCreationProjection,
  career: string
): number =>
  deriveRemainingCareerBenefits({
    termsInCareer: termsInCareer(creation, career),
    currentRank: currentCareerRank(creation, career),
    benefitsReceived: benefitsReceivedInCareer(creation, career)
  })

const musteringBenefitCareers = (
  creation: CharacterCreationProjection
): string[] => {
  const careers: string[] = []
  const seen = new Set<string>()
  for (const term of creation.terms) {
    if (seen.has(term.career)) continue
    seen.add(term.career)
    if (remainingBenefitsInCareer(creation, term.career) > 0) {
      careers.push(term.career)
    }
  }
  return careers
}

const musteringBenefitActionKey = (career: string, kind: BenefitKind): string =>
  `roll-mustering-${kind}-${career.toLowerCase().replaceAll(' ', '-')}`

const deriveMusteringBenefitRollActions = (
  identity: ClientIdentity,
  character: CharacterState,
  creation: CharacterCreationProjection
): CharacterCreationActionViewModel[] => {
  if (creation.state.status !== 'MUSTERING_OUT') return []

  const context = deriveCareerCreationActionContext(creation)
  const blockingDecision = context.pendingDecisions?.find(
    (decision) => decision.key !== 'musteringBenefitSelection'
  )
  if (blockingDecision || context.remainingMusteringBenefits === 0) return []

  const kinds: BenefitKind[] = canRollCashBenefit({
    cashBenefitsReceived: cashBenefitsReceived(creation)
  })
    ? ['cash', 'material']
    : ['material']

  return musteringBenefitCareers(creation).flatMap((career) =>
    kinds.map((kind) =>
      action(
        musteringBenefitActionKey(career, kind),
        `Roll ${career} ${benefitKindLabels[kind]} benefit`,
        {
          type: 'RollCharacterCreationMusteringBenefit',
          gameId: identity.gameId,
          actorId: identity.actorId,
          characterId: character.id,
          career,
          kind
        }
      )
    )
  )
}

const actionsForLegalKey = (
  key: CareerCreationActionKey,
  identity: ClientIdentity,
  character: CharacterState,
  creation: CharacterCreationProjection
): CharacterCreationActionViewModel[] => {
  switch (key) {
    case 'setCharacteristics':
      return characteristicKeys
        .filter((key) => character.characteristics[key] === null)
        .slice(0, 1)
        .map((key) =>
          action(`roll-${key}`, `Roll ${key.toUpperCase()}`, {
            type: 'RollCharacterCreationCharacteristic',
            gameId: identity.gameId,
            actorId: identity.actorId,
            characterId: character.id,
            characteristic: key
          })
        )
    case 'completeHomeworld':
      return [
        action('complete-homeworld', 'Confirm homeworld', {
          type: 'CompleteCharacterCreationHomeworld',
          gameId: identity.gameId,
          actorId: identity.actorId,
          characterId: character.id
        })
      ]
    case 'selectCareer':
      if (character.creation?.failedToQualify) {
        const actions: CharacterCreationActionViewModel[] = [
          action('enter-drifter', 'Enter Drifter', {
            type: 'EnterCharacterCreationDrifter',
            gameId: identity.gameId,
            actorId: identity.actorId,
            characterId: character.id,
            option: 'Drifter'
          })
        ]
        if (character.creation.canEnterDraft) {
          actions.push(
            action('roll-draft', 'Roll draft', {
              type: 'ResolveCharacterCreationDraft',
              gameId: identity.gameId,
              actorId: identity.actorId,
              characterId: character.id
            })
          )
        }
        return actions
      }
      if (character.creation?.terms.length === 0) {
        return [
          action('qualify-scout', 'Qualify for Scout', {
            type: 'ResolveCharacterCreationQualification',
            gameId: identity.gameId,
            actorId: identity.actorId,
            characterId: character.id,
            career: 'Scout'
          })
        ]
      }
      return [
        action('select-career', 'Qualify for Scout', {
          type: 'ResolveCharacterCreationQualification',
          gameId: identity.gameId,
          actorId: identity.actorId,
          characterId: character.id,
          career: 'Scout'
        })
      ]
    case 'completeBasicTraining':
      return [
        action('complete-basic-training', 'Complete basic training', {
          type: 'CompleteCharacterCreationBasicTraining',
          gameId: identity.gameId,
          actorId: identity.actorId,
          characterId: character.id
        })
      ]
    case 'rollSurvival':
      return [
        action('roll-survival', 'Roll survival', {
          type: 'ResolveCharacterCreationSurvival',
          gameId: identity.gameId,
          actorId: identity.actorId,
          characterId: character.id
        })
      ]
    case 'resolveMishap':
      return [
        action(
          'resolve-mishap',
          'Resolve mishap',
          advanceCommand(identity, character, { type: 'MISHAP_RESOLVED' })
        )
      ]
    case 'confirmDeath':
      return [
        action(
          'death-confirmed',
          'Confirm death',
          advanceCommand(identity, character, { type: 'DEATH_CONFIRMED' }),
          'secondary'
        )
      ]
    case 'rollCommission':
      return [
        action(
          'complete-commission',
          'Complete commission',
          {
            type: 'ResolveCharacterCreationCommission',
            gameId: identity.gameId,
            actorId: identity.actorId,
            characterId: character.id
          },
          'secondary'
        )
      ]
    case 'skipCommission':
      return [
        action('skip-commission', 'Skip commission', {
          type: 'SkipCharacterCreationCommission',
          gameId: identity.gameId,
          actorId: identity.actorId,
          characterId: character.id
        })
      ]
    case 'rollAdvancement':
      return [
        action('complete-advancement', 'Complete advancement', {
          type: 'ResolveCharacterCreationAdvancement',
          gameId: identity.gameId,
          actorId: identity.actorId,
          characterId: character.id
        })
      ]
    case 'skipAdvancement':
      return [
        action(
          'skip-advancement',
          'Skip advancement',
          {
            type: 'SkipCharacterCreationAdvancement',
            gameId: identity.gameId,
            actorId: identity.actorId,
            characterId: character.id
          },
          'secondary'
        )
      ]
    case 'completeSkills':
      return [
        action('complete-skills', 'Complete skills', {
          type: 'CompleteCharacterCreationSkills',
          gameId: identity.gameId,
          actorId: identity.actorId,
          characterId: character.id
        })
      ]
    case 'resolveAging':
      if ((creation.characteristicChanges?.length ?? 0) > 0) return []
      return [
        action('complete-aging', 'Complete aging', {
          type: 'ResolveCharacterCreationAging',
          gameId: identity.gameId,
          actorId: identity.actorId,
          characterId: character.id
        })
      ]
    case 'decideAnagathics':
      return [
        action('use-anagathics', 'Use anagathics', {
          type: 'DecideCharacterCreationAnagathics',
          gameId: identity.gameId,
          actorId: identity.actorId,
          characterId: character.id,
          useAnagathics: true
        }),
        action(
          'skip-anagathics',
          'Skip anagathics',
          {
            type: 'DecideCharacterCreationAnagathics',
            gameId: identity.gameId,
            actorId: identity.actorId,
            characterId: character.id,
            useAnagathics: false
          },
          'secondary'
        )
      ]
    case 'reenlist':
      return [
        action(
          'reenlist',
          'Re-enlist',
          {
            type: 'ReenlistCharacterCreationCareer',
            gameId: identity.gameId,
            actorId: identity.actorId,
            characterId: character.id
          },
          'secondary'
        )
      ]
    case 'leaveCareer':
      return [
        action(
          'leave-career',
          'Leave career',
          {
            type: 'LeaveCharacterCreationCareer',
            gameId: identity.gameId,
            actorId: identity.actorId,
            characterId: character.id
          }
        )
      ]
    case 'continueCareer':
      return [
        action(
          'continue-career',
          'Continue career',
          {
            type: 'ContinueCharacterCreationAfterMustering',
            gameId: identity.gameId,
            actorId: identity.actorId,
            characterId: character.id
          },
          'secondary'
        )
      ]
    case 'finishMustering':
      return [
        action('finish-mustering', 'Finish mustering out', {
          type: 'CompleteCharacterCreationMustering',
          gameId: identity.gameId,
          actorId: identity.actorId,
          characterId: character.id
        })
      ]
    case 'completeCreation':
      return [
        action('creation-complete', 'Make playable', {
          type: 'CompleteCharacterCreation',
          gameId: identity.gameId,
          actorId: identity.actorId,
          characterId: character.id
        })
      ]
    case 'rollReenlistment':
      return [
        action('roll-reenlistment', 'Roll re-enlistment', {
          type: 'ResolveCharacterCreationReenlistment',
          gameId: identity.gameId,
          actorId: identity.actorId,
          characterId: character.id
        })
      ]
    case 'forcedReenlist':
    case 'resolveMusteringBenefit':
      return []
    default: {
      const exhaustive: never = key
      return exhaustive
    }
  }
}

const actionKeyOrder: readonly CareerCreationActionKey[] = [
  'setCharacteristics',
  'completeHomeworld',
  'selectCareer',
  'completeBasicTraining',
  'rollSurvival',
  'resolveMishap',
  'confirmDeath',
  'skipCommission',
  'rollCommission',
  'rollAdvancement',
  'skipAdvancement',
  'completeSkills',
  'decideAnagathics',
  'resolveAging',
  'leaveCareer',
  'reenlist',
  'finishMustering',
  'continueCareer',
  'completeCreation',
  'rollReenlistment',
  'forcedReenlist',
  'resolveMusteringBenefit'
]

const deriveActions = (
  identity: ClientIdentity,
  character: CharacterState,
  creation: CharacterCreationProjection
): CharacterCreationActionViewModel[] => {
  const termSkillRollActions = deriveTermSkillRollActions(
    identity,
    character,
    creation
  )
  if (termSkillRollActions.length > 0) return termSkillRollActions

  const musteringBenefitRollActions = deriveMusteringBenefitRollActions(
    identity,
    character,
    creation
  )
  if (musteringBenefitRollActions.length > 0) {
    return musteringBenefitRollActions
  }

  const legalKeys = new Set(
    deriveLegalCareerCreationActionKeys(
      creation.state,
      deriveCareerCreationActionContext(creation)
    )
  )

  return actionKeyOrder
    .filter((key) => legalKeys.has(key))
    .flatMap((key) => actionsForLegalKey(key, identity, character, creation))
}

export const deriveCharacterCreationActionPlan = (
  identity: ClientIdentity,
  character: CharacterState | null
): CharacterCreationActionPlan | null => {
  if (!character) return null

  if (!character.creation) {
    return {
      title: 'Creation',
      status: 'Not started',
      summary: 'Start the character creation lifecycle for this sheet.',
      actions: [
        action('start', 'Start creation', {
          type: 'StartCharacterCreation',
          gameId: identity.gameId,
          actorId: identity.actorId,
          characterId: character.id
        })
      ]
    }
  }

  const { status } = character.creation.state
  const summary = character.creation.creationComplete
    ? 'Creation is complete and the character is playable.'
    : 'Advance the server-backed character creation state.'
  const plan = (actions: CharacterCreationActionViewModel[]) => ({
    title: 'Creation',
    status: statusLabel(status),
    summary,
    actions
  })

  switch (status) {
    case 'PLAYABLE':
      return plan([])
    case 'DECEASED':
      return {
        title: 'Creation',
        status: 'Deceased',
        summary: 'Creation ended with this character deceased.',
        actions: []
      }
    case 'CHARACTERISTICS':
    case 'HOMEWORLD':
    case 'CAREER_SELECTION':
    case 'BASIC_TRAINING':
    case 'SURVIVAL':
    case 'MISHAP':
    case 'COMMISSION':
    case 'ADVANCEMENT':
    case 'SKILLS_TRAINING':
    case 'AGING':
    case 'REENLISTMENT':
    case 'MUSTERING_OUT':
    case 'ACTIVE':
      return plan(deriveActions(identity, character, character.creation))
    default: {
      const exhaustive: never = status
      return exhaustive
    }
  }
}
