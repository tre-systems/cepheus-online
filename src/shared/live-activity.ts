import type {
  CareerCreationEvent,
  CareerCreationStatus
} from './characterCreation'
import type { EventEnvelope } from './events'
import type { CharacterId, EventId, GameId, UserId } from './ids'

export const LIVE_DICE_RESULT_REVEAL_DELAY_MS = 2500
export const MAX_LIVE_ACTIVITY_TEXT_LENGTH = 120
export const MAX_LIVE_ACTIVITY_ROLLS = 20

export type LiveActivityDescriptor =
  | DiceRollActivityDescriptor
  | CharacterCreationActivityDescriptor

export interface LiveActivityBase {
  id: EventId
  eventId: EventId
  gameId: GameId
  seq: number
  actorId: UserId | null
  createdAt: string
}

export interface DiceRollActivityDescriptor extends LiveActivityBase {
  type: 'diceRoll'
  expression: string
  reason: string
  rolls: number[]
  rollsOmitted?: number
  total: number
  reveal: {
    revealAt: string
    delayMs: number
  }
}

export interface LiveDiceRollRevealTarget {
  id: string
  revealAt: string
  rolls: readonly number[]
  total: number
}

export interface CharacterCreationActivityRevealMetadata {
  rollEventId: EventId
  revealAt: string
  delayMs: number
}

export interface CharacterCreationActivityDescriptor extends LiveActivityBase {
  type: 'characterCreation'
  characterId: CharacterId
  transition: string
  details?: string
  reveal?: CharacterCreationActivityRevealMetadata
  status: CareerCreationStatus
  creationComplete: boolean
}

export const deriveLiveActivityRevealAt = (
  createdAt: string,
  delayMs = LIVE_DICE_RESULT_REVEAL_DELAY_MS
): string => new Date(Date.parse(createdAt) + delayMs).toISOString()

export const deriveLiveDiceRollRevealTarget = (
  activity: LiveActivityDescriptor
): LiveDiceRollRevealTarget | null => {
  if (activity.type !== 'diceRoll') return null
  if (!Array.isArray(activity.rolls) || typeof activity.total !== 'number') {
    return null
  }

  return {
    id: activity.id,
    revealAt: activity.reveal.revealAt,
    rolls: activity.rolls,
    total: activity.total
  }
}

export const deriveCharacterCreationActivityRevealAt = (
  activity: CharacterCreationActivityDescriptor
): string =>
  activity.reveal?.revealAt ?? deriveLiveActivityRevealAt(activity.createdAt)

const baseActivity = (envelope: EventEnvelope): LiveActivityBase => ({
  id: envelope.id,
  eventId: envelope.id,
  gameId: envelope.gameId,
  seq: envelope.seq,
  actorId: envelope.actorId,
  createdAt: envelope.createdAt
})

const boundedText = (value: string): string => {
  if (value.length <= MAX_LIVE_ACTIVITY_TEXT_LENGTH) return value

  return `${value.slice(0, MAX_LIVE_ACTIVITY_TEXT_LENGTH - 3)}...`
}

const countLabel = (
  count: number,
  singular: string,
  plural = `${singular}s`
): string => `${count} ${count === 1 ? singular : plural}`

const availabilityLabel = (value: boolean): string =>
  value ? 'available' : 'unavailable'

const signedLabel = (value: number): string =>
  value > 0 ? `+${value}` : String(value)

const listLabel = (values: readonly string[]): string => {
  if (values.length === 0) return ''
  if (values.length === 1) return values[0] ?? ''

  return `${values.slice(0, -1).join(', ')} or ${values[values.length - 1]}`
}

const careerSelectionOutcomeLabel = (
  event: Extract<CareerCreationEvent, { type: 'SELECT_CAREER' }>
): string | null => {
  if (event.drafted === true) return 'drafted after failed qualification'
  if (event.drafted === false) {
    return event.qualification?.success === false
      ? 'fallback selected after failed qualification'
      : 'qualified'
  }
  if (event.qualification?.success === false) {
    const options = listLabel(event.failedQualificationOptions ?? [])

    return options
      ? `qualification failed; fallback ${options}`
      : 'qualification failed'
  }

  return null
}

