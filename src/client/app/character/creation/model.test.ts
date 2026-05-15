import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asCharacterId } from '../../../../shared/ids'
import type {
  CharacterCreationProjection,
  CharacterState
} from '../../../../shared/state'
import {
  applyCharacterCreationCareerPlan,
  createInitialCharacterDraft,
  selectCharacterCreationCareerPlan,
  type CharacterCreationCompletedTerm,
  type CharacterCreationFlow
} from './flow'
import {
  deriveCharacterCreationViewModel,
  type CharacterCreationViewModel
} from './model'

const characterId = asCharacterId('view-model-traveller')

const flow = (
  overrides: Partial<CharacterCreationFlow> = {}
): CharacterCreationFlow => ({
  step: 'homeworld',
  draft: createInitialCharacterDraft(characterId, {
    name: 'Iona Vesh',
    characteristics: {
      str: 7,
      dex: 8,
      end: 7,
      int: 9,
      edu: 8,
      soc: 6
    },
    homeworld: {
      lawLevel: 'No Law',
      tradeCodes: ['Asteroid']
    },
    backgroundSkills: ['Admin-0'],
    pendingCascadeSkills: ['Gun Combat-0']
  }),
  ...overrides
})

const projection = (
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
  history: [],
  ...overrides
})

const completedTerm = (): CharacterCreationCompletedTerm => ({
  career: 'Merchant',
  drafted: false,
  age: 22,
  qualificationRoll: 8,
  survivalRoll: 8,
  survivalPassed: true,
  canCommission: false,
  commissionRoll: null,
  commissionPassed: null,
  canAdvance: false,
  advancementRoll: null,
  advancementPassed: null,
  termSkillRolls: [{ table: 'serviceSkills', roll: 1, skill: 'Comms' }],
  anagathics: false,
  agingRoll: null,
  agingSelections: [],
  reenlistmentRoll: 7,
  reenlistmentOutcome: 'allowed'
})

const character = (
  creation: CharacterCreationProjection,
  overrides: Partial<CharacterState> = {}
): CharacterState => ({
  id: characterId,
  ownerId: null,
  type: 'PLAYER',
  name: 'Iona Vesh',
  active: true,
  notes: '',
  age: 18,
  characteristics: {
    str: null,
    dex: null,
    end: null,
    int: null,
    edu: null,
    soc: null
  },
  skills: [],
  equipment: [],
  credits: 0,
  creation,
  ...overrides
})

const resolvedCareerFlow = ({
  completedTerms = [],
  termSkillRolls = [
    { table: 'serviceSkills' as const, roll: 1, skill: 'Comms' }
  ]
}: {
  completedTerms?: CharacterCreationCompletedTerm[]
  termSkillRolls?: NonNullable<
    CharacterCreationFlow['draft']['careerPlan']
  >['termSkillRolls']
} = {}): CharacterCreationFlow => ({
  step: 'career',
  draft: applyCharacterCreationCareerPlan(
    createInitialCharacterDraft(characterId, {
      name: 'Iona Vesh',
      age: 22,
      characteristics: {
        str: 7,
        dex: 8,
        end: 7,
        int: 9,
        edu: 8,
        soc: 6
      },
      completedTerms,
      careerPlan: selectCharacterCreationCareerPlan('Merchant')
    }),
    {
      ...selectCharacterCreationCareerPlan('Merchant'),
      qualificationRoll: 8,
      qualificationPassed: true,
      survivalRoll: 8,
      survivalPassed: true,
      commissionRoll: -1,
      commissionPassed: false,
      advancementRoll: null,
      advancementPassed: null,
      canCommission: true,
      canAdvance: false,
      drafted: false,
      anagathics: false,
      termSkillRolls
    }
  )
})

