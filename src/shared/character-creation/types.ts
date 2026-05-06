import type { CharacteristicKey } from '../state'

export type CareerCreationStatus =
  | 'CHARACTERISTICS'
  | 'HOMEWORLD'
  | 'CAREER_SELECTION'
  | 'BASIC_TRAINING'
  | 'SURVIVAL'
  | 'MISHAP'
  | 'COMMISSION'
  | 'ADVANCEMENT'
  | 'SKILLS_TRAINING'
  | 'AGING'
  | 'REENLISTMENT'
  | 'MUSTERING_OUT'
  | 'ACTIVE'
  | 'PLAYABLE'
  | 'DECEASED'

export type CareerCreationEvent =
  | { type: 'SET_CHARACTERISTICS' }
  | { type: 'COMPLETE_HOMEWORLD' }
  | { type: 'SELECT_CAREER'; isNewCareer: boolean; drafted?: boolean }
  | { type: 'COMPLETE_BASIC_TRAINING' }
  | { type: 'SURVIVAL_PASSED'; canCommission: boolean; canAdvance: boolean }
  | { type: 'SURVIVAL_FAILED' }
  | { type: 'COMPLETE_COMMISSION' }
  | { type: 'SKIP_COMMISSION' }
  | { type: 'COMPLETE_ADVANCEMENT' }
  | { type: 'SKIP_ADVANCEMENT' }
  | { type: 'COMPLETE_SKILLS' }
  | { type: 'COMPLETE_AGING' }
  | { type: 'REENLIST' }
  | { type: 'LEAVE_CAREER' }
  | { type: 'REENLIST_BLOCKED' }
  | { type: 'FORCED_REENLIST' }
  | { type: 'CONTINUE_CAREER' }
  | { type: 'FINISH_MUSTERING' }
  | { type: 'CREATION_COMPLETE' }
  | { type: 'DEATH_CONFIRMED' }
  | { type: 'MISHAP_RESOLVED' }
  | { type: 'RESET' }

export interface CareerCreationContext {
  canCommission: boolean
  canAdvance: boolean
}

export interface CareerCreationState {
  status: CareerCreationStatus
  context: CareerCreationContext
}

export type CareerCreationActionKey =
  | 'setCharacteristics'
  | 'completeHomeworld'
  | 'selectCareer'
  | 'completeBasicTraining'
  | 'rollSurvival'
  | 'resolveMishap'
  | 'confirmDeath'
  | 'rollCommission'
  | 'skipCommission'
  | 'rollAdvancement'
  | 'skipAdvancement'
  | 'completeSkills'
  | 'resolveAging'
  | 'rollReenlistment'
  | 'reenlist'
  | 'leaveCareer'
  | 'forcedReenlist'
  | 'resolveMusteringBenefit'
  | 'continueCareer'
  | 'finishMustering'
  | 'completeCreation'

export type CareerCreationReenlistmentOutcome =
  | 'unresolved'
  | 'forced'
  | 'allowed'
  | 'blocked'
  | 'retire'

export type CareerCreationPendingDecisionKey =
  | 'characteristicAssignment'
  | 'homeworldSkillSelection'
  | 'careerQualification'
  | 'basicTrainingSkillSelection'
  | 'survivalResolution'
  | 'mishapResolution'
  | 'commissionResolution'
  | 'advancementResolution'
  | 'skillTrainingSelection'
  | 'cascadeSkillResolution'
  | 'agingResolution'
  | 'anagathicsDecision'
  | 'reenlistmentResolution'
  | 'musteringBenefitSelection'

export interface CareerCreationPendingDecision {
  key: CareerCreationPendingDecisionKey
}

export interface CareerCreationActionContext {
  pendingDecisions?: readonly CareerCreationPendingDecision[]
  remainingMusteringBenefits?: number
  canContinueCareer?: boolean
  canCompleteCreation?: boolean
  reenlistmentOutcome?: CareerCreationReenlistmentOutcome
}