const agingDetails = (
  event: Extract<CareerCreationEvent, { type: 'COMPLETE_AGING' }>
): string => {
  if (!event.aging) return 'Aging resolved'

  return [
    'Aging resolved',
    `age ${event.aging.age}`,
    `aging/anagathics modifier ${signedLabel(event.aging.modifier)}`,
    countLabel(
      event.aging.characteristicChanges.length,
      'characteristic change'
    )
  ].join('; ')
}

const musteringBenefitDetails = (
  event: Extract<CareerCreationEvent, { type: 'FINISH_MUSTERING' }>
): string => {
  if (!event.musteringBenefit) return 'Mustering out complete'

  const benefit = event.musteringBenefit
  const value = benefit.kind === 'cash' ? `Cr${benefit.credits}` : benefit.value

  return [
    'Mustering benefit',
    benefit.career,
    benefit.kind,
    value,
    `table roll ${benefit.tableRoll}`
  ].join('; ')
}

const basicTrainingDetails = (trainingSkills: readonly string[]): string => {
  if (trainingSkills.length === 0) return 'Basic training complete; 0 skills'

  return [
    'Basic training complete',
    countLabel(trainingSkills.length, 'skill'),
    trainingSkills.join(', ')
  ].join('; ')
}

const survivalDetails = ({
  passed,
  total,
  target,
  modifier,
  canCommission,
  canAdvance
}: {
  passed: boolean
  total: number
  target: number
  modifier: number
  canCommission: boolean
  canAdvance: boolean
}): string =>
  [
    passed ? 'Survival passed' : 'Killed in service',
    `total ${total}`,
    `target ${target}+`,
    `DM ${signedLabel(modifier)}`,
    passed ? `commission ${availabilityLabel(canCommission)}` : null,
    passed ? `advancement ${availabilityLabel(canAdvance)}` : null
  ]
    .filter(Boolean)
    .join('; ')

const commissionDetails = ({
  passed,
  total,
  target,
  modifier
}: {
  passed: boolean
  total: number
  target: number
  modifier: number
}): string =>
  [
    passed ? 'Commission earned' : 'Commission not earned',
    `total ${total}`,
    `target ${target}+`,
    `DM ${signedLabel(modifier)}`
  ].join('; ')

const rankDetails = (
  rank:
    | Extract<CareerCreationEvent, { type: 'COMPLETE_ADVANCEMENT' }>['rank']
    | null
    | undefined
): string | null => {
  if (!rank) return null

  return [
    `rank ${rank.previousRank}->${rank.newRank}`,
    rank.title ? `title ${rank.title}` : null,
    rank.bonusSkill ? `bonus ${rank.bonusSkill}` : null
  ]
    .filter(Boolean)
    .join('; ')
}

const advancementDetails = ({
  passed,
  total,
  target,
  modifier,
  rank
}: {
  passed: boolean
  total: number
  target: number
  modifier: number
  rank?: Extract<CareerCreationEvent, { type: 'COMPLETE_ADVANCEMENT' }>['rank']
}): string =>
  [
    passed ? 'Advancement passed' : 'Advancement failed',
    `total ${total}`,
    `target ${target}+`,
    `DM ${signedLabel(modifier)}`,
    rankDetails(rank)
  ]
    .filter(Boolean)
    .join('; ')

const reenlistmentDetails = ({
  outcome,
  total,
  target,
  modifier
}: {
  outcome: 'forced' | 'allowed' | 'blocked'
  total: number
  target: number
  modifier: number
}): string => {
  const label =
    outcome === 'forced'
      ? 'Forced reenlistment'
      : outcome === 'allowed'
        ? 'Reenlistment allowed'
        : 'Reenlistment blocked'

  return [
    label,
    `total ${total}`,
    `target ${target}+`,
    `DM ${signedLabel(modifier)}`
  ].join('; ')
}

