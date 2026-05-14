import type { EventId } from '../ids'
import type { CharacteristicKey, CharacterSheetPatch } from '../state'

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

export interface CharacterCreationTimelineEntry {
  eventId: EventId
  seq: number
  createdAt: string
  eventType: string
  rollEventId?: EventId
}

export interface CareerCreationDiceFact {
  expression: '1d6' | '2d6'
  rolls: number[]
  total: number
}

export interface CareerCreationCheckFact extends CareerCreationDiceFact {
  characteristic: CharacteristicKey | null
  modifier: number
  target: number
  success: boolean
}

export interface CareerCreationDraftFact {
  roll: CareerCreationDiceFact
  tableRoll: number
  acceptedCareer: string
}

export interface CareerCreationRankFact {
  career: string
  previousRank: number
  newRank: number
  title: string
  bonusSkill: string | null
}

export type CareerCreationTermSkillTable =
  | 'personalDevelopment'
  | 'serviceSkills'
  | 'specialistSkills'
  | 'advancedEducation'

export interface CareerCreationTermSkillFact {
  career: string
  table: CareerCreationTermSkillTable
  roll: CareerCreationDiceFact
  tableRoll: number
  rawSkill: string
  skill: string | null
  characteristic: {
    key: CharacteristicKey
    modifier: number
  } | null
  pendingCascadeSkill: string | null
}

export interface CareerCreationAgingFact {
  roll: CareerCreationDiceFact
  modifier: number
  age: number
  characteristicChanges: AgingChange[]
}

export interface CareerCreationReenlistmentFact
  extends CareerCreationCheckFact {
  outcome: 'forced' | 'allowed' | 'blocked'
}

export interface CareerCreationBenefitFact {
  career: string
  kind: BenefitKind
  roll: CareerCreationDiceFact
  modifier: number
  tableRoll: number
  value: string
  credits: number
  materialItem?: string | null
}

export interface CareerTermQualificationFact {
  career: string
  passed: boolean
  qualification: CareerCreationCheckFact
  previousCareerCount: number
  failedQualificationOptions: FailedQualificationOption[]
}

export interface CareerTermSurvivalFact {
  passed: boolean
  survival: CareerCreationCheckFact
  canCommission: boolean
  canAdvance: boolean
}

export type CareerTermCommissionFact =
  | {
      skipped: false
      passed: boolean
      commission: CareerCreationCheckFact
    }
  | { skipped: true }

export type CareerTermAdvancementFact =
  | {
      skipped: false
      passed: boolean
      advancement: CareerCreationCheckFact
      rank: CareerCreationRankFact | null
    }
  | { skipped: true }

export interface CareerTermAgingLossFact {
  selectedLosses: AgingLossSelection[]
  characteristicPatch: CharacterSheetPatch['characteristics']
}

export interface CareerTermAnagathicsDecisionFact {
  useAnagathics: boolean
  termIndex: number
}

export interface CareerTermReenlistmentFact {
  outcome: CareerCreationReenlistmentFact['outcome']
  reenlistment: CareerCreationReenlistmentFact
}

export interface CareerTermFacts {
  qualification?: CareerTermQualificationFact
  draft?: CareerCreationDraftFact
  basicTrainingSkills?: string[]
  survival?: CareerTermSurvivalFact
  commission?: CareerTermCommissionFact
  advancement?: CareerTermAdvancementFact
  termSkillRolls?: CareerCreationTermSkillFact[]
  termCascadeSelections?: Array<{ cascadeSkill: string; selection: string }>
  aging?: CareerCreationAgingFact
  agingLosses?: CareerTermAgingLossFact
  anagathicsDecision?: CareerTermAnagathicsDecisionFact
  reenlistment?: CareerTermReenlistmentFact
  musteringBenefits?: CareerCreationBenefitFact[]
}

