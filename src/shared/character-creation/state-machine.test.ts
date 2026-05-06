import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  CAREER_CREATION_STATUSES,
  createCareerCreationState,
  transitionCareerCreationState
} from './state-machine'
import type {
  CareerCreationEvent,
  CareerCreationStatus,
  CareerCreationState
} from './types'

type NonResetCareerCreationEvent = Exclude<
  CareerCreationEvent,
  { type: 'RESET' }
>

type NonResetCareerCreationEventType = NonResetCareerCreationEvent['type']

type CareerCreationEventFixtures = {
  [Type in NonResetCareerCreationEventType]: readonly Extract<
    CareerCreationEvent,
    { type: Type }
  >[]
}

interface CareerCreationTransitionFixture {
  from: CareerCreationStatus
  event: NonResetCareerCreationEvent
  to: CareerCreationStatus
  context?: CareerCreationState['context']
}

const eventFixtures = {
  SET_CHARACTERISTICS: [{ type: 'SET_CHARACTERISTICS' }],
  COMPLETE_HOMEWORLD: [{ type: 'COMPLETE_HOMEWORLD' }],
  SELECT_CAREER: [
    { type: 'SELECT_CAREER', isNewCareer: true },
    { type: 'SELECT_CAREER', isNewCareer: false }
  ],
  COMPLETE_BASIC_TRAINING: [{ type: 'COMPLETE_BASIC_TRAINING' }],
  SURVIVAL_PASSED: [
    { type: 'SURVIVAL_PASSED', canCommission: true, canAdvance: true },
    { type: 'SURVIVAL_PASSED', canCommission: false, canAdvance: true },
    { type: 'SURVIVAL_PASSED', canCommission: false, canAdvance: false }
  ],
  SURVIVAL_FAILED: [{ type: 'SURVIVAL_FAILED' }],
  COMPLETE_COMMISSION: [{ type: 'COMPLETE_COMMISSION' }],
  SKIP_COMMISSION: [{ type: 'SKIP_COMMISSION' }],
  COMPLETE_ADVANCEMENT: [{ type: 'COMPLETE_ADVANCEMENT' }],
  SKIP_ADVANCEMENT: [{ type: 'SKIP_ADVANCEMENT' }],
  COMPLETE_SKILLS: [{ type: 'COMPLETE_SKILLS' }],
  COMPLETE_AGING: [{ type: 'COMPLETE_AGING' }],
  REENLIST: [{ type: 'REENLIST' }],
  LEAVE_CAREER: [{ type: 'LEAVE_CAREER' }],
  REENLIST_BLOCKED: [{ type: 'REENLIST_BLOCKED' }],
  FORCED_REENLIST: [{ type: 'FORCED_REENLIST' }],
  CONTINUE_CAREER: [{ type: 'CONTINUE_CAREER' }],
  FINISH_MUSTERING: [{ type: 'FINISH_MUSTERING' }],
  CREATION_COMPLETE: [{ type: 'CREATION_COMPLETE' }],
  DEATH_CONFIRMED: [{ type: 'DEATH_CONFIRMED' }],
  MISHAP_RESOLVED: [{ type: 'MISHAP_RESOLVED' }]
} satisfies CareerCreationEventFixtures

const flattenEventFixtures = (): readonly NonResetCareerCreationEvent[] =>
  Object.values(eventFixtures).flat()

const findLegalTransition = (
  status: CareerCreationStatus,
  event: NonResetCareerCreationEvent,
  transitions: readonly CareerCreationTransitionFixture[]
): CareerCreationTransitionFixture | null =>
  transitions.find(
    (transition) => transition.from === status && transition.event === event
  ) ?? null