describe('character creation view model', () => {
  it('derives an empty model without requiring DOM or flow state', () => {
    const viewModel = deriveCharacterCreationViewModel({
      flow: null,
      projection: null,
      readOnly: false
    })

    assert.equal(viewModel.mode, 'empty')
    assert.equal(viewModel.title, 'Create traveller')
    assert.equal(viewModel.characterId, null)
    assert.equal(viewModel.flow, null)
    assert.equal(viewModel.wizard, null)
    assert.equal(viewModel.projection.present, false)
    assert.equal(viewModel.projection.statusLabel, 'Creation')
    assert.equal(viewModel.projection.isActive, false)
    assert.equal(viewModel.projection.termCount, 0)
    assert.equal(viewModel.projection.timelineCount, 0)
    assert.equal(viewModel.pending.hasPendingResolution, false)
    assert.equal(
      viewModel.pending.summary,
      'No pending character creation choices'
    )
  })

  it('composes flow and projection details for editable rendering', () => {
    const currentFlow = flow()
    const currentProjection = projection('HOMEWORLD', {
      pendingCascadeSkills: ['Gun Combat-0'],
      history: [{ type: 'COMPLETE_HOMEWORLD' }]
    })

    const viewModel = deriveCharacterCreationViewModel({
      flow: currentFlow,
      projection: currentProjection,
      readOnly: false
    })

    assert.equal(viewModel.mode, 'editable')
    assert.equal(viewModel.title, 'Iona Vesh')
    assert.equal(viewModel.characterId, characterId)
    assert.equal(viewModel.readOnly, false)
    assert.equal(viewModel.controlsDisabled, false)
    assert.equal(viewModel.projection.present, true)
    assert.equal(viewModel.projection.status, 'HOMEWORLD')
    assert.equal(viewModel.projection.statusLabel, 'Homeworld')
    assert.equal(viewModel.projection.step, 'homeworld')
    assert.equal(viewModel.projection.isActive, true)
    assert.equal(viewModel.projection.isPlayable, false)
    assert.equal(viewModel.projection.isDeceased, false)
    assert.equal(viewModel.projection.termCount, 0)
    assert.equal(viewModel.projection.historyCount, 1)
    assert.equal(viewModel.projection.timelineCount, 0)
    assert.equal(viewModel.wizard?.step, 'homeworld')
    assert.equal(viewModel.wizard?.projectedStepCurrent, true)
    assert.equal(viewModel.wizard?.controlsDisabled, false)
    assert.equal(viewModel.wizard?.nextStep.phase, 'Homeworld')
    assert.equal(viewModel.wizard?.characteristics, null)
    assert.equal(viewModel.wizard?.homeworld?.summary.lawLevel, 'No Law')
    assert.deepEqual(viewModel.wizard?.homeworld?.summary.tradeCodes, [
      'Asteroid'
    ])
    assert.equal(viewModel.wizard?.progress.length, 7)
    assert.deepEqual(viewModel.pending.backgroundCascadeSkills, [
      'Gun Combat-0'
    ])
    assert.deepEqual(viewModel.pending.projectionCascadeSkills, [
      'Gun Combat-0'
    ])
    assert.equal(viewModel.pending.hasCascadeChoices, true)
    assert.equal(
      viewModel.pending.summary,
      '1 background cascade choice pending'
    )
  })

  it('includes characteristic grid state for the characteristics step', () => {
    const viewModel = deriveCharacterCreationViewModel({
      flow: flow({
        step: 'characteristics',
        draft: createInitialCharacterDraft(characterId, {
          characteristics: {
            str: 7,
            dex: null,
            end: 8,
            int: null,
            edu: null,
            soc: null
          }
        })
      }),
      projection: projection('CHARACTERISTICS'),
      readOnly: false
    })

    assert.deepEqual(
      viewModel.wizard?.characteristics?.stats.map(
        ({ key, value, missing, rollLabel }) => ({
          key,
          value,
          missing,
          rollLabel
        })
      ),
      [
        { key: 'str', value: '7', missing: false, rollLabel: 'Roll Str' },
        { key: 'dex', value: '', missing: true, rollLabel: 'Roll Dex' },
        { key: 'end', value: '8', missing: false, rollLabel: 'Roll End' },
        { key: 'int', value: '', missing: true, rollLabel: 'Roll Int' },
        { key: 'edu', value: '', missing: true, rollLabel: 'Roll Edu' },
        { key: 'soc', value: '', missing: true, rollLabel: 'Roll Soc' }
      ]
    )
    assert.equal(viewModel.wizard?.homeworld, null)
  })

  it('uses projected character characteristics when the read model is available', () => {
    const currentProjection = projection('CHARACTERISTICS')
    const viewModel = deriveCharacterCreationViewModel({
      flow: flow({
        step: 'characteristics',
        draft: createInitialCharacterDraft(characterId, {
          characteristics: {
            str: null,
            dex: null,
            end: null,
            int: null,
            edu: null,
            soc: null
          }
        })
      }),
      projection: currentProjection,
      character: character(currentProjection, {
        characteristics: {
          str: 9,
          dex: null,
          end: null,
          int: null,
          edu: null,
          soc: null
        }
      }),
      readOnly: false
    })

    assert.equal(viewModel.characterReadModel?.rolledCharacteristicCount, 1)
    assert.deepEqual(
      viewModel.wizard?.characteristics?.stats.map(
        ({ key, value, missing, modifier }) => ({
          key,
          value,
          missing,
          modifier
        })
      ),
      [
        { key: 'str', value: '9', missing: false, modifier: '+1' },
        { key: 'dex', value: '', missing: true, modifier: '' },
        { key: 'end', value: '', missing: true, modifier: '' },
        { key: 'int', value: '', missing: true, modifier: '' },
        { key: 'edu', value: '', missing: true, modifier: '' },
        { key: 'soc', value: '', missing: true, modifier: '' }
      ]
    )
  })

  it('captures read-only and pending aging state without changing flow identity', () => {
    const currentFlow = flow({
      step: 'career',
      draft: {
        ...flow().draft,
        pendingCascadeSkills: [],
        pendingTermCascadeSkills: ['Aircraft-1'],
        pendingAgingChanges: [{ type: 'PHYSICAL', modifier: -1 }]
      }
    })
    const actionPlan: NonNullable<CharacterCreationViewModel['actionPlan']> = {
      title: 'Creation',
      status: 'Aging',
      summary: 'Advance the server-backed character creation state.',
      actions: []
    }

    const viewModel = deriveCharacterCreationViewModel({
      flow: currentFlow,
      projection: projection('AGING', {
        characteristicChanges: [{ type: 'PHYSICAL', modifier: -1 }]
      }),
      readOnly: true,
      actionPlan
    })

    assert.equal(viewModel.flow, currentFlow)
    assert.equal(viewModel.mode, 'read-only')
    assert.equal(viewModel.controlsDisabled, true)
    assert.equal(viewModel.wizard?.controlsDisabled, true)
    assert.equal(viewModel.wizard?.projectedStep, 'career')
    assert.equal(
      viewModel.wizard?.termCascadeChoices?.title,
      'Choose a specialty'
    )
    assert.equal(
      viewModel.wizard?.termCascadeChoices?.choices[0]?.cascadeSkill,
      'Aircraft-1'
    )
    assert.equal(viewModel.pending.hasPendingResolution, true)
    assert.deepEqual(viewModel.pending.termCascadeSkills, ['Aircraft-1'])
    assert.equal(viewModel.pending.agingChangeCount, 1)
    assert.equal(viewModel.actionPlan, actionPlan)
  })

  it('uses projected cascade choice options for read-only term choices', () => {
    const currentFlow = flow({
      step: 'career',
      draft: {
        ...flow().draft,
        pendingCascadeSkills: [],
        pendingTermCascadeSkills: ['Vehicle-1']
      }
    })

    const viewModel = deriveCharacterCreationViewModel({
      flow: currentFlow,
      projection: projection('SKILLS_TRAINING', {
        pendingCascadeSkills: ['Vehicle-1'],
        actionPlan: {
          status: 'SKILLS_TRAINING',
          pendingDecisions: [{ key: 'cascadeSkillResolution' }],
          legalActions: [],
          cascadeSkillChoices: [
            {
              cascadeSkill: 'Vehicle-1',
              label: 'Vehicle',
              level: 1,
              options: [
                {
                  value: 'Grav Vehicle-1',
                  label: 'Grav Vehicle',
                  cascade: false
                }
              ]
            }
          ]
        }
      }),
      readOnly: true
    })

    assert.deepEqual(viewModel.wizard?.termCascadeChoices?.choices, [
      {
        cascadeSkill: 'Vehicle-1',
        label: 'Vehicle',
        level: 1,
        options: [
          { value: 'Grav Vehicle-1', label: 'Grav Vehicle', cascade: false }
        ]
      }
    ])
  })

  it('includes career selection and roll state for the career step', () => {
    const currentFlow = flow({
      step: 'career',
      draft: {
        ...flow().draft,
        careerPlan: {
          career: 'Merchant',
          qualificationRoll: 8,
          qualificationPassed: true,
          survivalRoll: null,
          survivalPassed: null,
          commissionRoll: null,
          commissionPassed: null,
          advancementRoll: null,
          advancementPassed: null,
          canCommission: true,
          canAdvance: true,
          drafted: false
        }
      }
    })

    const viewModel = deriveCharacterCreationViewModel({
      flow: currentFlow,
      projection: projection('CAREER_SELECTION'),
      readOnly: false
    })

    assert.equal(
      viewModel.wizard?.careerSelection?.outcomeTitle,
      'Merchant term'
    )
    assert.equal(viewModel.wizard?.careerSelection?.showCareerList, false)
    assert.equal(viewModel.wizard?.careerRoll?.key, 'survivalRoll')
    assert.equal(viewModel.wizard?.careerRoll?.label, 'Roll survival')
    assert.equal(viewModel.wizard?.homeworld, null)
  })

  it('includes term skill training state for resolved career terms', () => {
    const viewModel = deriveCharacterCreationViewModel({
      flow: resolvedCareerFlow({ termSkillRolls: [] }),
      projection: projection('SKILLS_TRAINING'),
      readOnly: false
    })

    assert.equal(viewModel.wizard?.termSkills?.title, 'Skills and training')
    assert.equal(viewModel.wizard?.termSkills?.required, 1)
    assert.equal(viewModel.wizard?.termSkills?.remaining, 1)
    assert.deepEqual(
      viewModel.wizard?.termSkills?.actions.map((action) => action.table),
      [
        'personalDevelopment',
        'serviceSkills',
        'specialistSkills',
        'advancedEducation'
      ]
    )
  })

  it('includes basic training state for the skills step', () => {
    const currentFlow = {
      step: 'skills' as const,
      draft: createInitialCharacterDraft(characterId, {
        name: 'Iona Vesh',
        characteristics: {
          str: 7,
          dex: 8,
          end: 7,
          int: 9,
          edu: 8,
          soc: 6
        },
        careerPlan: {
          ...selectCharacterCreationCareerPlan('Scout'),
          qualificationRoll: 8,
          qualificationPassed: true,
          survivalRoll: 9,
          survivalPassed: true,
          commissionRoll: null,
          commissionPassed: null,
          advancementRoll: null,
          advancementPassed: null,
          canCommission: false,
          canAdvance: false,
          drafted: false
        }
      })
    }

    const viewModel = deriveCharacterCreationViewModel({
      flow: currentFlow,
      projection: projection('SKILLS_TRAINING'),
      readOnly: false
    })

    assert.equal(viewModel.wizard?.basicTraining?.label, 'Apply basic training')
    assert.deepEqual(viewModel.wizard?.basicTraining?.skills, [
      'Comms-0',
      'Electronics-0',
      'Gun Combat-0',
      'Gunnery-0',
      'Recon-0',
      'Piloting-0'
    ])
  })

  it('includes aging and reenlistment prompt state for career terms', () => {
    const reenlistment = deriveCharacterCreationViewModel({
      flow: resolvedCareerFlow(),
      projection: projection('REENLISTMENT'),
      readOnly: false
    })

    assert.equal(
      reenlistment.wizard?.reenlistmentRoll?.label,
      'Roll reenlistment'
    )
    assert.equal(
      reenlistment.wizard?.termResolution?.message,
      'Roll reenlistment before deciding what happens next.'
    )
    assert.equal(reenlistment.wizard?.agingRoll, null)

    const aging = deriveCharacterCreationViewModel({
      flow: resolvedCareerFlow({
        completedTerms: [completedTerm(), completedTerm(), completedTerm()]
      }),
      projection: projection('AGING'),
      readOnly: false
    })

    assert.equal(aging.wizard?.agingRoll?.label, 'Roll aging')
    assert.equal(aging.wizard?.agingRoll?.reason, 'Iona Vesh aging')
    assert.equal(aging.wizard?.reenlistmentRoll, null)
  })

  it('includes anagathics decision state for eligible career terms', () => {
    const base = resolvedCareerFlow()
    const viewModel = deriveCharacterCreationViewModel({
      flow: {
        ...base,
        draft: {
          ...base.draft,
          careerPlan: base.draft.careerPlan
            ? {
                ...base.draft.careerPlan,
                anagathics: null
              }
            : null
        }
      },
      projection: projection('AGING'),
      readOnly: false
    })

    assert.equal(viewModel.wizard?.anagathicsDecision?.title, 'Anagathics')
    assert.equal(
      viewModel.wizard?.anagathicsDecision?.useLabel,
      'Use anagathics'
    )
    assert.equal(viewModel.wizard?.agingRoll, null)
    assert.equal(viewModel.wizard?.reenlistmentRoll, null)
  })

  it('includes pending aging choice state', () => {
    const viewModel = deriveCharacterCreationViewModel({
      flow: flow({
        step: 'career',
        draft: {
          ...flow().draft,
          pendingAgingChanges: [{ type: 'PHYSICAL', modifier: -1 }]
        }
      }),
      projection: projection('AGING'),
      readOnly: false
    })

    assert.equal(viewModel.wizard?.agingChoices?.title, 'Aging effects')
    assert.deepEqual(viewModel.wizard?.agingChoices?.choices[0], {
      index: 0,
      label: 'physical -1',
      options: [
        { characteristic: 'str', label: 'STR' },
        { characteristic: 'dex', label: 'DEX' },
        { characteristic: 'end', label: 'END' }
      ]
    })
  })

  it('includes mustering out state for the equipment step', () => {
    const viewModel = deriveCharacterCreationViewModel({
      flow: flow({
        step: 'equipment',
        draft: createInitialCharacterDraft(characterId, {
          completedTerms: [completedTerm(), completedTerm()],
          musteringBenefits: [
            {
              career: 'Merchant',
              kind: 'cash',
              roll: 2,
              value: '10000',
              credits: 10000
            }
          ]
        })
      }),
      projection: projection('MUSTERING_OUT'),
      readOnly: false
    })

    assert.equal(viewModel.wizard?.musteringOut?.title, 'Mustering out')
    assert.equal(
      viewModel.wizard?.musteringOut?.summary,
      '1 benefit roll remaining.'
    )
    assert.deepEqual(viewModel.wizard?.musteringOut?.benefits, [
      {
        label: 'Merchant Cash',
        valueLabel: 'Cr10000',
        rollLabel: 'Table 2',
        metaLabel: 'Credits'
      }
    ])
    assert.deepEqual(
      viewModel.wizard?.musteringOut?.actions.map(
        ({ kind, label, disabled }) => ({ kind, label, disabled })
      ),
      [
        { kind: 'cash', label: 'Roll cash', disabled: false },
        { kind: 'material', label: 'Roll benefit', disabled: false }
      ]
    )
  })

  it('includes term history and review summaries', () => {
    const careerHistory = deriveCharacterCreationViewModel({
      flow: flow({
        step: 'career',
        draft: createInitialCharacterDraft(characterId, {
          completedTerms: [completedTerm()]
        })
      }),
      projection: projection('CAREER_SELECTION'),
      readOnly: false
    })

    assert.equal(careerHistory.wizard?.termHistory?.title, 'Terms served')
    assert.equal(
      careerHistory.wizard?.termHistory?.terms[0]?.startsWith(
        '1. Merchant: survived'
      ),
      true
    )

    const review = deriveCharacterCreationViewModel({
      flow: flow({
        step: 'review',
        draft: createInitialCharacterDraft(characterId, {
          name: 'Iona Vesh',
          completedTerms: [completedTerm()]
        })
      }),
      projection: projection('ACTIVE'),
      readOnly: false
    })

    assert.equal(review.wizard?.review?.title, 'Iona Vesh')
    assert.equal(review.wizard?.review?.sections[0]?.label, 'Basics')
  })
})