export type CareerCreationEvent =
  | { type: 'SET_CHARACTERISTICS' }
  | { type: 'COMPLETE_HOMEWORLD' }
  | {
      type: 'SELECT_CAREER'
      isNewCareer: boolean
      drafted?: boolean
      canEnterDraft?: boolean
      qualification?: CareerCreationCheckFact
      failedQualificationOptions?: FailedQualificationOption[]
    }
  | { type: 'COMPLETE_BASIC_TRAINING' }
  | {
      type: 'SURVIVAL_PASSED'
      canCommission: boolean
      canAdvance: boolean
      survival?: CareerCreationCheckFact
    }
  | { type: 'SURVIVAL_FAILED'; survival?: CareerCreationCheckFact }
  | { type: 'COMPLETE_COMMISSION'; commission?: CareerCreationCheckFact }
  | { type: 'SKIP_COMMISSION' }
  | {
      type: 'COMPLETE_ADVANCEMENT'
      advancement?: CareerCreationCheckFact
      rank?: CareerCreationRankFact | null
    }
  | { type: 'SKIP_ADVANCEMENT' }
  | { type: 'ROLL_TERM_SKILL'; termSkill: CareerCreationTermSkillFact }
  | {
      type: 'RESOLVE_TERM_CASCADE_SKILL'
      cascadeSkill: string
      selection: string
    }
  | { type: 'COMPLETE_SKILLS' }
  | { type: 'COMPLETE_AGING'; aging?: CareerCreationAgingFact }
  | { type: 'DECIDE_ANAGATHICS'; useAnagathics: boolean; termIndex: number }
  | {
      type: 'RESOLVE_REENLISTMENT'
      reenlistment: CareerCreationReenlistmentFact
    }
  | { type: 'REENLIST'; reenlistment?: CareerCreationCheckFact }
  | { type: 'LEAVE_CAREER' }
  | { type: 'REENLIST_BLOCKED'; reenlistment?: CareerCreationCheckFact }
  | { type: 'FORCED_REENLIST'; reenlistment?: CareerCreationCheckFact }
  | { type: 'CONTINUE_CAREER' }
  | { type: 'FINISH_MUSTERING'; musteringBenefit?: CareerCreationBenefitFact }
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
  | 'decideAnagathics'
  | 'rollReenlistment'
  | 'reenlist'
  | 'leaveCareer'
  | 'forcedReenlist'
  | 'resolveMusteringBenefit'
  | 'continueCareer'
  | 'finishMustering'
  | 'completeCreation'

export type CareerCreationServerCommandType =
  | 'AdvanceCharacterCreation'
  | 'RollCharacterCreationCharacteristic'
  | 'CompleteCharacterCreationHomeworld'
  | 'ResolveCharacterCreationQualification'
  | 'ResolveCharacterCreationDraft'
  | 'EnterCharacterCreationDrifter'
  | 'ResolveCharacterCreationSurvival'
  | 'ResolveCharacterCreationCommission'
  | 'SkipCharacterCreationCommission'
  | 'ResolveCharacterCreationAdvancement'
  | 'SkipCharacterCreationAdvancement'
  | 'ResolveCharacterCreationAging'
  | 'ResolveCharacterCreationAgingLosses'
  | 'ResolveCharacterCreationMishap'
  | 'ConfirmCharacterCreationDeath'
  | 'ResolveCharacterCreationReenlistment'
  | 'ReenlistCharacterCreationCareer'
  | 'LeaveCharacterCreationCareer'
  | 'RollCharacterCreationTermSkill'
  | 'CompleteCharacterCreationSkills'
  | 'ResolveCharacterCreationTermCascadeSkill'
  | 'RollCharacterCreationMusteringBenefit'
  | 'ContinueCharacterCreationAfterMustering'
  | 'CompleteCharacterCreationMustering'
  | 'CompleteCharacterCreation'
  | 'DecideCharacterCreationAnagathics'
  | 'StartCharacterCareerTerm'
  | 'FinalizeCharacterCreation'

export type CareerCreationRollRequirementKey =
  | 'characteristics'
  | 'careerQualification'
  | 'draft'
  | 'survival'
  | 'mishap'
  | 'commission'
  | 'advancement'
  | 'termSkill'
  | 'aging'
  | 'reenlistment'
  | 'musteringBenefit'

export interface CareerCreationRollRequirement {
  key: CareerCreationRollRequirementKey
  dice: '1d6' | '2d6'
}

export interface FailedQualificationActionOption {
  option: FailedQualificationOption
  rollRequirement?: CareerCreationRollRequirement
}

export interface LegalCareerCreationAction {
  key: CareerCreationActionKey
  status: CareerCreationStatus
  commandTypes: readonly CareerCreationServerCommandType[]
  rollRequirement?: CareerCreationRollRequirement
  failedQualificationOptions?: readonly FailedQualificationActionOption[]
}

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
  requiredTermSkillCount?: number
  remainingMusteringBenefits?: number
  canContinueCareer?: boolean
  canCompleteCreation?: boolean
  canResolveBasicTrainingSelection?: boolean
  reenlistmentOutcome?: CareerCreationReenlistmentOutcome
  failedToQualify?: boolean
  canEnterDraft?: boolean
}

