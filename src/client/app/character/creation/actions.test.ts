import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { CharacterId, GameId, UserId } from '../../../../shared/ids'
import type {
  CharacterCreationProjection,
  CharacterState
} from '../../../../shared/state'
import { deriveCharacterCreationActionPlan } from './actions'

const identity = {
  gameId: 'demo-room' as GameId,
  actorId: 'local-user' as UserId
}

const creation = (
  status: CharacterCreationProjection['state']['status'],
  overrides: Partial<CharacterCreationProjection> = {}
): CharacterCreationProjection => ({
  state: {
    status,
    context: {
      canCommission: false,
      canAdvance: false
    }
  },
  terms: [],
  careers: [],
  canEnterDraft: true,
  failedToQualify: false,
  characteristicChanges: [],
  creationComplete: false,
  ...overrides
})

const character = (
  characterCreation: CharacterCreationProjection | null
): CharacterState => ({
  id: 'mae' as CharacterId,
  ownerId: identity.actorId,
  type: 'PLAYER',
  name: 'Mae',
  active: true,
  notes: '',
  age: 30,
  characteristics: {
    str: characterCreation?.state.status === 'CHARACTERISTICS' ? null : 7,
    dex: characterCreation?.state.status === 'CHARACTERISTICS' ? null : 7,
    end: characterCreation?.state.status === 'CHARACTERISTICS' ? null : 7,
    int: characterCreation?.state.status === 'CHARACTERISTICS' ? null : 7,
    edu: characterCreation?.state.status === 'CHARACTERISTICS' ? null : 7,
    soc: characterCreation?.state.status === 'CHARACTERISTICS' ? null : 7
  },
  skills: ['Gun Combat-0'],
  equipment: [],
  credits: 0,
  creation: characterCreation
})

const term = (
  overrides: Partial<
    NonNullable<CharacterCreationProjection['terms']>[number]
  > = {}
): NonNullable<CharacterCreationProjection['terms']>[number] => ({
  career: 'Scout',
  skills: [],
  skillsAndTraining: [],
  benefits: [],
  complete: false,
  canReenlist: false,
  completedBasicTraining: false,
  musteringOut: false,
  anagathics: false,
  ...overrides
})

const assertNoGenericLifecycleAdvance = (
  actions: NonNullable<
    ReturnType<typeof deriveCharacterCreationActionPlan>
  >['actions']
) => {
  const forbiddenGenericLifecycleEvents = new Set([
    'REENLIST',
    'FORCED_REENLIST',
    'LEAVE_CAREER',
    'REENLIST_BLOCKED',
    'CONTINUE_CAREER',
    'FINISH_MUSTERING',
    'MISHAP_RESOLVED',
    'DEATH_CONFIRMED'
  ])

  for (const availableAction of actions) {
    const command = availableAction.command
    if (command?.type !== 'AdvanceCharacterCreation') continue
    assert.equal(
      forbiddenGenericLifecycleEvents.has(command.creationEvent.type),
      false,
      `expected ${command.creationEvent.type} to use a semantic command`
    )
  }
}

const primaryActionKeys = (
  plan: ReturnType<typeof deriveCharacterCreationActionPlan>
): string[] =>
  (plan?.actions ?? [])
    .filter((availableAction) => availableAction.variant === 'primary')
    .map((availableAction) => availableAction.key)