const describeCareerCreationEvent = (
  event: CareerCreationEvent
): string | null => {
  switch (event.type) {
    case 'SET_CHARACTERISTICS':
      return 'Characteristics assigned'
    case 'COMPLETE_HOMEWORLD':
      return 'Homeworld complete'
    case 'SELECT_CAREER': {
      const selection = event.isNewCareer ? 'new career' : 'existing career'
      const draft = careerSelectionOutcomeLabel(event)

      return ['Career selected', selection, draft].filter(Boolean).join('; ')
    }
    case 'COMPLETE_BASIC_TRAINING':
      return 'Basic training complete'
    case 'SURVIVAL_PASSED':
      return [
        'Survival passed',
        `commission ${availabilityLabel(event.canCommission)}`,
        `advancement ${availabilityLabel(event.canAdvance)}`
      ].join('; ')
    case 'SURVIVAL_FAILED':
      return 'Killed in service'
    case 'COMPLETE_COMMISSION':
      return 'Commission earned'
    case 'SKIP_COMMISSION':
      return 'Commission skipped'
    case 'COMPLETE_ADVANCEMENT':
      return event.advancement
        ? advancementDetails({
            passed: event.advancement.success,
            total: event.advancement.total,
            target: event.advancement.target,
            modifier: event.advancement.modifier,
            rank: event.rank
          })
        : 'Advancement earned'
    case 'SKIP_ADVANCEMENT':
      return 'Advancement skipped'
    case 'ROLL_TERM_SKILL':
      return [
        'Term skill rolled',
        event.termSkill.rawSkill,
        event.termSkill.skill ? `skill ${event.termSkill.skill}` : null,
        event.termSkill.characteristic
          ? `${event.termSkill.characteristic.key.toUpperCase()} +${event.termSkill.characteristic.modifier}`
          : null,
        event.termSkill.pendingCascadeSkill
          ? `cascade ${event.termSkill.pendingCascadeSkill}`
          : null
      ]
        .filter(Boolean)
        .join('; ')
    case 'RESOLVE_TERM_CASCADE_SKILL':
      return `${event.cascadeSkill}: ${event.selection}`
    case 'COMPLETE_SKILLS':
      return 'Skills and training complete'
    case 'COMPLETE_AGING':
      return agingDetails(event)
    case 'DECIDE_ANAGATHICS':
      if (event.passed === false) {
        return 'Anagathics survival failed; career mishap'
      }
      return event.useAnagathics
        ? event.cost !== undefined
          ? `Anagathics used this term; cost Cr${event.cost}`
          : 'Anagathics used this term'
        : 'Anagathics skipped this term'
    case 'ANAGATHICS_FAILED':
      return 'Anagathics survival failed; career mishap'
    case 'RESOLVE_REENLISTMENT':
      return reenlistmentDetails({
        outcome: event.reenlistment.outcome,
        total: event.reenlistment.total,
        target: event.reenlistment.target,
        modifier: event.reenlistment.modifier
      })
    case 'REENLIST':
      return 'Reenlisted for another term'
    case 'LEAVE_CAREER':
      return 'Leaving career'
    case 'REENLIST_BLOCKED':
      return 'Reenlistment blocked'
    case 'FORCED_REENLIST':
      return 'Forced reenlistment'
    case 'CONTINUE_CAREER':
      return 'Continuing career'
    case 'FINISH_MUSTERING':
      return musteringBenefitDetails(event)
    case 'CREATION_COMPLETE':
      return 'Creation complete'
    case 'DEATH_CONFIRMED':
      return 'Death confirmed'
    case 'MISHAP_RESOLVED':
      return event.mishap?.outcome.description ?? 'Mishap resolved'
    case 'INJURY_RESOLVED':
      return 'Injury resolved'
    case 'RESET':
      return 'Creation reset'
    default: {
      const exhaustive: never = event
      return exhaustive
    }
  }
}