export interface CareerCreationActionPlan {
  status: CareerCreationStatus
  pendingDecisions: readonly CareerCreationPendingDecision[]
  legalActions: readonly LegalCareerCreationAction[]
}

export interface CareerCreationActionProjection {
  state: CareerCreationState
  terms?: readonly CareerTerm[]
  careers?: readonly CareerRank[]
  canEnterDraft?: boolean
  failedToQualify?: boolean
  characteristicChanges?: readonly AgingChange[]
  backgroundSkills?: readonly string[]
  backgroundSkillAllowance?: number
  pendingCascadeSkills?: readonly string[]
  pendingDecisions?: readonly CareerCreationPendingDecision[]
  requiredTermSkillCount?: number
  creationComplete?: boolean
  timeline?: readonly CharacterCreationTimelineEntry[]
  history?: readonly CareerCreationEvent[]
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

export type FailedQualificationOption = 'Drifter' | 'Draft'

export type DraftTable = readonly string[]

export interface DraftResolution {
  roll: number
  career: string
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

export interface AgingLossSelection extends AgingChange {
  characteristic: CharacteristicKey
}

export interface AgingLossResolution {
  selectedLosses: AgingLossSelection[]
  characteristicPatch: CharacterSheetPatch['characteristics']
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
export type TermOutcomeResult =
  | 'DECEASED'
  | 'MISHAP'
  | 'MUSTERING_OUT'
  | 'NEXT_TERM'

export interface TermOutcome {
  id: string
  survival: 'pass' | 'fail'
  commission: PromotionOutcome
  advancement: PromotionOutcome
  reenlistment: ReenlistmentOutcome
  decision: ReenlistmentDecision
  result: TermOutcomeResult
}

export type SurvivalFailureRollOutcome = 'fail'

export interface SurvivalFailureRollFact {
  total: number
  outcome: SurvivalFailureRollOutcome
}

export interface SurvivalMishapRollFact {
  total: number
}

export type SurvivalMishapId =
  | 'injured_in_action'
  | 'honorable_discharge'
  | 'legal_battle_debt'
  | 'dishonorable_discharge'
  | 'prison_discharge'
  | 'medical_discharge'

export type SurvivalMishapDischarge = 'honorable' | 'dishonorable' | 'medical'

export type SurvivalMishapBenefitEffect = 'forfeit_current_term' | 'lose_all'

export type SurvivalMishapInjuryRequirement =
  | {
      type: 'fixed'
      injuryRoll: number
      alternative: 'roll_twice_take_lower'
    }
  | { type: 'roll' }

export interface SurvivalMishapOutcome {
  career: string
  roll: number
  id: SurvivalMishapId
  description: string
  discharge: SurvivalMishapDischarge
  benefitEffect: SurvivalMishapBenefitEffect
  debtCredits: number
  extraServiceYears: number
  injury: SurvivalMishapInjuryRequirement | null
}

export type SurvivalFailureOutcome =
  | {
      type: 'death'
      career: string
      survival: SurvivalFailureRollFact
      reason: 'failed_survival'
    }
  | {
      type: 'mishap'
      career: string
      survival: SurvivalFailureRollFact
      mishap: SurvivalMishapOutcome
      forcedCareerExit: true
      servedYears: 2
      forfeitCurrentTermBenefit: true
    }

export type InjuryOutcomeId =
  | 'nearly_killed'
  | 'severely_injured'
  | 'missing_eye_or_limb'
  | 'scarred'
  | 'injured'
  | 'lightly_injured'

export interface InjuryOutcome {
  career: string
  roll: number
  id: InjuryOutcomeId
  description: string
  crisisRisk: boolean
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
  facts?: CareerTermFacts
  complete: boolean
  canReenlist: boolean
  completedBasicTraining: boolean
  musteringOut: boolean
  anagathics: boolean
  anagathicsCost?: number
  draft?: 1
  survival?: number
  advancement?: number
  reEnlistment?: number
}

export interface CareerTermStart {
  terms: CareerTerm[]
  careers: CareerRank[]
  canEnterDraft: boolean
  failedToQualify: boolean
}

export interface DraftCareerTermStart extends CareerTermStart {
  draft: DraftResolution
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
