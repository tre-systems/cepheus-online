import type {
  PromotionOutcome,
  ReenlistmentDecision,
  ReenlistmentOutcome,
  TermOutcome,
  TermOutcomeResult
} from './types'

export const enumerateTermOutcomes = ({
  canCommission = false,
  canAdvance = false,
  canReenlist = true,
  mustRetire = false
}: {
  canCommission?: boolean
  canAdvance?: boolean
  canReenlist?: boolean
  mustRetire?: boolean
} = {}): TermOutcome[] => {
  const outcomes: TermOutcome[] = [
    {
      id: 'survival-fail',
      survival: 'fail',
      commission: 'na',
      advancement: 'na',
      reenlistment: 'blocked',
      decision: 'na',
      result: 'DECEASED'
    }
  ]

  const promotionPaths: Array<{
    commission: PromotionOutcome
    advancement: PromotionOutcome
  }> = []

  if (canCommission) {
    for (const commission of ['pass', 'fail', 'skip'] as const) {
      promotionPaths.push({ commission, advancement: 'na' })
    }
  }

  if (canAdvance) {
    for (const advancement of ['pass', 'fail', 'skip'] as const) {
      promotionPaths.push({ commission: 'na', advancement })
    }
  }

  if (promotionPaths.length === 0) {
    promotionPaths.push({ commission: 'na', advancement: 'na' })
  }

  const reenlistmentPaths: Array<{
    reenlistment: ReenlistmentOutcome
    decision: ReenlistmentDecision
    result: TermOutcomeResult
  }> = []

  if (mustRetire) {
    reenlistmentPaths.push({
      reenlistment: 'retire',
      decision: 'leave',
      result: 'MUSTERING_OUT'
    })
  } else if (!canReenlist) {
    reenlistmentPaths.push({
      reenlistment: 'blocked',
      decision: 'na',
      result: 'MUSTERING_OUT'
    })
  } else {
    reenlistmentPaths.push(
      {
        reenlistment: 'forced',
        decision: 'na',
        result: 'NEXT_TERM'
      },
      {
        reenlistment: 'allowed',
        decision: 'reenlist',
        result: 'NEXT_TERM'
      },
      {
        reenlistment: 'allowed',
        decision: 'leave',
        result: 'MUSTERING_OUT'
      },
      {
        reenlistment: 'blocked',
        decision: 'na',
        result: 'MUSTERING_OUT'
      }
    )
  }

  for (const promotion of promotionPaths) {
    for (const reenlistment of reenlistmentPaths) {
      outcomes.push({
        id: [
          'survival-pass',
          `commission-${promotion.commission}`,
          `advancement-${promotion.advancement}`,
          `reenlist-${reenlistment.reenlistment}`,
          `decision-${reenlistment.decision}`
        ].join('__'),
        survival: 'pass',
        commission: promotion.commission,
        advancement: promotion.advancement,
        reenlistment: reenlistment.reenlistment,
        decision: reenlistment.decision,
        result: reenlistment.result
      })
    }
  }

  return outcomes
}