export interface CareerCreationActionProjection {
  state: CareerCreationState
  terms?: readonly CareerTerm[]
  careers?: readonly CareerRank[]
  characteristicChanges?: readonly AgingChange[]
  pendingCascadeSkills?: readonly string[]
  creationComplete?: boolean
}

export interface CareerCheck {
  characteristic: CharacteristicKey | null
  target: number
}

export interface CareerBasics {
  Qualifications: string
  Survival: string
  Commission: string
  Advancement: string
  ReEnlistment: string
}

export type CareerBasicsTable = Record<string, CareerBasics>
export type CareerSkillTable = Record<string, Record<string, string>>

export interface CareerRollOutcome {
  check: CareerCheck
  modifier: number
  total: number
  success: boolean
}

export interface BasicTrainingPlan {
  kind: 'all' | 'choose-one' | 'none'
  skills: string[]
}

export interface SurvivalPromotionOptions {
  canCommission: boolean
  canAdvance: boolean
}

export interface CareerRankReward {
  rank: number
  title: string
  bonusSkill: string | null
}

export interface CareerSkill {
  name: string
  level: number
}

export interface CascadeSkillResolution {
  pendingCascadeSkills: string[]
  backgroundSkills: string[]
  careerSkills: string[]
  termSkills: string[]
}

export type AgingChangeType = 'PHYSICAL' | 'MENTAL'

export interface AgingChange {
  type: AgingChangeType
  modifier: number
}

export interface AgingEffect {
  Roll: string | number
  Effects: string
  Changes?: AgingChange[]
}

export interface AgingResolution {
  age: number
  message: string
  characteristicChanges: AgingChange[]
}

export type PromotionOutcome = 'pass' | 'fail' | 'skip' | 'na'
export type ReenlistmentOutcome = 'forced' | 'allowed' | 'blocked' | 'retire'
export type ReenlistmentDecision = 'reenlist' | 'leave' | 'na'
export type TermOutcomeResult = 'MISHAP' | 'MUSTERING_OUT' | 'NEXT_TERM'

export interface TermOutcome {
  id: string
  survival: 'pass' | 'fail'
  commission: PromotionOutcome
  advancement: PromotionOutcome
  reenlistment: ReenlistmentOutcome
  decision: ReenlistmentDecision
  result: TermOutcomeResult
}

export interface BenefitTables {
  materialBenefits: Record<string, Record<string, string>>
  cashBenefits: Record<string, Record<string, string | number>>
}

export type BenefitKind = 'cash' | 'material'

export interface CareerBenefit {
  kind: BenefitKind
  value: string
  credits: number
}

export interface CareerRank {
  name: string
  rank: number
}

export interface CareerTerm {
  career: string
  skills: string[]
  skillsAndTraining: string[]
  benefits: string[]
  complete: boolean
  canReenlist: boolean
  completedBasicTraining: boolean
  musteringOut: boolean
  anagathics: boolean
  anagathicsCost?: number
  draft?: 1
  survival?: number
  reEnlistment?: number
}

export interface CareerTermStart {
  terms: CareerTerm[]
  careers: CareerRank[]
  canEnterDraft: boolean
  failedToQualify: boolean
}

export type ReenlistmentResolution =
  | {
      outcome: 'retire'
      message: string
      term: CareerTerm
      nextTermCareer: null
    }
  | {
      outcome: 'forced'
      message: string
      term: CareerTerm
      nextTermCareer: string
    }
  | {
      outcome: 'allowed'
      message: string
      term: CareerTerm
      nextTermCareer: null
    }
  | {
      outcome: 'blocked'
      message: string
      term: CareerTerm
      nextTermCareer: null
    }

export interface AnagathicsPayment {
  credits: number
  terms: CareerTerm[]
}

export interface AnagathicsUse {
  term: CareerTerm
  survived: boolean
}