const compactCharacterCreationDetails = (
  value: string | null
): { details?: string } => (value ? { details: boundedText(value) } : {})

const characterCreationRevealMetadata = (
  rollEventId: EventId | undefined,
  createdAt: string
): { reveal?: CharacterCreationActivityRevealMetadata } =>
  rollEventId
    ? {
        reveal: {
          rollEventId,
          revealAt: deriveLiveActivityRevealAt(createdAt),
          delayMs: LIVE_DICE_RESULT_REVEAL_DELAY_MS
        }
      }
    : {}

export const deriveLiveActivity = (
  envelope: EventEnvelope
): LiveActivityDescriptor | null => {
  const event = envelope.event

  switch (event.type) {
    case 'DiceRolled': {
      const rolls = event.rolls.slice(0, MAX_LIVE_ACTIVITY_ROLLS)
      const rollsOmitted = event.rolls.length - rolls.length

      return {
        ...baseActivity(envelope),
        type: 'diceRoll',
        expression: boundedText(event.expression),
        reason: boundedText(event.reason),
        rolls,
        ...(rollsOmitted > 0 ? { rollsOmitted } : {}),
        total: event.total,
        reveal: {
          revealAt: deriveLiveActivityRevealAt(envelope.createdAt),
          delayMs: LIVE_DICE_RESULT_REVEAL_DELAY_MS
        }
      }
    }

    case 'CharacterCreationTransitioned':
      return {
        ...baseActivity(envelope),
        type: 'characterCreation',
        characterId: event.characterId,
        transition: event.creationEvent.type,
        ...compactCharacterCreationDetails(
          describeCareerCreationEvent(event.creationEvent)
        ),
        status: event.state.status,
        creationComplete: event.creationComplete
      }

    case 'CharacterCreationCharacteristicRolled':
      return {
        ...baseActivity(envelope),
        type: 'characterCreation',
        characterId: event.characterId,
        transition: 'CHARACTERISTIC_ROLLED',
        details: `${event.characteristic.toUpperCase()} characteristic ${event.value}`,
        ...characterCreationRevealMetadata(
          event.rollEventId,
          envelope.createdAt
        ),
        status: event.state.status,
        creationComplete: event.creationComplete
      }

    case 'CharacterCreationCharacteristicsCompleted':
      return {
        ...baseActivity(envelope),
        type: 'characterCreation',
        characterId: event.characterId,
        transition: 'SET_CHARACTERISTICS',
        details: 'Characteristics assigned',
        ...characterCreationRevealMetadata(
          event.rollEventId,
          envelope.createdAt
        ),
        status: event.state.status,
        creationComplete: event.creationComplete
      }

    case 'CharacterCreationMishapResolved':
      return {
        ...baseActivity(envelope),
        type: 'characterCreation',
        characterId: event.characterId,
        transition: 'MISHAP_RESOLVED',
        details: event.mishap?.outcome.description ?? 'Mishap resolved',
        ...characterCreationRevealMetadata(
          event.rollEventId,
          envelope.createdAt
        ),
        status: event.state.status,
        creationComplete: event.creationComplete
      }

    case 'CharacterCreationInjuryResolved':
      return {
        ...baseActivity(envelope),
        type: 'characterCreation',
        characterId: event.characterId,
        transition: 'INJURY_RESOLVED',
        details: [
          event.outcome.description,
          countLabel(event.selectedLosses.length, 'characteristic change')
        ].join('; '),
        ...characterCreationRevealMetadata(
          event.rollEventId,
          envelope.createdAt
        ),
        status: event.state.status,
        creationComplete: event.creationComplete
      }

    case 'CharacterCreationDeathConfirmed':
      return {
        ...baseActivity(envelope),
        type: 'characterCreation',
        characterId: event.characterId,
        transition: 'DEATH_CONFIRMED',
        details: 'Death confirmed',
        status: event.state.status,
        creationComplete: event.creationComplete
      }

    case 'CharacterCreationStarted':
      return {
        ...baseActivity(envelope),
        type: 'characterCreation',
        characterId: event.characterId,
        transition: 'STARTED',
        details: 'Started character creation',
        status: event.creation.state.status,
        creationComplete: event.creation.creationComplete
      }

    case 'CharacterCreationHomeworldSet': {
      const homeworldName = event.homeworld.name ?? 'Homeworld'
      const tradeCodes = event.homeworld.tradeCodes.join(', ')
      const summary = [
        `Homeworld: ${homeworldName}`,
        tradeCodes ? `trade codes ${tradeCodes}` : null,
        countLabel(event.backgroundSkills.length, 'background skill'),
        event.pendingCascadeSkills.length > 0
          ? countLabel(
              event.pendingCascadeSkills.length,
              'pending cascade',
              'pending cascades'
            )
          : null
      ]
        .filter(Boolean)
        .join('; ')

      return {
        ...baseActivity(envelope),
        type: 'characterCreation',
        characterId: event.characterId,
        transition: 'HOMEWORLD_SET',
        ...compactCharacterCreationDetails(summary),
        status: 'HOMEWORLD',
        creationComplete: false
      }
    }

    case 'CharacterCreationHomeworldCompleted':
      return {
        ...baseActivity(envelope),
        type: 'characterCreation',
        characterId: event.characterId,
        transition: 'COMPLETE_HOMEWORLD',
        details: 'Homeworld complete',
        status: event.state.status,
        creationComplete: event.creationComplete
      }

    case 'CharacterCreationBackgroundSkillSelected':
      return {
        ...baseActivity(envelope),
        type: 'characterCreation',
        characterId: event.characterId,
        transition: 'BACKGROUND_SKILL_SELECTED',
        ...compactCharacterCreationDetails(
          [
            `Background skill: ${event.skill}`,
            countLabel(
              event.backgroundSkills.length,
              'background skill selected',
              'background skills selected'
            ),
            event.pendingCascadeSkills.length > 0
              ? countLabel(
                  event.pendingCascadeSkills.length,
                  'pending cascade',
                  'pending cascades'
                )
              : null
          ]
            .filter(Boolean)
            .join('; ')
        ),
        status: 'HOMEWORLD',
        creationComplete: false
      }

    case 'CharacterCreationBasicTrainingCompleted':
      return {
        ...baseActivity(envelope),
        type: 'characterCreation',
        characterId: event.characterId,
        transition: 'COMPLETE_BASIC_TRAINING',
        ...compactCharacterCreationDetails(
          basicTrainingDetails(event.trainingSkills)
        ),
        status: event.state.status,
        creationComplete: event.creationComplete
      }

    case 'CharacterCreationSurvivalResolved':
      return {
        ...baseActivity(envelope),
        type: 'characterCreation',
        characterId: event.characterId,
        transition: event.passed ? 'SURVIVAL_PASSED' : 'SURVIVAL_FAILED',
        ...compactCharacterCreationDetails(
          survivalDetails({
            passed: event.passed,
            total: event.survival.total,
            target: event.survival.target,
            modifier: event.survival.modifier,
            canCommission: event.canCommission,
            canAdvance: event.canAdvance
          })
        ),
        ...characterCreationRevealMetadata(
          event.rollEventId,
          envelope.createdAt
        ),
        status: event.state.status,
        creationComplete: event.creationComplete
      }

    case 'CharacterCreationCommissionResolved':
      return {
        ...baseActivity(envelope),
        type: 'characterCreation',
        characterId: event.characterId,
        transition: event.passed ? 'COMMISSION_PASSED' : 'COMMISSION_FAILED',
        ...compactCharacterCreationDetails(
          commissionDetails({
            passed: event.passed,
            total: event.commission.total,
            target: event.commission.target,
            modifier: event.commission.modifier
          })
        ),
        ...characterCreationRevealMetadata(
          event.rollEventId,
          envelope.createdAt
        ),
        status: event.state.status,
        creationComplete: event.creationComplete
      }

    case 'CharacterCreationCommissionSkipped':
      return {
        ...baseActivity(envelope),
        type: 'characterCreation',
        characterId: event.characterId,
        transition: 'SKIP_COMMISSION',
        status: event.state.status,
        creationComplete: event.creationComplete
      }

    case 'CharacterCreationAdvancementResolved':
      return {
        ...baseActivity(envelope),
        type: 'characterCreation',
        characterId: event.characterId,
        transition: event.passed ? 'ADVANCEMENT_PASSED' : 'ADVANCEMENT_FAILED',
        ...compactCharacterCreationDetails(
          advancementDetails({
            passed: event.passed,
            total: event.advancement.total,
            target: event.advancement.target,
            modifier: event.advancement.modifier,
            rank: event.rank
          })
        ),
        ...characterCreationRevealMetadata(
          event.rollEventId,
          envelope.createdAt
        ),
        status: event.state.status,
        creationComplete: event.creationComplete
      }

    case 'CharacterCreationAdvancementSkipped':
      return {
        ...baseActivity(envelope),
        type: 'characterCreation',
        characterId: event.characterId,
        transition: 'SKIP_ADVANCEMENT',
        status: event.state.status,
        creationComplete: event.creationComplete
      }

    case 'CharacterCreationAgingResolved':
      return {
        ...baseActivity(envelope),
        type: 'characterCreation',
        characterId: event.characterId,
        transition: 'COMPLETE_AGING',
        ...compactCharacterCreationDetails(
          agingDetails({
            type: 'COMPLETE_AGING',
            aging: event.aging
          })
        ),
        ...characterCreationRevealMetadata(
          event.rollEventId,
          envelope.createdAt
        ),
        status: event.state.status,
        creationComplete: event.creationComplete
      }

    case 'CharacterCreationAgingLossesResolved':
      return {
        ...baseActivity(envelope),
        type: 'characterCreation',
        characterId: event.characterId,
        transition: 'AGING_LOSSES_RESOLVED',
        ...compactCharacterCreationDetails(
          [
            'Aging losses applied',
            countLabel(event.selectedLosses.length, 'selection')
          ].join('; ')
        ),
        status: event.state.status,
        creationComplete: event.creationComplete
      }

    case 'CharacterCreationAnagathicsDecided':
      return {
        ...baseActivity(envelope),
        type: 'characterCreation',
        characterId: event.characterId,
        transition: 'DECIDE_ANAGATHICS',
        details:
          event.passed === false
            ? 'Anagathics survival failed; career mishap'
            : event.useAnagathics && event.cost !== undefined
              ? `Anagathics used this term; cost Cr${event.cost}`
              : event.useAnagathics
                ? 'Anagathics used this term'
                : 'Anagathics skipped this term',
        ...characterCreationRevealMetadata(
          event.rollEventId,
          envelope.createdAt
        ),
        status: event.state.status,
        creationComplete: event.creationComplete
      }

    case 'CharacterCreationReenlistmentResolved':
      return {
        ...baseActivity(envelope),
        type: 'characterCreation',
        characterId: event.characterId,
        transition:
          event.outcome === 'forced'
            ? 'REENLIST_FORCED'
            : event.outcome === 'allowed'
              ? 'REENLIST_ALLOWED'
              : 'REENLIST_BLOCKED',
        ...compactCharacterCreationDetails(
          reenlistmentDetails({
            outcome: event.outcome,
            total: event.reenlistment.total,
            target: event.reenlistment.target,
            modifier: event.reenlistment.modifier
          })
        ),
        ...characterCreationRevealMetadata(
          event.rollEventId,
          envelope.createdAt
        ),
        status: event.state.status,
        creationComplete: event.creationComplete
      }

    case 'CharacterCreationCareerReenlisted':
      return {
        ...baseActivity(envelope),
        type: 'characterCreation',
        characterId: event.characterId,
        transition: event.forced ? 'FORCED_REENLIST' : 'REENLIST',
        details: event.forced
          ? 'Forced reenlistment'
          : 'Reenlisted for another term',
        status: event.state.status,
        creationComplete: event.creationComplete
      }

    case 'CharacterCreationCareerLeft':
      return {
        ...baseActivity(envelope),
        type: 'characterCreation',
        characterId: event.characterId,
        transition:
          event.outcome === 'blocked' ? 'REENLIST_BLOCKED' : 'LEAVE_CAREER',
        details: event.retirement
          ? 'Retired from career'
          : event.outcome === 'blocked'
            ? 'Reenlistment blocked'
            : 'Leaving career',
        status: event.state.status,
        creationComplete: event.creationComplete
      }

    case 'CharacterCreationTermSkillRolled':
      return {
        ...baseActivity(envelope),
        type: 'characterCreation',
        characterId: event.characterId,
        transition: 'TERM_SKILL_ROLLED',
        ...compactCharacterCreationDetails(
          describeCareerCreationEvent({
            type: 'ROLL_TERM_SKILL',
            termSkill: event.termSkill
          })
        ),
        ...characterCreationRevealMetadata(
          event.rollEventId,
          envelope.createdAt
        ),
        status: event.state.status,
        creationComplete: event.creationComplete
      }

    case 'CharacterCreationTermCascadeSkillResolved':
      return {
        ...baseActivity(envelope),
        type: 'characterCreation',
        characterId: event.characterId,
        transition: 'TERM_CASCADE_SKILL_RESOLVED',
        ...compactCharacterCreationDetails(
          describeCareerCreationEvent({
            type: 'RESOLVE_TERM_CASCADE_SKILL',
            cascadeSkill: event.cascadeSkill,
            selection: event.selection
          })
        ),
        status: 'SKILLS_TRAINING',
        creationComplete: false
      }

    case 'CharacterCreationSkillsCompleted':
      return {
        ...baseActivity(envelope),
        type: 'characterCreation',
        characterId: event.characterId,
        transition: 'COMPLETE_SKILLS',
        details: 'Skills and training complete',
        status: event.state.status,
        creationComplete: event.creationComplete
      }

    case 'CharacterCreationMusteringBenefitRolled':
      return {
        ...baseActivity(envelope),
        type: 'characterCreation',
        characterId: event.characterId,
        transition: 'FINISH_MUSTERING',
        ...compactCharacterCreationDetails(
          describeCareerCreationEvent({
            type: 'FINISH_MUSTERING',
            musteringBenefit: event.musteringBenefit
          })
        ),
        ...characterCreationRevealMetadata(
          event.rollEventId,
          envelope.createdAt
        ),
        status: event.state.status,
        creationComplete: event.creationComplete
      }

    case 'CharacterCreationAfterMusteringContinued':
      return {
        ...baseActivity(envelope),
        type: 'characterCreation',
        characterId: event.characterId,
        transition: 'CONTINUE_CAREER',
        details: 'Continuing career',
        status: event.state.status,
        creationComplete: event.creationComplete
      }

    case 'CharacterCreationMusteringCompleted':
      return {
        ...baseActivity(envelope),
        type: 'characterCreation',
        characterId: event.characterId,
        transition: 'FINISH_MUSTERING',
        details: 'Mustering out complete',
        status: event.state.status,
        creationComplete: event.creationComplete
      }

    case 'CharacterCreationCompleted':
      return {
        ...baseActivity(envelope),
        type: 'characterCreation',
        characterId: event.characterId,
        transition: 'CREATION_COMPLETE',
        details: 'Creation complete',
        status: event.state.status,
        creationComplete: event.creationComplete
      }

    case 'CharacterCreationCascadeSkillResolved':
      return {
        ...baseActivity(envelope),
        type: 'characterCreation',
        characterId: event.characterId,
        transition: 'CASCADE_SKILL_RESOLVED',
        ...compactCharacterCreationDetails(
          [
            `${event.cascadeSkill}: ${event.selection}`,
            countLabel(
              event.pendingCascadeSkills.length,
              'pending cascade',
              'pending cascades'
            )
          ].join('; ')
        ),
        status: 'HOMEWORLD',
        creationComplete: false
      }

    case 'CharacterCreationFinalized':
      return {
        ...baseActivity(envelope),
        type: 'characterCreation',
        characterId: event.characterId,
        transition: 'FINALIZED',
        ...compactCharacterCreationDetails(
          [
            'Finalized character',
            event.age === null ? null : `age ${event.age}`,
            countLabel(event.skills.length, 'skill'),
            countLabel(event.equipment.length, 'equipment item')
          ]
            .filter(Boolean)
            .join('; ')
        ),
        status: 'PLAYABLE',
        creationComplete: true
      }

    case 'CharacterCreationQualificationResolved':
      return {
        ...baseActivity(envelope),
        type: 'characterCreation',
        characterId: event.characterId,
        transition: event.passed
          ? 'CAREER_QUALIFICATION_PASSED'
          : 'CAREER_QUALIFICATION_FAILED',
        ...compactCharacterCreationDetails(
          [
            event.career,
            `qualification ${event.qualification.total}`,
            event.passed ? 'accepted' : 'failed',
            event.failedQualificationOptions.length > 0
              ? `fallback ${listLabel(event.failedQualificationOptions)}`
              : null
          ]
            .filter(Boolean)
            .join('; ')
        ),
        ...characterCreationRevealMetadata(
          event.rollEventId,
          envelope.createdAt
        ),
        status: event.state.status,
        creationComplete: event.creationComplete
      }

    case 'CharacterCreationDraftResolved':
      return {
        ...baseActivity(envelope),
        type: 'characterCreation',
        characterId: event.characterId,
        transition: 'DRAFT_RESOLVED',
        ...compactCharacterCreationDetails(
          `Draft ${event.draft.tableRoll}; ${event.draft.acceptedCareer}`
        ),
        ...characterCreationRevealMetadata(
          event.rollEventId,
          envelope.createdAt
        ),
        status: event.state.status,
        creationComplete: event.creationComplete
      }

    case 'CharacterCreationDrifterEntered':
      return {
        ...baseActivity(envelope),
        type: 'characterCreation',
        characterId: event.characterId,
        transition: 'DRIFTER_ENTERED',
        ...compactCharacterCreationDetails('Entered Drifter'),
        status: event.state.status,
        creationComplete: event.creationComplete
      }

    case 'CharacterCareerTermStarted': {
      const acceptedCareer = event.acceptedCareer
      const requestedCareer = event.requestedCareer

      return {
        ...baseActivity(envelope),
        type: 'characterCreation',
        characterId: event.characterId,
        transition: 'CAREER_TERM_STARTED',
        ...compactCharacterCreationDetails(
          [
            'Term started',
            requestedCareer === acceptedCareer
              ? acceptedCareer
              : `${requestedCareer} -> ${acceptedCareer}`,
            event.drafted ? 'drafted' : null
          ]
            .filter(Boolean)
            .join('; ')
        ),
        status: 'CAREER_SELECTION',
        creationComplete: false
      }
    }

    default:
      return null
  }
}

export const deriveLiveActivities = (
  envelopes: readonly EventEnvelope[]
): LiveActivityDescriptor[] => {
  const activities: LiveActivityDescriptor[] = []

  for (const envelope of envelopes) {
    const activity = deriveLiveActivity(envelope)
    if (!activity) continue
    activities.push(activity)
  }

  return activities
}