describe('character creation actions', () => {
  it('starts creation for an existing character without creation state', () => {
    const plan = deriveCharacterCreationActionPlan(identity, character(null))

    assert.equal(plan?.status, 'Not started')
    assert.equal(plan?.actions[0]?.label, 'Start creation')
    assert.equal(plan?.actions[0]?.command?.type, 'StartCharacterCreation')
  })

  it('rolls qualification before selecting a career', () => {
    const plan = deriveCharacterCreationActionPlan(
      identity,
      character(creation('CAREER_SELECTION'))
    )

    assert.equal(plan?.status, 'Career Selection')
    assert.equal(
      plan?.actions[0]?.command?.type,
      'ResolveCharacterCreationQualification'
    )
  })

  it('routes complete homeworld legal actions to the semantic command', () => {
    const plan = deriveCharacterCreationActionPlan(
      identity,
      character(creation('HOMEWORLD'))
    )

    assert.equal(plan?.status, 'Homeworld')
    assert.equal(plan?.actions[0]?.key, 'complete-homeworld')
    assert.equal(
      plan?.actions[0]?.command?.type,
      'CompleteCharacterCreationHomeworld'
    )
    assert.deepEqual(plan?.actions[0]?.command, {
      type: 'CompleteCharacterCreationHomeworld',
      gameId: identity.gameId,
      actorId: identity.actorId,
      characterId: 'mae' as CharacterId
    })
  })

  it('routes characteristic rolls to the semantic server command', () => {
    const plan = deriveCharacterCreationActionPlan(
      identity,
      character(creation('CHARACTERISTICS'))
    )

    assert.equal(plan?.status, 'Characteristics')
    assert.equal(plan?.actions[0]?.key, 'roll-str')
    assert.equal(
      plan?.actions[0]?.command?.type,
      'RollCharacterCreationCharacteristic'
    )
    const command = plan?.actions[0]?.command
    if (command?.type !== 'RollCharacterCreationCharacteristic') return
    assert.equal(command.characteristic, 'str')
  })

  it('rolls qualification for a later career selection', () => {
    const plan = deriveCharacterCreationActionPlan(
      identity,
      character(
        creation('CAREER_SELECTION', {
          terms: [
            {
              career: 'Scout',
              skills: [],
              skillsAndTraining: [],
              benefits: [],
              complete: false,
              canReenlist: false,
              completedBasicTraining: false,
              musteringOut: false,
              anagathics: false
            }
          ],
          careers: [{ name: 'Scout', rank: 0 }]
        })
      )
    )

    assert.equal(
      plan?.actions[0]?.command?.type,
      'ResolveCharacterCreationQualification'
    )
    const command = plan?.actions[0]?.command
    if (command?.type !== 'ResolveCharacterCreationQualification') return
    assert.equal(command.career, 'Scout')
  })

  it('offers a complete happy path from basic training to playable', () => {
    const expectations: {
      status: CharacterCreationProjection['state']['status']
      eventType: string
      overrides: Partial<CharacterCreationProjection>
    }[] = [
      {
        status: 'SKILLS_TRAINING',
        eventType: 'COMPLETE_SKILLS',
        overrides: {}
      },
      {
        status: 'REENLISTMENT',
        eventType: 'LEAVE_CAREER',
        overrides: {
          terms: [term({ reEnlistment: 7, skillsAndTraining: ['Pilot-1'] })]
        }
      },
      {
        status: 'MUSTERING_OUT',
        eventType: 'FINISH_MUSTERING',
        overrides: {
          terms: [
            term({
              benefits: ['Low Passage'],
              complete: true,
              musteringOut: true
            })
          ],
          careers: [{ name: 'Scout', rank: 0 }]
        }
      },
      {
        status: 'ACTIVE',
        eventType: 'CREATION_COMPLETE',
        overrides: { terms: [term({ complete: true })] }
      }
    ]

    for (const { status, eventType, overrides } of expectations) {
      const plan = deriveCharacterCreationActionPlan(
        identity,
        character(
          creation(status, {
            state: {
              status,
              context: {
                canCommission: false,
                canAdvance: status === 'ADVANCEMENT'
              }
            },
            ...overrides
          })
        )
      )
      const command = plan?.actions[0]?.command
      if (eventType === 'COMPLETE_SKILLS') {
        assert.equal(command?.type, 'CompleteCharacterCreationSkills')
        continue
      }
      if (eventType === 'FINISH_MUSTERING') {
        assert.equal(
          plan?.actions.find(
            (availableAction) => availableAction.key === 'finish-mustering'
          )?.command?.type,
          'CompleteCharacterCreationMustering'
        )
        continue
      }
      if (eventType === 'CREATION_COMPLETE') {
        assert.equal(command?.type, 'FinalizeCharacterCreation')
        continue
      }
      if (eventType === 'LEAVE_CAREER') {
        assert.equal(command?.type, 'LeaveCharacterCreationCareer')
        continue
      }
      assert.equal(command?.type, 'AdvanceCharacterCreation')
      if (command?.type !== 'AdvanceCharacterCreation') continue
      assert.equal(command.creationEvent.type, eventType)
    }
  })

  it('uses semantic commands for commission and advancement decisions', () => {
    const commissionPlan = deriveCharacterCreationActionPlan(
      identity,
      character(
        creation('COMMISSION', {
          state: {
            status: 'COMMISSION',
            context: {
              canCommission: true,
              canAdvance: true
            }
          }
        })
      )
    )
    const advancementPlan = deriveCharacterCreationActionPlan(
      identity,
      character(
        creation('ADVANCEMENT', {
          state: {
            status: 'ADVANCEMENT',
            context: {
              canCommission: false,
              canAdvance: true
            }
          }
        })
      )
    )

    assert.deepEqual(
      commissionPlan?.actions.find((availableAction) => {
        return availableAction.key === 'complete-commission'
      })?.command,
      {
        type: 'ResolveCharacterCreationCommission',
        gameId: identity.gameId,
        actorId: identity.actorId,
        characterId: 'mae' as CharacterId
      }
    )
    assert.deepEqual(
      commissionPlan?.actions.find((availableAction) => {
        return availableAction.key === 'skip-commission'
      })?.command,
      {
        type: 'SkipCharacterCreationCommission',
        gameId: identity.gameId,
        actorId: identity.actorId,
        characterId: 'mae' as CharacterId
      }
    )
    assert.deepEqual(
      advancementPlan?.actions.find((availableAction) => {
        return availableAction.key === 'complete-advancement'
      })?.command,
      {
        type: 'ResolveCharacterCreationAdvancement',
        gameId: identity.gameId,
        actorId: identity.actorId,
        characterId: 'mae' as CharacterId
      }
    )
    assert.deepEqual(
      advancementPlan?.actions.find((availableAction) => {
        return availableAction.key === 'skip-advancement'
      })?.command,
      {
        type: 'SkipCharacterCreationAdvancement',
        gameId: identity.gameId,
        actorId: identity.actorId,
        characterId: 'mae' as CharacterId
      }
    )
  })

  it('uses the semantic command for rolling survival', () => {
    const plan = deriveCharacterCreationActionPlan(
      identity,
      character(
        creation('SURVIVAL', {
          terms: [term({ completedBasicTraining: true })]
        })
      )
    )

    assert.equal(plan?.actions[0]?.key, 'roll-survival')
    assert.deepEqual(plan?.actions[0]?.command, {
      type: 'ResolveCharacterCreationSurvival',
      gameId: identity.gameId,
      actorId: identity.actorId,
      characterId: 'mae' as CharacterId
    })
  })

  it('uses semantic commands for mishap resolution and death confirmation', () => {
    const plan = deriveCharacterCreationActionPlan(
      identity,
      character(creation('MISHAP'))
    )

    assert.deepEqual(
      plan?.actions.map((availableAction) => availableAction.key),
      ['resolve-mishap', 'death-confirmed']
    )
    assert.deepEqual(plan?.actions[0]?.command, {
      type: 'ResolveCharacterCreationMishap',
      gameId: identity.gameId,
      actorId: identity.actorId,
      characterId: 'mae' as CharacterId
    })
    assert.deepEqual(plan?.actions[1]?.command, {
      type: 'ConfirmCharacterCreationDeath',
      gameId: identity.gameId,
      actorId: identity.actorId,
      characterId: 'mae' as CharacterId
    })
    assertNoGenericLifecycleAdvance(plan?.actions ?? [])
  })

  it('uses the semantic command for completing basic training', () => {
    const plan = deriveCharacterCreationActionPlan(
      identity,
      character(
        creation('BASIC_TRAINING', {
          terms: [term({ skillsAndTraining: ['Pilot-0'] })]
        })
      )
    )

    assert.equal(
      plan?.actions[0]?.command?.type,
      'CompleteCharacterCreationBasicTraining'
    )
  })

  it('uses semantic term skill roll commands while term skills are pending', () => {
    const scout = character(
      creation('SKILLS_TRAINING', {
        state: {
          status: 'SKILLS_TRAINING',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        terms: [term({ career: 'Scout', survival: 7 })]
      })
    )
    scout.characteristics.edu = 8

    const plan = deriveCharacterCreationActionPlan(identity, scout)

    assert.deepEqual(
      plan?.actions.map((availableAction) => availableAction.key),
      [
        'roll-personal-development',
        'roll-service-skills',
        'roll-specialist-skills',
        'roll-advanced-education'
      ]
    )
    assert.deepEqual(plan?.actions[1]?.command, {
      type: 'RollCharacterCreationTermSkill',
      gameId: identity.gameId,
      actorId: identity.actorId,
      characterId: 'mae' as CharacterId,
      table: 'serviceSkills'
    })
    assert.deepEqual(primaryActionKeys(plan), ['roll-personal-development'])
  })

  it('hides advanced education term skill rolls below EDU 8', () => {
    const plan = deriveCharacterCreationActionPlan(
      identity,
      character(
        creation('SKILLS_TRAINING', {
          terms: [term({ career: 'Scout', survival: 7 })]
        })
      )
    )

    assert.deepEqual(
      plan?.actions.map((availableAction) => availableAction.key),
      [
        'roll-personal-development',
        'roll-service-skills',
        'roll-specialist-skills'
      ]
    )
  })

  it('keeps complete skills routing after required term skills are rolled', () => {
    const plan = deriveCharacterCreationActionPlan(
      identity,
      character(
        creation('SKILLS_TRAINING', {
          state: {
            status: 'SKILLS_TRAINING',
            context: {
              canCommission: true,
              canAdvance: false
            }
          },
          terms: [term({ career: 'Scout', survival: 7, skills: ['Pilot-1'] })]
        })
      )
    )

    assert.equal(plan?.actions[0]?.key, 'complete-skills')
    assert.equal(
      plan?.actions[0]?.command?.type,
      'CompleteCharacterCreationSkills'
    )
    const command = plan?.actions[0]?.command
    if (command?.type !== 'CompleteCharacterCreationSkills') return
    assert.equal(command.characterId, 'mae')
  })

  it('uses the semantic command for resolving aging', () => {
    const plan = deriveCharacterCreationActionPlan(
      identity,
      character(creation('AGING'))
    )

    assert.equal(plan?.actions[0]?.key, 'complete-aging')
    assert.deepEqual(plan?.actions[0]?.command, {
      type: 'ResolveCharacterCreationAging',
      gameId: identity.gameId,
      actorId: identity.actorId,
      characterId: 'mae' as CharacterId
    })
  })

  it('does not offer generic aging completion while aging losses need choices', () => {
    const plan = deriveCharacterCreationActionPlan(
      identity,
      character(
        creation('AGING', {
          characteristicChanges: [{ type: 'PHYSICAL', modifier: -1 }]
        })
      )
    )

    assert.deepEqual(plan?.actions, [])
  })

  it('uses semantic commands for deciding anagathics before aging', () => {
    const plan = deriveCharacterCreationActionPlan(
      identity,
      character(
        creation('AGING', {
          terms: [term({ survival: 8 })]
        })
      )
    )

    assert.deepEqual(
      plan?.actions.map((action) => action.key),
      ['use-anagathics', 'skip-anagathics']
    )
    assert.deepEqual(plan?.actions[0]?.command, {
      type: 'DecideCharacterCreationAnagathics',
      gameId: identity.gameId,
      actorId: identity.actorId,
      characterId: 'mae' as CharacterId,
      useAnagathics: true
    })
    assert.deepEqual(plan?.actions[1]?.command, {
      type: 'DecideCharacterCreationAnagathics',
      gameId: identity.gameId,
      actorId: identity.actorId,
      characterId: 'mae' as CharacterId,
      useAnagathics: false
    })
  })

  it('has no action once creation is playable', () => {
    const plan = deriveCharacterCreationActionPlan(
      identity,
      character(creation('PLAYABLE', { creationComplete: true }))
    )

    assert.equal(plan?.status, 'Playable')
    assert.deepEqual(plan?.actions, [])
  })

  it('hides illegal promotion actions through the shared planner', () => {
    const plan = deriveCharacterCreationActionPlan(
      identity,
      character(creation('COMMISSION'))
    )

    assert.equal(plan?.status, 'Commission')
    assert.deepEqual(plan?.actions, [])
  })

  it('hides pending decision actions through the shared planner', () => {
    const plan = deriveCharacterCreationActionPlan(
      identity,
      character(
        creation('SKILLS_TRAINING', {
          pendingCascadeSkills: ['Gun Combat']
        })
      )
    )

    assert.equal(plan?.status, 'Skills Training')
    assert.deepEqual(plan?.actions, [])
  })

  it('uses projected legal actions when the server projection supplies them', () => {
    const plan = deriveCharacterCreationActionPlan(
      identity,
      character(
        creation('SURVIVAL', {
          actionPlan: {
            status: 'SURVIVAL',
            pendingDecisions: [{ key: 'survivalResolution' }],
            legalActions: []
          }
        })
      )
    )

    assert.equal(plan?.status, 'Survival')
    assert.deepEqual(plan?.actions, [])
  })

  it('uses semantic commands for projected mustering benefit rolls', () => {
    const plan = deriveCharacterCreationActionPlan(
      identity,
      character(
        creation('MUSTERING_OUT', {
          terms: [term({ complete: true, musteringOut: true })],
          careers: [{ name: 'Scout', rank: 0 }]
        })
      )
    )

    assert.equal(plan?.status, 'Mustering Out')
    assert.deepEqual(
      plan?.actions.map((availableAction) => availableAction.key),
      ['roll-mustering-cash-scout', 'roll-mustering-material-scout']
    )
    assert.deepEqual(plan?.actions[0]?.command, {
      type: 'RollCharacterCreationMusteringBenefit',
      gameId: identity.gameId,
      actorId: identity.actorId,
      characterId: 'mae' as CharacterId,
      career: 'Scout',
      kind: 'cash'
    })
    assert.deepEqual(plan?.actions[1]?.command, {
      type: 'RollCharacterCreationMusteringBenefit',
      gameId: identity.gameId,
      actorId: identity.actorId,
      characterId: 'mae' as CharacterId,
      career: 'Scout',
      kind: 'material'
    })
    assert.deepEqual(primaryActionKeys(plan), ['roll-mustering-cash-scout'])
  })

  it('offers only material mustering benefits after the cash limit', () => {
    const cashBenefit = {
      career: 'Scout',
      kind: 'cash' as const,
      roll: {
        expression: '2d6' as const,
        rolls: [1, 2],
        total: 3
      },
      modifier: 0,
      tableRoll: 3,
      value: '10000',
      credits: 10000,
      materialItem: null
    }
    const plan = deriveCharacterCreationActionPlan(
      identity,
      character(
        creation('MUSTERING_OUT', {
          terms: [
            term({
              benefits: ['10000', '10000', '10000'],
              complete: true,
              musteringOut: true
            }),
            term({ complete: true, musteringOut: true })
          ],
          careers: [{ name: 'Scout', rank: 4 }],
          history: [
            { type: 'FINISH_MUSTERING', musteringBenefit: cashBenefit },
            { type: 'FINISH_MUSTERING', musteringBenefit: cashBenefit },
            { type: 'FINISH_MUSTERING', musteringBenefit: cashBenefit }
          ]
        })
      )
    )

    assert.deepEqual(
      plan?.actions.map((availableAction) => availableAction.key),
      ['roll-mustering-material-scout']
    )
    assert.deepEqual(plan?.actions[0]?.command, {
      type: 'RollCharacterCreationMusteringBenefit',
      gameId: identity.gameId,
      actorId: identity.actorId,
      characterId: 'mae' as CharacterId,
      career: 'Scout',
      kind: 'material'
    })
  })

  it('uses the semantic command for completing mustering', () => {
    const plan = deriveCharacterCreationActionPlan(
      identity,
      character(
        creation('MUSTERING_OUT', {
          terms: [
            term({
              complete: true,
              musteringOut: true,
              benefits: ['Low Passage']
            })
          ],
          careers: [{ name: 'Scout', rank: 0 }]
        })
      )
    )

    const finishMustering = plan?.actions.find(
      (availableAction) => availableAction.key === 'finish-mustering'
    )
    assert.deepEqual(finishMustering?.command, {
      type: 'CompleteCharacterCreationMustering',
      gameId: identity.gameId,
      actorId: identity.actorId,
      characterId: 'mae' as CharacterId
    })
  })

  it('uses the semantic command for unresolved reenlistment rolls', () => {
    const plan = deriveCharacterCreationActionPlan(
      identity,
      character(
        creation('REENLISTMENT', {
          terms: [term({ canReenlist: true, skillsAndTraining: ['Pilot-1'] })]
        })
      )
    )

    assert.equal(plan?.status, 'Reenlistment')
    assert.equal(plan?.actions[0]?.key, 'roll-reenlistment')
    assert.deepEqual(plan?.actions[0]?.command, {
      type: 'ResolveCharacterCreationReenlistment',
      gameId: identity.gameId,
      actorId: identity.actorId,
      characterId: 'mae' as CharacterId
    })
  })

  it('uses semantic commands for allowed reenlistment decisions', () => {
    const plan = deriveCharacterCreationActionPlan(
      identity,
      character(
        creation('REENLISTMENT', {
          terms: [
            term({
              canReenlist: true,
              reEnlistment: 7,
              survival: 8,
              skillsAndTraining: ['Pilot-1']
            })
          ]
        })
      )
    )

    assert.equal(plan?.status, 'Reenlistment')
    assert.deepEqual(
      [...(plan?.actions ?? [])]
        .map((availableAction) => availableAction.key)
        .sort(),
      ['leave-career', 'reenlist']
    )
    assert.deepEqual(
      plan?.actions.find((availableAction) => {
        return availableAction.key === 'reenlist'
      })?.command,
      {
        type: 'ReenlistCharacterCreationCareer',
        gameId: identity.gameId,
        actorId: identity.actorId,
        characterId: 'mae' as CharacterId
      }
    )
    assert.deepEqual(
      plan?.actions.find((availableAction) => {
        return availableAction.key === 'leave-career'
      })?.command,
      {
        type: 'LeaveCharacterCreationCareer',
        gameId: identity.gameId,
        actorId: identity.actorId,
        characterId: 'mae' as CharacterId
      }
    )
    assertNoGenericLifecycleAdvance(plan?.actions ?? [])
  })

  it('exposes exactly one primary next action for actionable projections', () => {
    const plans = [
      deriveCharacterCreationActionPlan(
        identity,
        character(creation('CHARACTERISTICS'))
      ),
      deriveCharacterCreationActionPlan(
        identity,
        character(creation('HOMEWORLD'))
      ),
      deriveCharacterCreationActionPlan(
        identity,
        character(
          creation('CAREER_SELECTION', {
            failedToQualify: true
          })
        )
      ),
      deriveCharacterCreationActionPlan(
        identity,
        character(
          creation('SKILLS_TRAINING', {
            terms: [term({ career: 'Scout', survival: 7 })]
          })
        )
      ),
      deriveCharacterCreationActionPlan(
        identity,
        character(
          creation('MUSTERING_OUT', {
            terms: [term({ complete: true, musteringOut: true })],
            careers: [{ name: 'Scout', rank: 0 }]
          })
        )
      ),
      deriveCharacterCreationActionPlan(
        identity,
        character(
          creation('REENLISTMENT', {
            terms: [
              term({
                canReenlist: true,
                reEnlistment: 7,
                survival: 8,
                skillsAndTraining: ['Pilot-1']
              })
            ]
          })
        )
      )
    ]

    assert.deepEqual(
      plans.map((plan) => primaryActionKeys(plan).length),
      [1, 1, 1, 1, 1, 1]
    )
  })

  it('renders term skill roll buttons from projected legal action options', () => {
    const plan = deriveCharacterCreationActionPlan(
      identity,
      character(
        creation('SKILLS_TRAINING', {
          terms: [term({ career: 'Scout', skills: [], survival: 7 })],
          actionPlan: {
            status: 'SKILLS_TRAINING',
            pendingDecisions: [{ key: 'skillTrainingSelection' }],
            legalActions: [
              {
                key: 'completeSkills',
                status: 'SKILLS_TRAINING',
                commandTypes: [
                  'RollCharacterCreationTermSkill',
                  'CompleteCharacterCreationSkills'
                ],
                termSkillTableOptions: [
                  { table: 'serviceSkills', label: 'Service skills' }
                ]
              }
            ]
          }
        })
      )
    )

    assert.deepEqual(plan?.actions, [
      {
        key: 'roll-service-skills',
        label: 'Service skills',
        command: {
          type: 'RollCharacterCreationTermSkill',
          gameId: identity.gameId,
          actorId: identity.actorId,
          characterId: 'mae' as CharacterId,
          table: 'serviceSkills'
        },
        variant: 'primary'
      }
    ])
  })

  it('renders mustering benefit buttons from projected legal action options', () => {
    const plan = deriveCharacterCreationActionPlan(
      identity,
      character(
        creation('MUSTERING_OUT', {
          terms: [term({ complete: true, musteringOut: true })],
          careers: [{ name: 'Scout', rank: 0 }],
          actionPlan: {
            status: 'MUSTERING_OUT',
            pendingDecisions: [{ key: 'musteringBenefitSelection' }],
            legalActions: [
              {
                key: 'resolveMusteringBenefit',
                status: 'MUSTERING_OUT',
                commandTypes: ['RollCharacterCreationMusteringBenefit'],
                musteringBenefitOptions: [{ career: 'Scout', kind: 'material' }]
              }
            ]
          }
        })
      )
    )

    assert.deepEqual(plan?.actions, [
      {
        key: 'roll-mustering-material-scout',
        label: 'Roll Scout material benefit',
        command: {
          type: 'RollCharacterCreationMusteringBenefit',
          gameId: identity.gameId,
          actorId: identity.actorId,
          characterId: 'mae' as CharacterId,
          career: 'Scout',
          kind: 'material'
        },
        variant: 'primary'
      }
    ])
  })

  it('uses the semantic reenlist command for forced reenlistment projections', () => {
    const plan = deriveCharacterCreationActionPlan(
      identity,
      character(
        creation('REENLISTMENT', {
          terms: [
            term({
              canReenlist: true,
              reEnlistment: 12,
              survival: 8,
              skillsAndTraining: ['Pilot-1']
            })
          ]
        })
      )
    )

    assert.equal(plan?.status, 'Reenlistment')
    assert.deepEqual(plan?.actions, [
      {
        key: 'reenlist',
        label: 'Serve required term',
        command: {
          type: 'ReenlistCharacterCreationCareer',
          gameId: identity.gameId,
          actorId: identity.actorId,
          characterId: 'mae' as CharacterId
        },
        variant: 'secondary'
      }
    ])
    assertNoGenericLifecycleAdvance(plan?.actions ?? [])
  })

  it('uses the semantic leave command when reenlistment is blocked or retired', () => {
    const blocked = deriveCharacterCreationActionPlan(
      identity,
      character(
        creation('REENLISTMENT', {
          terms: [
            term({
              canReenlist: false,
              reEnlistment: 4,
              survival: 8,
              skillsAndTraining: ['Pilot-1']
            })
          ]
        })
      )
    )
    const retired = deriveCharacterCreationActionPlan(
      identity,
      character(
        creation('REENLISTMENT', {
          terms: Array.from({ length: 7 }, () =>
            term({
              canReenlist: true,
              reEnlistment: 7,
              survival: 8,
              skillsAndTraining: ['Pilot-1']
            })
          )
        })
      )
    )

    for (const plan of [blocked, retired]) {
      assert.deepEqual(
        plan?.actions.map((availableAction) => availableAction.key),
        ['leave-career']
      )
      assert.deepEqual(plan?.actions[0]?.command, {
        type: 'LeaveCharacterCreationCareer',
        gameId: identity.gameId,
        actorId: identity.actorId,
        characterId: 'mae' as CharacterId
      })
      assertNoGenericLifecycleAdvance(plan?.actions ?? [])
    }
  })

  it('uses the semantic continuation command after mustering out', () => {
    const plan = deriveCharacterCreationActionPlan(
      identity,
      character(
        creation('MUSTERING_OUT', {
          terms: [
            term({
              benefits: ['Low Passage'],
              complete: true,
              musteringOut: true
            }),
            term({
              benefits: ['Low Passage'],
              complete: true,
              musteringOut: true
            })
          ],
          careers: [{ name: 'Scout', rank: 0 }]
        })
      )
    )

    assert.deepEqual(
      [...(plan?.actions ?? [])]
        .map((availableAction) => availableAction.key)
        .sort(),
      ['continue-career', 'finish-mustering']
    )
    assert.deepEqual(
      plan?.actions.find((availableAction) => {
        return availableAction.key === 'continue-career'
      })?.command,
      {
        type: 'ContinueCharacterCreationAfterMustering',
        gameId: identity.gameId,
        actorId: identity.actorId,
        characterId: 'mae' as CharacterId
      }
    )
    assert.deepEqual(
      plan?.actions.find((availableAction) => {
        return availableAction.key === 'finish-mustering'
      })?.command,
      {
        type: 'CompleteCharacterCreationMustering',
        gameId: identity.gameId,
        actorId: identity.actorId,
        characterId: 'mae' as CharacterId
      }
    )
    assertNoGenericLifecycleAdvance(plan?.actions ?? [])
  })
})