describe('career creation state machine transition matrix', () => {
  const allEvents = flattenEventFixtures()

  const legalTransitions = [
    {
      from: 'CHARACTERISTICS',
      event: eventFixtures.SET_CHARACTERISTICS[0],
      to: 'HOMEWORLD'
    },
    {
      from: 'HOMEWORLD',
      event: eventFixtures.COMPLETE_HOMEWORLD[0],
      to: 'CAREER_SELECTION'
    },
    {
      from: 'CAREER_SELECTION',
      event: eventFixtures.SELECT_CAREER[0],
      to: 'BASIC_TRAINING'
    },
    {
      from: 'CAREER_SELECTION',
      event: eventFixtures.SELECT_CAREER[1],
      to: 'SURVIVAL'
    },
    {
      from: 'BASIC_TRAINING',
      event: eventFixtures.COMPLETE_BASIC_TRAINING[0],
      to: 'SURVIVAL'
    },
    {
      from: 'SURVIVAL',
      event: eventFixtures.SURVIVAL_PASSED[0],
      to: 'COMMISSION',
      context: { canCommission: true, canAdvance: true }
    },
    {
      from: 'SURVIVAL',
      event: eventFixtures.SURVIVAL_PASSED[1],
      to: 'ADVANCEMENT',
      context: { canCommission: false, canAdvance: true }
    },
    {
      from: 'SURVIVAL',
      event: eventFixtures.SURVIVAL_PASSED[2],
      to: 'SKILLS_TRAINING',
      context: { canCommission: false, canAdvance: false }
    },
    {
      from: 'SURVIVAL',
      event: eventFixtures.SURVIVAL_FAILED[0],
      to: 'MISHAP'
    },
    {
      from: 'MISHAP',
      event: eventFixtures.DEATH_CONFIRMED[0],
      to: 'DECEASED'
    },
    {
      from: 'MISHAP',
      event: eventFixtures.MISHAP_RESOLVED[0],
      to: 'MUSTERING_OUT'
    },
    {
      from: 'COMMISSION',
      event: eventFixtures.COMPLETE_COMMISSION[0],
      to: 'SKILLS_TRAINING'
    },
    {
      from: 'COMMISSION',
      event: eventFixtures.SKIP_COMMISSION[0],
      to: 'SKILLS_TRAINING'
    },
    {
      from: 'ADVANCEMENT',
      event: eventFixtures.COMPLETE_ADVANCEMENT[0],
      to: 'SKILLS_TRAINING'
    },
    {
      from: 'ADVANCEMENT',
      event: eventFixtures.SKIP_ADVANCEMENT[0],
      to: 'SKILLS_TRAINING'
    },
    {
      from: 'SKILLS_TRAINING',
      event: eventFixtures.COMPLETE_SKILLS[0],
      to: 'AGING'
    },
    {
      from: 'AGING',
      event: eventFixtures.COMPLETE_AGING[0],
      to: 'REENLISTMENT'
    },
    {
      from: 'REENLISTMENT',
      event: eventFixtures.REENLIST[0],
      to: 'SURVIVAL'
    },
    {
      from: 'REENLISTMENT',
      event: eventFixtures.FORCED_REENLIST[0],
      to: 'SURVIVAL'
    },
    {
      from: 'REENLISTMENT',
      event: eventFixtures.LEAVE_CAREER[0],
      to: 'MUSTERING_OUT'
    },
    {
      from: 'REENLISTMENT',
      event: eventFixtures.REENLIST_BLOCKED[0],
      to: 'MUSTERING_OUT'
    },
    {
      from: 'MUSTERING_OUT',
      event: eventFixtures.CONTINUE_CAREER[0],
      to: 'CAREER_SELECTION'
    },
    {
      from: 'MUSTERING_OUT',
      event: eventFixtures.FINISH_MUSTERING[0],
      to: 'ACTIVE'
    },
    {
      from: 'ACTIVE',
      event: eventFixtures.CREATION_COMPLETE[0],
      to: 'PLAYABLE'
    }
  ] satisfies readonly CareerCreationTransitionFixture[]

  it('covers every status against every represented non-reset event', () => {
    for (const status of CAREER_CREATION_STATUSES) {
      for (const event of allEvents) {
        const state = createCareerCreationState(status)
        const transition = findLegalTransition(status, event, legalTransitions)
        const nextState = transitionCareerCreationState(state, event)

        if (transition === null) {
          assert.equal(
            nextState,
            state,
            `${status} should reject ${event.type}`
          )
          continue
        }

        assert.equal(
          nextState === state,
          false,
          `${status} should accept ${event.type}`
        )
        assert.equal(
          nextState.status,
          transition.to,
          `${status} with ${event.type} should transition to ${transition.to}`
        )
        assert.deepEqual(
          nextState.context,
          transition.context ?? state.context,
          `${status} with ${event.type} should preserve expected context`
        )
      }
    }
  })

  it('keeps reset global and outside the status transition table', () => {
    for (const status of CAREER_CREATION_STATUSES) {
      assert.deepEqual(
        transitionCareerCreationState(
          createCareerCreationState(status, {
            canCommission: true,
            canAdvance: true
          }),
          { type: 'RESET' }
        ),
        createCareerCreationState('CHARACTERISTICS'),
        `${status} should reset to a fresh characteristics state`
      )
    }
  })
})
