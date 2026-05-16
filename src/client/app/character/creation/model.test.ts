import * as assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import { asCharacterId } from '../../../../shared/ids'
import {
  decodeCepheusRuleset,
  type CepheusRuleset
} from '../../../../shared/character-creation/cepheus-srd-ruleset'
import type { CareerTerm } from '../../../../shared/character-creation/types'
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
  deriveCharacterCreationProjectedActionSection,
  deriveCharacterCreationViewModel,
  type CharacterCreationViewModel
} from './model'

const characterId = asCharacterId('view-model-traveller')

const loadCustomRulesetFixture = (): CepheusRuleset => {
  const decoded = decodeCepheusRuleset(
    JSON.parse(
      readFileSync(
        'src/shared/character-creation/__fixtures__/custom-ruleset.json',
        'utf8'
      )
    )
  )

  if (!decoded.ok) {
    throw new Error(decoded.error.join('; '))
  }

  return decoded.value
}

const customRuleset = loadCustomRulesetFixture()

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

const projectedCompletedTerm = (
  overrides: Partial<CareerTerm> = {}
): CareerTerm => ({
  career: 'Scout',
  skills: ['Pilot-1'],
  skillsAndTraining: ['Pilot-1'],
  benefits: [],
  complete: true,
  canReenlist: true,
  completedBasicTraining: true,
  musteringOut: false,
  anagathics: false,
  survival: 9,
  reEnlistment: 7,
  ...overrides
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

const characteristicStats = (viewModel: CharacterCreationViewModel) =>
  viewModel.wizard?.characteristics?.stats.map(
    ({ key, value, missing, modifier }) => ({
      key,
      value,
      missing,
      modifier
    })
  )

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

const survivalRollFlow = (): CharacterCreationFlow => {
  const currentFlow = resolvedCareerFlow()
  const careerPlan = currentFlow.draft.careerPlan
  if (!careerPlan) throw new Error('expected career plan')

  return {
    ...currentFlow,
    draft: {
      ...currentFlow.draft,
      careerPlan: {
        ...careerPlan,
        survivalRoll: null,
        survivalPassed: null,
        commissionRoll: null,
        commissionPassed: null,
        advancementRoll: null,
        advancementPassed: null
      }
    }
  }
}

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

  it('derives local editable choices from the flow ruleset data', () => {
    const viewModel = deriveCharacterCreationViewModel({
      flow: flow({
        ruleset: customRuleset,
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
            lawLevel: 'Frontier Law',
            tradeCodes: ['Deep Space']
          },
          backgroundSkills: ['Vacc Suit-0'],
          pendingCascadeSkills: []
        })
      }),
      projection: projection('HOMEWORLD'),
      readOnly: false
    })

    assert.deepEqual(viewModel.wizard?.homeworld?.lawLevelOptions, [
      { value: 'Frontier Law', label: 'Frontier Law', selected: true }
    ])
    assert.deepEqual(viewModel.wizard?.homeworld?.tradeCodeOptions, [
      { value: 'Deep Space', label: 'Deep Space', selected: true }
    ])
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
    assert.deepEqual(characteristicStats(viewModel), [
      { key: 'str', value: '9', missing: false, modifier: '+1' },
      { key: 'dex', value: '', missing: true, modifier: '' },
      { key: 'end', value: '', missing: true, modifier: '' },
      { key: 'int', value: '', missing: true, modifier: '' },
      { key: 'edu', value: '', missing: true, modifier: '' },
      { key: 'soc', value: '', missing: true, modifier: '' }
    ])
  })

  it('keeps owner and spectator characteristic grids driven by read-model sheet state', () => {
    const currentFlow = flow({
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
    })
    const ownerProjection = projection('CHARACTERISTICS', {
      history: [{ type: 'SET_CHARACTERISTICS' }]
    })
    const spectatorProjection = projection('CHARACTERISTICS', { history: [] })
    const sheetCharacteristics: CharacterState['characteristics'] = {
      str: 9,
      dex: 8,
      end: null,
      int: null,
      edu: null,
      soc: null
    }
    const ownerViewModel = deriveCharacterCreationViewModel({
      flow: currentFlow,
      projection: ownerProjection,
      character: character(ownerProjection, {
        characteristics: sheetCharacteristics
      }),
      readOnly: false
    })
    const spectatorViewModel = deriveCharacterCreationViewModel({
      flow: currentFlow,
      projection: spectatorProjection,
      character: character(spectatorProjection, {
        characteristics: sheetCharacteristics
      }),
      readOnly: true
    })

    assert.deepEqual(
      characteristicStats(ownerViewModel),
      characteristicStats(spectatorViewModel)
    )
    assert.deepEqual(characteristicStats(spectatorViewModel), [
      { key: 'str', value: '9', missing: false, modifier: '+1' },
      { key: 'dex', value: '8', missing: false, modifier: '' },
      { key: 'end', value: '', missing: true, modifier: '' },
      { key: 'int', value: '', missing: true, modifier: '' },
      { key: 'edu', value: '', missing: true, modifier: '' },
      { key: 'soc', value: '', missing: true, modifier: '' }
    ])
    assert.equal(
      ownerViewModel.characterReadModel?.rolledCharacteristicCount,
      2
    )
    assert.equal(
      spectatorViewModel.characterReadModel?.rolledCharacteristicCount,
      2
    )
  })

  it('does not treat legacy characteristic history as sheet state', () => {
    const currentProjection = projection('CHARACTERISTICS', {
      history: [{ type: 'SET_CHARACTERISTICS' }]
    })
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
      character: character(currentProjection),
      readOnly: true
    })

    assert.equal(viewModel.projection.timelineCount, 0)
    assert.equal(viewModel.characterReadModel?.rolledCharacteristicCount, 0)
    assert.deepEqual(characteristicStats(viewModel), [
      { key: 'str', value: '', missing: true, modifier: '' },
      { key: 'dex', value: '', missing: true, modifier: '' },
      { key: 'end', value: '', missing: true, modifier: '' },
      { key: 'int', value: '', missing: true, modifier: '' },
      { key: 'edu', value: '', missing: true, modifier: '' },
      { key: 'soc', value: '', missing: true, modifier: '' }
    ])
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
    assert.equal(viewModel.wizard?.termCascadeChoices, null)
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

  it('fails closed when projected term cascade choices are missing', () => {
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
          cascadeSkillChoices: []
        }
      }),
      readOnly: false
    })

    assert.equal(viewModel.wizard?.termCascadeChoices, null)
  })

  it('uses projected homeworld options for read-only homeworld choices', () => {
    const currentFlow = flow({
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
          lawLevel: 'Low Law',
          tradeCodes: ['Desert']
        },
        backgroundSkills: ['Survival-0'],
        pendingCascadeSkills: []
      })
    })

    const viewModel = deriveCharacterCreationViewModel({
      flow: currentFlow,
      projection: projection('HOMEWORLD', {
        actionPlan: {
          status: 'HOMEWORLD',
          pendingDecisions: [{ key: 'homeworldSkillSelection' }],
          legalActions: [],
          homeworldChoiceOptions: {
            lawLevels: ['Low Law'],
            tradeCodes: ['Desert'],
            backgroundSkills: [
              {
                value: 'Survival-0',
                label: 'Survival',
                preselected: true,
                cascade: false
              }
            ]
          }
        }
      }),
      readOnly: true
    })

    assert.deepEqual(viewModel.wizard?.homeworld?.lawLevelOptions, [
      { value: 'Low Law', label: 'Low Law', selected: true }
    ])
    assert.deepEqual(viewModel.wizard?.homeworld?.tradeCodeOptions, [
      { value: 'Desert', label: 'Desert', selected: true }
    ])
    assert.deepEqual(
      viewModel.wizard?.homeworld?.backgroundSkills.skillOptions,
      [
        {
          value: 'Survival-0',
          label: 'Survival',
          selected: true,
          preselected: true,
          cascade: false
        }
      ]
    )
  })

  it('derives read-only homeworld from the shared read model without a legacy flow', () => {
    const currentProjection = projection('HOMEWORLD', {
      homeworld: {
        name: null,
        lawLevel: 'Low Law',
        tradeCodes: ['Desert']
      },
      backgroundSkills: ['Survival-0'],
      pendingCascadeSkills: [],
      actionPlan: {
        status: 'HOMEWORLD',
        pendingDecisions: [{ key: 'homeworldSkillSelection' }],
        legalActions: [],
        homeworldChoiceOptions: {
          lawLevels: ['Low Law'],
          tradeCodes: ['Desert'],
          backgroundSkills: [
            {
              value: 'Survival-0',
              label: 'Survival',
              preselected: true,
              cascade: false
            }
          ]
        }
      }
    })

    const viewModel = deriveCharacterCreationViewModel({
      flow: null,
      projection: currentProjection,
      character: character(currentProjection, {
        characteristics: {
          str: 7,
          dex: 8,
          end: 7,
          int: 9,
          edu: 8,
          soc: 6
        }
      }),
      readOnly: true
    })

    assert.equal(viewModel.mode, 'read-only')
    assert.equal(viewModel.flow, null)
    assert.equal(viewModel.wizard?.step, 'homeworld')
    assert.equal(viewModel.wizard?.homeworld?.summary.lawLevel, 'Low Law')
    assert.deepEqual(viewModel.wizard?.homeworld?.summary.tradeCodes, [
      'Desert'
    ])
    assert.deepEqual(viewModel.wizard?.homeworld?.lawLevelOptions, [
      { value: 'Low Law', label: 'Low Law', selected: true }
    ])
    assert.deepEqual(viewModel.wizard?.homeworld?.tradeCodeOptions, [
      { value: 'Desert', label: 'Desert', selected: true }
    ])
    assert.deepEqual(
      viewModel.wizard?.homeworld?.backgroundSkills.skillOptions,
      [
        {
          value: 'Survival-0',
          label: 'Survival',
          selected: true,
          preselected: true,
          cascade: false
        }
      ]
    )
  })

  it('derives editable homeworld from the shared read model without a legacy flow', () => {
    const currentProjection = projection('HOMEWORLD', {
      homeworld: {
        name: null,
        lawLevel: 'Medium Law',
        tradeCodes: ['Industrial']
      },
      backgroundSkills: ['Admin-0'],
      pendingCascadeSkills: [],
      actionPlan: {
        status: 'HOMEWORLD',
        pendingDecisions: [{ key: 'homeworldSkillSelection' }],
        legalActions: [],
        homeworldChoiceOptions: {
          lawLevels: ['Medium Law'],
          tradeCodes: ['Industrial'],
          backgroundSkills: [
            {
              value: 'Admin-0',
              label: 'Admin',
              preselected: false,
              cascade: false
            }
          ]
        }
      }
    })

    const viewModel = deriveCharacterCreationViewModel({
      flow: null,
      projection: currentProjection,
      character: character(currentProjection, {
        characteristics: {
          str: 7,
          dex: 8,
          end: 7,
          int: 9,
          edu: 8,
          soc: 6
        }
      }),
      readOnly: false
    })

    assert.equal(viewModel.mode, 'editable')
    assert.equal(viewModel.flow, null)
    assert.equal(viewModel.wizard?.step, 'homeworld')
    assert.equal(viewModel.wizard?.controlsDisabled, false)
    assert.equal(viewModel.wizard?.homeworld?.summary.lawLevel, 'Medium Law')
    assert.deepEqual(viewModel.wizard?.homeworld?.summary.tradeCodes, [
      'Industrial'
    ])
    assert.deepEqual(viewModel.wizard?.homeworld?.lawLevelOptions, [
      { value: 'Medium Law', label: 'Medium Law', selected: true }
    ])
    assert.deepEqual(viewModel.wizard?.homeworld?.tradeCodeOptions, [
      { value: 'Industrial', label: 'Industrial', selected: true }
    ])
    assert.deepEqual(
      viewModel.wizard?.homeworld?.backgroundSkills.skillOptions,
      [
        {
          value: 'Admin-0',
          label: 'Admin',
          selected: true,
          preselected: false,
          cascade: false
        }
      ]
    )
  })

  it('preserves local editable homeworld choices until they are published', () => {
    const currentProjection = projection('HOMEWORLD', {
      homeworld: {
        name: null,
        lawLevel: null,
        tradeCodes: []
      },
      backgroundSkills: [],
      pendingCascadeSkills: [],
      actionPlan: {
        status: 'HOMEWORLD',
        pendingDecisions: [{ key: 'homeworldSkillSelection' }],
        legalActions: [],
        homeworldChoiceOptions: {
          lawLevels: ['No Law', 'Low Law'],
          tradeCodes: ['Asteroid'],
          backgroundSkills: []
        }
      }
    })

    const localFlow = flow({
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
        }
      })
    })

    const viewModel = deriveCharacterCreationViewModel({
      flow: localFlow,
      projection: currentProjection,
      character: character(currentProjection, {
        characteristics: {
          str: 7,
          dex: 8,
          end: 7,
          int: 9,
          edu: 8,
          soc: 6
        }
      }),
      readOnly: false
    })

    assert.equal(viewModel.wizard?.step, 'homeworld')
    assert.equal(viewModel.wizard?.homeworld?.summary.lawLevel, 'No Law')
    assert.deepEqual(viewModel.wizard?.homeworld?.summary.tradeCodes, [
      'Asteroid'
    ])
    assert.deepEqual(viewModel.wizard?.homeworld?.lawLevelOptions, [
      { value: 'No Law', label: 'No Law', selected: true },
      { value: 'Low Law', label: 'Low Law', selected: false }
    ])
  })

  it('derives read-only career selection from the shared read model without a legacy flow', () => {
    const currentProjection = projection('CAREER_SELECTION', {
      backgroundSkills: ['Survival-0'],
      actionPlan: {
        status: 'CAREER_SELECTION',
        pendingDecisions: [],
        legalActions: [],
        careerChoiceOptions: {
          careers: [
            {
              key: 'Projected Scout',
              label: 'Projected Scout',
              selected: true,
              qualification: {
                label: 'Qualification',
                requirement: 'Int 6+',
                available: true,
                characteristic: 'int',
                target: 6,
                modifier: 1
              },
              survival: {
                label: 'Survival',
                requirement: 'End 7+',
                available: true,
                characteristic: 'end',
                target: 7,
                modifier: 0
              },
              commission: {
                label: 'Commission',
                requirement: '-',
                available: false,
                characteristic: null,
                target: null,
                modifier: 0
              },
              advancement: {
                label: 'Advancement',
                requirement: '-',
                available: false,
                characteristic: null,
                target: null,
                modifier: 0
              }
            }
          ]
        }
      }
    })

    const viewModel = deriveCharacterCreationViewModel({
      flow: null,
      projection: currentProjection,
      character: character(currentProjection, {
        age: 18,
        characteristics: {
          str: 7,
          dex: 8,
          end: 7,
          int: 9,
          edu: 8,
          soc: 6
        },
        skills: ['Survival-0']
      }),
      readOnly: true
    })

    assert.equal(viewModel.mode, 'read-only')
    assert.equal(viewModel.flow, null)
    assert.equal(viewModel.wizard?.step, 'career')
    assert.equal(viewModel.wizard?.controlsDisabled, true)
    assert.equal(viewModel.wizard?.careerSelection?.open, true)
    assert.deepEqual(viewModel.wizard?.careerSelection?.careerOptions, [
      {
        key: 'Projected Scout',
        label: 'Projected Scout',
        selected: true,
        qualification: {
          label: 'Qualification',
          requirement: 'Int 6+',
          available: true,
          characteristic: 'int',
          target: 6,
          modifier: 1
        },
        survival: {
          label: 'Survival',
          requirement: 'End 7+',
          available: true,
          characteristic: 'end',
          target: 7,
          modifier: 0
        },
        commission: {
          label: 'Commission',
          requirement: '-',
          available: false,
          characteristic: null,
          target: null,
          modifier: 0
        },
        advancement: {
          label: 'Advancement',
          requirement: '-',
          available: false,
          characteristic: null,
          target: null,
          modifier: 0
        }
      }
    ])
  })

  it('derives read-only failed qualification fallback from projected facts without a legacy flow', () => {
    const currentProjection = projection('CAREER_SELECTION', {
      failedToQualify: true,
      failedQualification: {
        career: 'Scout',
        passed: false,
        qualification: {
          expression: '2d6',
          rolls: [1, 3],
          total: 4,
          characteristic: 'int',
          target: 6,
          modifier: -2,
          success: false
        },
        previousCareerCount: 0,
        failedQualificationOptions: ['Drifter']
      },
      actionPlan: {
        status: 'CAREER_SELECTION',
        pendingDecisions: [],
        legalActions: [
          {
            key: 'selectCareer',
            status: 'CAREER_SELECTION',
            commandTypes: [
              'ResolveCharacterCreationQualification',
              'ResolveCharacterCreationDraft',
              'EnterCharacterCreationDrifter'
            ],
            failedQualificationOptions: [{ option: 'Drifter' }]
          }
        ]
      }
    })

    const viewModel = deriveCharacterCreationViewModel({
      flow: null,
      projection: currentProjection,
      character: character(currentProjection, {
        age: 18,
        characteristics: {
          str: 7,
          dex: 8,
          end: 7,
          int: 9,
          edu: 8,
          soc: 6
        }
      }),
      readOnly: true
    })

    assert.equal(viewModel.flow, null)
    assert.equal(viewModel.wizard?.step, 'career')
    assert.equal(viewModel.wizard?.careerSelection?.outcomeTitle, 'Scout term')
    assert.deepEqual(
      viewModel.wizard?.careerSelection?.failedQualification.options,
      [
        {
          option: 'Drifter',
          label: 'Drifter',
          actionLabel: 'Become a Drifter',
          rollRequirement: null
        }
      ]
    )
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
      projection: projection('SURVIVAL', {
        actionPlan: {
          status: 'SURVIVAL',
          pendingDecisions: [{ key: 'survivalResolution' }],
          legalActions: [
            {
              key: 'rollSurvival',
              status: 'SURVIVAL',
              commandTypes: ['ResolveCharacterCreationSurvival'],
              rollRequirement: { key: 'survival', dice: '2d6' }
            }
          ]
        }
      }),
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

  it('renders mishap resolution instead of death when projection allows mishaps', () => {
    const currentFlow = resolvedCareerFlow()
    const careerPlan = currentFlow.draft.careerPlan
    assert.equal(careerPlan === null, false)
    if (!careerPlan) return
    currentFlow.draft.careerPlan = {
      ...careerPlan,
      survivalRoll: 2,
      survivalPassed: false
    }

    const viewModel = deriveCharacterCreationViewModel({
      flow: currentFlow,
      projection: projection('MISHAP', {
        actionPlan: {
          status: 'MISHAP',
          pendingDecisions: [{ key: 'mishapResolution' }],
          legalActions: [
            {
              key: 'resolveMishap',
              status: 'MISHAP',
              commandTypes: ['ResolveCharacterCreationMishap'],
              rollRequirement: { key: 'mishap', dice: '1d6' }
            }
          ]
        }
      }),
      readOnly: false
    })

    assert.equal(viewModel.wizard?.death, null)
    assert.equal(viewModel.wizard?.mishapResolution?.title, 'Merchant mishap')
    assert.equal(
      viewModel.wizard?.mishapResolution?.buttonLabel,
      'Resolve mishap'
    )
  })

  it('renders mishap resolution when anagathics failure enters mishap after a survived term', () => {
    const currentFlow = resolvedCareerFlow()
    const careerPlan = currentFlow.draft.careerPlan
    assert.equal(careerPlan === null, false)
    if (!careerPlan) return
    currentFlow.draft.careerPlan = {
      ...careerPlan,
      survivalRoll: 9,
      survivalPassed: true,
      anagathics: true
    }

    const viewModel = deriveCharacterCreationViewModel({
      flow: currentFlow,
      projection: projection('MISHAP', {
        actionPlan: {
          status: 'MISHAP',
          pendingDecisions: [{ key: 'mishapResolution' }],
          legalActions: [
            {
              key: 'resolveMishap',
              status: 'MISHAP',
              commandTypes: ['ResolveCharacterCreationMishap'],
              rollRequirement: { key: 'mishap', dice: '1d6' }
            }
          ]
        }
      }),
      readOnly: false
    })

    assert.equal(viewModel.wizard?.death, null)
    assert.equal(viewModel.wizard?.mishapResolution?.title, 'Merchant mishap')
    assert.equal(
      /mishap must be resolved/i.test(
        viewModel.wizard?.mishapResolution?.message ?? ''
      ),
      true
    )
  })

  it('renders injury resolution choices from projected mishap facts', () => {
    const currentFlow = resolvedCareerFlow()
    const careerPlan = currentFlow.draft.careerPlan
    assert.equal(careerPlan === null, false)
    if (!careerPlan) return
    currentFlow.draft.careerPlan = {
      ...careerPlan,
      survivalRoll: 2,
      survivalPassed: false
    }

    const viewModel = deriveCharacterCreationViewModel({
      flow: currentFlow,
      projection: projection('MISHAP', {
        terms: [
          {
            career: 'Merchant',
            skills: [],
            skillsAndTraining: [],
            benefits: [],
            complete: false,
            canReenlist: false,
            completedBasicTraining: true,
            musteringOut: false,
            anagathics: false,
            facts: {
              mishap: {
                roll: { expression: '1d6', rolls: [1], total: 1 },
                outcome: {
                  career: 'Merchant',
                  roll: 1,
                  id: 'injured_in_action',
                  description:
                    'Injured in action. Treat as injury table result 2, or roll twice and take the lower result.',
                  discharge: 'honorable',
                  benefitEffect: 'forfeit_current_term',
                  debtCredits: 0,
                  extraServiceYears: 0,
                  injury: {
                    type: 'fixed',
                    injuryRoll: 2,
                    alternative: 'roll_twice_take_lower'
                  }
                }
              }
            }
          }
        ],
        actionPlan: {
          status: 'MISHAP',
          pendingDecisions: [{ key: 'injuryResolution' }],
          legalActions: [
            {
              key: 'resolveInjury',
              status: 'MISHAP',
              commandTypes: ['ResolveCharacterCreationInjury'],
              rollRequirement: { key: 'injury', dice: '1d6' },
              injuryResolutionOptions: [
                {
                  method: 'fixed_result',
                  label: 'Use injury table result 2',
                  rollRequirement: { key: 'injury', dice: '1d6' }
                },
                {
                  method: 'roll_twice_take_lower',
                  label: 'Roll twice and take lower',
                  rollRequirement: { key: 'injury', dice: '2d6' }
                }
              ]
            }
          ]
        }
      }),
      readOnly: false
    })

    assert.equal(viewModel.wizard?.mishapResolution, null)
    assert.equal(viewModel.wizard?.injuryResolution?.title, 'Merchant injury')
    assert.equal(
      viewModel.wizard?.injuryResolution?.message,
      'Injured in action. Treat as injury table result 2, or roll twice and take the lower result. Resolve this injury before mustering out.'
    )
    assert.equal(
      viewModel.wizard?.injuryResolution?.choiceHint,
      'Severely injured: choose the physical characteristic that loses 1D6.'
    )
    assert.deepEqual(
      viewModel.wizard?.injuryResolution?.targets.map((target) => [
        target.characteristic,
        target.value
      ]),
      [
        ['str', '7'],
        ['dex', '8'],
        ['end', '7']
      ]
    )
    assert.deepEqual(
      viewModel.wizard?.injuryResolution?.methods.map(
        (method) => method.method
      ),
      ['fixed_result', 'roll_twice_take_lower']
    )
  })

  it('renders death confirmation only when projection allows death', () => {
    const currentFlow = resolvedCareerFlow()
    const careerPlan = currentFlow.draft.careerPlan
    assert.equal(careerPlan === null, false)
    if (!careerPlan) return
    currentFlow.draft.careerPlan = {
      ...careerPlan,
      survivalRoll: 2,
      survivalPassed: false
    }

    const viewModel = deriveCharacterCreationViewModel({
      flow: currentFlow,
      projection: projection('MISHAP', {
        actionPlan: {
          status: 'MISHAP',
          pendingDecisions: [{ key: 'survivalResolution' }],
          legalActions: [
            {
              key: 'confirmDeath',
              status: 'MISHAP',
              commandTypes: ['ConfirmCharacterCreationDeath']
            }
          ]
        }
      }),
      readOnly: false
    })

    assert.equal(viewModel.wizard?.mishapResolution, null)
    assert.equal(viewModel.wizard?.death?.title, 'Killed in service')
  })

  it('keeps terminal death visible after confirmation removes legal actions', () => {
    const currentFlow = resolvedCareerFlow()
    const careerPlan = currentFlow.draft.careerPlan
    assert.equal(careerPlan === null, false)
    if (!careerPlan) return
    currentFlow.draft.careerPlan = {
      ...careerPlan,
      survivalRoll: 2,
      survivalPassed: false
    }

    const viewModel = deriveCharacterCreationViewModel({
      flow: currentFlow,
      projection: projection('DECEASED', {
        actionPlan: {
          status: 'DECEASED',
          pendingDecisions: [],
          legalActions: []
        }
      }),
      readOnly: false
    })

    assert.equal(viewModel.wizard?.death?.title, 'Killed in service')
  })

  it('uses projected career choice options for the career picker', () => {
    const viewModel = deriveCharacterCreationViewModel({
      flow: flow({ step: 'career' }),
      projection: projection('CAREER_SELECTION', {
        actionPlan: {
          status: 'CAREER_SELECTION',
          pendingDecisions: [],
          legalActions: [],
          careerChoiceOptions: {
            careers: [
              {
                key: 'Projected Scout',
                label: 'Projected Scout',
                selected: true,
                qualification: {
                  label: 'Qualification',
                  requirement: 'Int 6+',
                  available: true,
                  characteristic: 'int',
                  target: 6,
                  modifier: 1
                },
                survival: {
                  label: 'Survival',
                  requirement: 'End 7+',
                  available: true,
                  characteristic: 'end',
                  target: 7,
                  modifier: 0
                },
                commission: {
                  label: 'Commission',
                  requirement: '-',
                  available: false,
                  characteristic: null,
                  target: null,
                  modifier: 0
                },
                advancement: {
                  label: 'Advancement',
                  requirement: '-',
                  available: false,
                  characteristic: null,
                  target: null,
                  modifier: 0
                }
              }
            ]
          }
        }
      }),
      readOnly: false
    })

    assert.deepEqual(viewModel.wizard?.careerSelection?.careerOptions, [
      {
        key: 'Projected Scout',
        label: 'Projected Scout',
        selected: true,
        qualification: {
          label: 'Qualification',
          requirement: 'Int 6+',
          available: true,
          characteristic: 'int',
          target: 6,
          modifier: 1
        },
        survival: {
          label: 'Survival',
          requirement: 'End 7+',
          available: true,
          characteristic: 'end',
          target: 7,
          modifier: 0
        },
        commission: {
          label: 'Commission',
          requirement: '-',
          available: false,
          characteristic: null,
          target: null,
          modifier: 0
        },
        advancement: {
          label: 'Advancement',
          requirement: '-',
          available: false,
          characteristic: null,
          target: null,
          modifier: 0
        }
      }
    ])
  })

  it('uses projected failed qualification options for the fallback menu', () => {
    const viewModel = deriveCharacterCreationViewModel({
      flow: flow({
        step: 'career',
        draft: {
          ...flow().draft,
          careerPlan: {
            career: 'Merchant',
            qualificationRoll: 4,
            qualificationPassed: false,
            survivalRoll: null,
            survivalPassed: null,
            commissionRoll: null,
            commissionPassed: null,
            advancementRoll: null,
            advancementPassed: null,
            canCommission: false,
            canAdvance: false,
            drafted: false
          }
        }
      }),
      projection: projection('CAREER_SELECTION', {
        failedToQualify: true,
        canEnterDraft: false,
        actionPlan: {
          status: 'CAREER_SELECTION',
          pendingDecisions: [],
          legalActions: [
            {
              key: 'selectCareer',
              status: 'CAREER_SELECTION',
              commandTypes: [
                'ResolveCharacterCreationQualification',
                'ResolveCharacterCreationDraft',
                'EnterCharacterCreationDrifter'
              ],
              failedQualificationOptions: [{ option: 'Drifter' }]
            }
          ]
        }
      }),
      readOnly: false
    })

    assert.deepEqual(
      viewModel.wizard?.careerSelection?.failedQualification.options,
      [
        {
          option: 'Drifter',
          label: 'Drifter',
          actionLabel: 'Become a Drifter',
          rollRequirement: null
        }
      ]
    )
  })

  it('hides career roll prompts when projected legal actions do not allow them', () => {
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
      projection: projection('SURVIVAL', {
        actionPlan: {
          status: 'SURVIVAL',
          pendingDecisions: [],
          legalActions: []
        }
      }),
      readOnly: false
    })

    assert.equal(viewModel.wizard?.careerRoll, null)
  })

  it('hides stale failed qualification options when projection moved on', () => {
    const viewModel = deriveCharacterCreationViewModel({
      flow: flow({
        step: 'career',
        draft: {
          ...flow().draft,
          careerPlan: {
            career: 'Merchant',
            qualificationRoll: 4,
            qualificationPassed: false,
            survivalRoll: null,
            survivalPassed: null,
            commissionRoll: null,
            commissionPassed: null,
            advancementRoll: null,
            advancementPassed: null,
            canCommission: false,
            canAdvance: false,
            drafted: false
          }
        }
      }),
      projection: projection('SURVIVAL', {
        actionPlan: {
          status: 'SURVIVAL',
          pendingDecisions: [],
          legalActions: []
        }
      }),
      readOnly: false
    })

    assert.equal(
      viewModel.wizard?.careerSelection?.failedQualification.open,
      false
    )
    assert.deepEqual(
      viewModel.wizard?.careerSelection?.failedQualification.options,
      []
    )
  })

  it('includes term skill training state for resolved career terms', () => {
    const viewModel = deriveCharacterCreationViewModel({
      flow: resolvedCareerFlow({ termSkillRolls: [] }),
      projection: projection('SKILLS_TRAINING', {
        actionPlan: {
          status: 'SKILLS_TRAINING',
          pendingDecisions: [{ key: 'skillTrainingSelection' }],
          legalActions: [
            {
              key: 'rollTermSkill',
              status: 'SKILLS_TRAINING',
              commandTypes: ['RollCharacterCreationTermSkill'],
              rollRequirement: { key: 'termSkill', dice: '1d6' },
              termSkillTableOptions: [
                { table: 'personalDevelopment', label: 'Personal development' },
                { table: 'serviceSkills', label: 'Service skills' },
                { table: 'specialistSkills', label: 'Specialist skills' },
                { table: 'advancedEducation', label: 'Advanced education' }
              ]
            }
          ]
        }
      }),
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
      projection: null,
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

  it('uses projected basic training options for the skills step', () => {
    const currentFlow = flow({
      step: 'skills',
      draft: {
        ...flow().draft,
        careerPlan: selectCharacterCreationCareerPlan('Merchant')
      }
    })

    const viewModel = deriveCharacterCreationViewModel({
      flow: currentFlow,
      projection: projection('BASIC_TRAINING', {
        actionPlan: {
          status: 'BASIC_TRAINING',
          pendingDecisions: [],
          legalActions: [
            {
              key: 'completeBasicTraining',
              status: 'BASIC_TRAINING',
              commandTypes: ['CompleteCharacterCreationBasicTraining'],
              basicTrainingOptions: {
                kind: 'choose-one',
                skills: ['Projected Skill-0']
              }
            }
          ]
        }
      }),
      readOnly: false
    })

    assert.equal(
      viewModel.wizard?.basicTraining?.label,
      'Choose basic training'
    )
    assert.deepEqual(viewModel.wizard?.basicTraining?.skills, [
      'Projected Skill-0'
    ])
  })

  it('derives read-only basic training from the shared read model without a legacy flow', () => {
    const currentProjection = projection('BASIC_TRAINING', {
      terms: [
        {
          career: 'Merchant',
          skills: [],
          skillsAndTraining: [],
          benefits: [],
          complete: false,
          canReenlist: false,
          completedBasicTraining: false,
          musteringOut: false,
          anagathics: false,
          facts: {
            qualification: {
              career: 'Merchant',
              passed: true,
              previousCareerCount: 0,
              failedQualificationOptions: [],
              qualification: {
                expression: '2d6',
                rolls: [4, 4],
                total: 8,
                characteristic: 'int',
                target: 4,
                modifier: 1,
                success: true
              }
            }
          }
        }
      ],
      actionPlan: {
        status: 'BASIC_TRAINING',
        pendingDecisions: [],
        legalActions: [
          {
            key: 'completeBasicTraining',
            status: 'BASIC_TRAINING',
            commandTypes: ['CompleteCharacterCreationBasicTraining'],
            basicTrainingOptions: {
              kind: 'choose-one',
              skills: ['Projected Skill-0']
            }
          }
        ]
      }
    })

    const viewModel = deriveCharacterCreationViewModel({
      flow: null,
      projection: currentProjection,
      character: character(currentProjection, {
        age: 18,
        characteristics: {
          str: 7,
          dex: 8,
          end: 7,
          int: 9,
          edu: 8,
          soc: 6
        }
      }),
      readOnly: true
    })

    assert.equal(viewModel.flow, null)
    assert.equal(viewModel.wizard?.step, 'skills')
    assert.equal(
      viewModel.wizard?.basicTraining?.label,
      'Choose basic training'
    )
    assert.deepEqual(viewModel.wizard?.basicTraining?.skills, [
      'Projected Skill-0'
    ])
    assert.equal(viewModel.wizard?.controlsDisabled, true)
  })

  it('prefers the shared read model for editable projected basic training', () => {
    const currentProjection = projection('BASIC_TRAINING', {
      terms: [
        {
          career: 'Merchant',
          skills: [],
          skillsAndTraining: [],
          benefits: [],
          complete: false,
          canReenlist: false,
          completedBasicTraining: false,
          musteringOut: false,
          anagathics: false,
          facts: {
            qualification: {
              career: 'Merchant',
              passed: true,
              previousCareerCount: 0,
              failedQualificationOptions: [],
              qualification: {
                expression: '2d6',
                rolls: [4, 4],
                total: 8,
                characteristic: 'int',
                target: 4,
                modifier: 1,
                success: true
              }
            }
          }
        }
      ],
      actionPlan: {
        status: 'BASIC_TRAINING',
        pendingDecisions: [],
        legalActions: [
          {
            key: 'completeBasicTraining',
            status: 'BASIC_TRAINING',
            commandTypes: ['CompleteCharacterCreationBasicTraining'],
            basicTrainingOptions: {
              kind: 'choose-one',
              skills: ['Projected Skill-0']
            }
          }
        ]
      }
    })
    const staleFlow = flow({
      step: 'skills',
      draft: createInitialCharacterDraft(characterId, {
        name: 'Stale Draft',
        characteristics: {
          str: 3,
          dex: 3,
          end: 3,
          int: 3,
          edu: 3,
          soc: 3
        },
        careerPlan: selectCharacterCreationCareerPlan('Scout')
      })
    })

    const viewModel = deriveCharacterCreationViewModel({
      flow: staleFlow,
      projection: currentProjection,
      character: character(currentProjection, {
        age: 18,
        characteristics: {
          str: 7,
          dex: 8,
          end: 7,
          int: 9,
          edu: 8,
          soc: 6
        }
      }),
      readOnly: false
    })

    assert.equal(viewModel.flow, staleFlow)
    assert.equal(viewModel.mode, 'editable')
    assert.equal(viewModel.wizard?.step, 'skills')
    assert.equal(viewModel.wizard?.controlsDisabled, false)
    assert.equal(viewModel.wizard?.nextStep.stats[0]?.value, '7')
    assert.equal(
      viewModel.wizard?.basicTraining?.label,
      'Choose basic training'
    )
    assert.deepEqual(viewModel.wizard?.basicTraining?.skills, [
      'Projected Skill-0'
    ])
  })

  it('derives read-only term skill training from projected facts without a legacy flow', () => {
    const currentProjection = projection('SKILLS_TRAINING', {
      requiredTermSkillCount: 2,
      pendingCascadeSkills: [],
      terms: [
        {
          career: 'Merchant',
          skills: [],
          skillsAndTraining: [],
          benefits: [],
          complete: false,
          canReenlist: false,
          completedBasicTraining: true,
          musteringOut: false,
          anagathics: false,
          facts: {
            qualification: {
              career: 'Merchant',
              passed: true,
              previousCareerCount: 0,
              failedQualificationOptions: [],
              qualification: {
                expression: '2d6',
                rolls: [4, 4],
                total: 8,
                characteristic: 'int',
                target: 4,
                modifier: 1,
                success: true
              }
            },
            survival: {
              passed: true,
              canCommission: false,
              canAdvance: false,
              survival: {
                expression: '2d6',
                rolls: [5, 3],
                total: 8,
                characteristic: 'int',
                target: 5,
                modifier: 1,
                success: true
              }
            },
            basicTrainingSkills: ['Broker-0'],
            termSkillRolls: [
              {
                career: 'Merchant',
                table: 'serviceSkills',
                roll: { expression: '1d6', rolls: [1], total: 1 },
                tableRoll: 1,
                rawSkill: 'Admin',
                skill: 'Admin-1',
                characteristic: null,
                pendingCascadeSkill: null
              }
            ]
          }
        }
      ],
      actionPlan: {
        status: 'SKILLS_TRAINING',
        pendingDecisions: [{ key: 'skillTrainingSelection' }],
        legalActions: [
          {
            key: 'rollTermSkill',
            status: 'SKILLS_TRAINING',
            commandTypes: ['RollCharacterCreationTermSkill'],
            rollRequirement: { key: 'termSkill', dice: '1d6' },
            termSkillTableOptions: [
              { table: 'serviceSkills', label: 'Service skills' }
            ]
          }
        ]
      }
    })

    const viewModel = deriveCharacterCreationViewModel({
      flow: null,
      projection: currentProjection,
      character: character(currentProjection, {
        age: 22,
        characteristics: {
          str: 7,
          dex: 8,
          end: 7,
          int: 9,
          edu: 8,
          soc: 6
        },
        skills: ['Broker-0', 'Admin-1']
      }),
      readOnly: true
    })

    assert.equal(viewModel.flow, null)
    assert.equal(viewModel.wizard?.step, 'career')
    assert.deepEqual(viewModel.wizard?.termSkills?.rolled, [
      { label: 'Admin-1', detail: '1 on serviceSkills' }
    ])
    assert.deepEqual(viewModel.wizard?.termSkills?.actions, [
      {
        table: 'serviceSkills',
        label: 'Service skills',
        reason: 'Iona Vesh Merchant service skills',
        disabled: false
      }
    ])
    assert.equal(viewModel.wizard?.controlsDisabled, true)
  })

  it('prefers projected facts for editable term skill training with a stale flow', () => {
    const currentProjection = projection('SKILLS_TRAINING', {
      requiredTermSkillCount: 2,
      pendingCascadeSkills: [],
      terms: [
        {
          career: 'Merchant',
          skills: [],
          skillsAndTraining: [],
          benefits: [],
          complete: false,
          canReenlist: false,
          completedBasicTraining: true,
          musteringOut: false,
          anagathics: false,
          facts: {
            qualification: {
              career: 'Merchant',
              passed: true,
              previousCareerCount: 0,
              failedQualificationOptions: [],
              qualification: {
                expression: '2d6',
                rolls: [4, 4],
                total: 8,
                characteristic: 'int',
                target: 4,
                modifier: 1,
                success: true
              }
            },
            survival: {
              passed: true,
              canCommission: false,
              canAdvance: false,
              survival: {
                expression: '2d6',
                rolls: [5, 3],
                total: 8,
                characteristic: 'int',
                target: 5,
                modifier: 1,
                success: true
              }
            },
            basicTrainingSkills: ['Broker-0'],
            termSkillRolls: [
              {
                career: 'Merchant',
                table: 'serviceSkills',
                roll: { expression: '1d6', rolls: [1], total: 1 },
                tableRoll: 1,
                rawSkill: 'Admin',
                skill: 'Admin-1',
                characteristic: null,
                pendingCascadeSkill: null
              }
            ]
          }
        }
      ],
      actionPlan: {
        status: 'SKILLS_TRAINING',
        pendingDecisions: [{ key: 'skillTrainingSelection' }],
        legalActions: [
          {
            key: 'rollTermSkill',
            status: 'SKILLS_TRAINING',
            commandTypes: ['RollCharacterCreationTermSkill'],
            rollRequirement: { key: 'termSkill', dice: '1d6' },
            termSkillTableOptions: [
              { table: 'serviceSkills', label: 'Service skills' }
            ]
          }
        ]
      }
    })

    const viewModel = deriveCharacterCreationViewModel({
      flow: resolvedCareerFlow({ termSkillRolls: [] }),
      projection: currentProjection,
      character: character(currentProjection, {
        age: 22,
        characteristics: {
          str: 7,
          dex: 8,
          end: 7,
          int: 9,
          edu: 8,
          soc: 6
        },
        skills: ['Broker-0', 'Admin-1']
      }),
      readOnly: false
    })

    assert.equal(viewModel.mode, 'editable')
    assert.equal(viewModel.wizard?.step, 'career')
    assert.deepEqual(viewModel.wizard?.termSkills?.rolled, [
      { label: 'Admin-1', detail: '1 on serviceSkills' }
    ])
    assert.deepEqual(
      viewModel.wizard?.termSkills?.actions.map((action) => action.table),
      ['serviceSkills']
    )
  })

  it('derives read-only mustering from projected benefits without a legacy flow', () => {
    const currentProjection = projection('MUSTERING_OUT', {
      terms: [
        {
          career: 'Merchant',
          skills: [],
          skillsAndTraining: [],
          benefits: [],
          complete: true,
          canReenlist: false,
          completedBasicTraining: true,
          musteringOut: true,
          anagathics: false,
          facts: {
            survival: {
              passed: true,
              canCommission: false,
              canAdvance: false,
              survival: {
                expression: '2d6',
                rolls: [5, 3],
                total: 8,
                characteristic: 'int',
                target: 5,
                modifier: 1,
                success: true
              }
            },
            musteringBenefits: [
              {
                career: 'Merchant',
                kind: 'material',
                roll: { expression: '2d6', rolls: [3, 3], total: 6 },
                modifier: 0,
                tableRoll: 6,
                value: 'Blade',
                credits: 0,
                materialItem: 'Blade'
              }
            ]
          }
        }
      ],
      actionPlan: {
        status: 'MUSTERING_OUT',
        pendingDecisions: [{ key: 'musteringBenefitSelection' }],
        legalActions: [
          {
            key: 'resolveMusteringBenefit',
            status: 'MUSTERING_OUT',
            commandTypes: ['RollCharacterCreationMusteringBenefit'],
            rollRequirement: { key: 'musteringBenefit', dice: '1d6' },
            musteringBenefitOptions: [{ career: 'Merchant', kind: 'cash' }]
          }
        ]
      }
    })

    const viewModel = deriveCharacterCreationViewModel({
      flow: null,
      projection: currentProjection,
      character: character(currentProjection, {
        age: 22,
        characteristics: {
          str: 7,
          dex: 8,
          end: 7,
          int: 9,
          edu: 8,
          soc: 6
        }
      }),
      readOnly: true
    })

    assert.equal(viewModel.flow, null)
    assert.equal(viewModel.wizard?.step, 'equipment')
    assert.deepEqual(viewModel.wizard?.musteringOut?.benefits, [
      {
        label: 'Merchant Material',
        valueLabel: 'Blade',
        rollLabel: 'Roll 6',
        metaLabel: 'Blade'
      }
    ])
    assert.deepEqual(viewModel.wizard?.musteringOut?.actions, [
      {
        career: 'Merchant',
        kind: 'cash',
        label: 'Roll cash',
        disabled: false,
        title: ''
      }
    ])
    assert.equal(viewModel.wizard?.controlsDisabled, true)
  })

  it('includes aging and reenlistment prompt state for career terms', () => {
    const reenlistment = deriveCharacterCreationViewModel({
      flow: resolvedCareerFlow(),
      projection: projection('REENLISTMENT', {
        actionPlan: {
          status: 'REENLISTMENT',
          pendingDecisions: [{ key: 'reenlistmentResolution' }],
          legalActions: [
            {
              key: 'rollReenlistment',
              status: 'REENLISTMENT',
              commandTypes: ['ResolveCharacterCreationReenlistment'],
              rollRequirement: { key: 'reenlistment', dice: '2d6' }
            }
          ]
        }
      }),
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
      projection: projection('AGING', {
        actionPlan: {
          status: 'AGING',
          pendingDecisions: [{ key: 'agingResolution' }],
          legalActions: [
            {
              key: 'resolveAging',
              status: 'AGING',
              commandTypes: ['ResolveCharacterCreationAging'],
              rollRequirement: { key: 'aging', dice: '2d6' }
            }
          ]
        }
      }),
      readOnly: false
    })

    assert.equal(aging.wizard?.agingRoll?.label, 'Roll aging')
    assert.equal(aging.wizard?.agingRoll?.reason, 'Iona Vesh aging')
    assert.equal(aging.wizard?.reenlistmentRoll, null)
  })

  it('hides roll prompts when projected legal actions do not allow them', () => {
    const viewModel = deriveCharacterCreationViewModel({
      flow: resolvedCareerFlow(),
      projection: projection('REENLISTMENT', {
        actionPlan: {
          status: 'REENLISTMENT',
          pendingDecisions: [],
          legalActions: []
        }
      }),
      readOnly: false
    })

    assert.equal(viewModel.wizard?.reenlistmentRoll, null)
  })

  it('derives owner and spectator career controls from projected legal actions', () => {
    const currentFlow = survivalRollFlow()
    const staleProjection = projection('SURVIVAL', {
      actionPlan: {
        status: 'SURVIVAL',
        pendingDecisions: [],
        legalActions: []
      }
    })
    const liveProjection = projection('SURVIVAL', {
      history: [],
      actionPlan: {
        status: 'SURVIVAL',
        pendingDecisions: [],
        legalActions: [
          {
            key: 'rollSurvival',
            status: 'SURVIVAL',
            commandTypes: ['ResolveCharacterCreationSurvival'],
            rollRequirement: { key: 'survival', dice: '2d6' }
          }
        ]
      }
    })

    const ownerStale = deriveCharacterCreationViewModel({
      flow: currentFlow,
      projection: staleProjection,
      readOnly: false
    })
    const spectatorStale = deriveCharacterCreationViewModel({
      flow: currentFlow,
      projection: staleProjection,
      readOnly: true
    })
    const ownerLive = deriveCharacterCreationViewModel({
      flow: currentFlow,
      projection: liveProjection,
      readOnly: false
    })
    const spectatorLive = deriveCharacterCreationViewModel({
      flow: currentFlow,
      projection: liveProjection,
      readOnly: true
    })

    assert.equal(ownerStale.wizard?.careerRoll, null)
    assert.equal(spectatorStale.wizard?.careerRoll, null)
    assert.equal(ownerLive.wizard?.careerRoll?.label, 'Roll survival')
    assert.equal(spectatorLive.wizard?.careerRoll?.label, 'Roll survival')
    assert.equal(ownerLive.wizard?.controlsDisabled, false)
    assert.equal(spectatorLive.wizard?.controlsDisabled, true)
  })

  it('fails closed when projected legal actions belong to an older same-step status', () => {
    const viewModel = deriveCharacterCreationViewModel({
      flow: resolvedCareerFlow(),
      projection: projection('AGING', {
        actionPlan: {
          status: 'REENLISTMENT',
          pendingDecisions: [{ key: 'reenlistmentResolution' }],
          legalActions: [
            {
              key: 'rollReenlistment',
              status: 'REENLISTMENT',
              commandTypes: ['ResolveCharacterCreationReenlistment'],
              rollRequirement: { key: 'reenlistment', dice: '2d6' }
            }
          ]
        }
      }),
      readOnly: false
    })

    assert.equal(viewModel.wizard?.reenlistmentRoll, null)
    assert.equal(viewModel.wizard?.termResolution, null)
  })

  it('filters projected action sections to current projection status', () => {
    const section = deriveCharacterCreationProjectedActionSection(
      projection('SURVIVAL', {
        actionPlan: {
          status: 'SURVIVAL',
          pendingDecisions: [],
          legalActions: [
            {
              key: 'rollSurvival',
              status: 'SURVIVAL',
              commandTypes: ['ResolveCharacterCreationSurvival'],
              rollRequirement: { key: 'survival', dice: '2d6' }
            },
            {
              key: 'rollCommission',
              status: 'COMMISSION',
              commandTypes: ['ResolveCharacterCreationCommission'],
              rollRequirement: { key: 'commission', dice: '2d6' }
            }
          ]
        }
      })
    )

    assert.deepEqual(
      section.legalActions.map((action) => action.key),
      ['rollSurvival']
    )
    assert.equal(section.isLegalActionAvailable('rollSurvival'), true)
    assert.equal(section.isLegalActionAvailable('rollCommission'), false)
  })

  it('ignores projected legal actions whose status does not match the projection', () => {
    const viewModel = deriveCharacterCreationViewModel({
      flow: resolvedCareerFlow({
        completedTerms: [completedTerm(), completedTerm(), completedTerm()]
      }),
      projection: projection('REENLISTMENT', {
        actionPlan: {
          status: 'REENLISTMENT',
          pendingDecisions: [{ key: 'reenlistmentResolution' }],
          legalActions: [
            {
              key: 'resolveAging',
              status: 'AGING',
              commandTypes: ['ResolveCharacterCreationAging'],
              rollRequirement: { key: 'aging', dice: '2d6' }
            }
          ]
        }
      }),
      readOnly: false
    })

    assert.equal(viewModel.wizard?.agingRoll, null)
    assert.equal(viewModel.wizard?.termResolution, null)
  })

  it('ignores stale projected legal action option payloads', () => {
    const viewModel = deriveCharacterCreationViewModel({
      flow: resolvedCareerFlow({ termSkillRolls: [] }),
      projection: projection('SKILLS_TRAINING', {
        actionPlan: {
          status: 'SKILLS_TRAINING',
          pendingDecisions: [{ key: 'skillTrainingSelection' }],
          legalActions: [
            {
              key: 'rollTermSkill',
              status: 'AGING',
              commandTypes: ['RollCharacterCreationTermSkill'],
              rollRequirement: { key: 'termSkill', dice: '1d6' },
              termSkillTableOptions: [
                { table: 'serviceSkills', label: 'Stale service skills' }
              ]
            }
          ]
        }
      }),
      readOnly: false
    })

    assert.deepEqual(viewModel.wizard?.termSkills?.actions, [])
  })

  it('fails closed when projected creation legal actions are missing', () => {
    const reenlistment = deriveCharacterCreationViewModel({
      flow: resolvedCareerFlow(),
      projection: projection('REENLISTMENT'),
      readOnly: false
    })

    const skillsFlow = flow({
      step: 'skills',
      draft: {
        ...flow().draft,
        careerPlan: selectCharacterCreationCareerPlan('Merchant')
      }
    })
    const basicTraining = deriveCharacterCreationViewModel({
      flow: skillsFlow,
      projection: projection('BASIC_TRAINING'),
      readOnly: false
    })

    const mustering = deriveCharacterCreationViewModel({
      flow: flow({
        step: 'equipment',
        draft: createInitialCharacterDraft(characterId, {
          completedTerms: [completedTerm()]
        })
      }),
      projection: projection('MUSTERING_OUT'),
      readOnly: false
    })

    assert.equal(reenlistment.wizard?.reenlistmentRoll, null)
    assert.equal(basicTraining.wizard?.basicTraining, null)
    assert.deepEqual(mustering.wizard?.musteringOut?.actions, [])
  })

  it('hides stale phase widgets when projected status has moved on', () => {
    const termSkills = deriveCharacterCreationViewModel({
      flow: resolvedCareerFlow({ termSkillRolls: [] }),
      projection: projection('REENLISTMENT', {
        actionPlan: {
          status: 'REENLISTMENT',
          pendingDecisions: [],
          legalActions: []
        }
      }),
      readOnly: false
    })
    const mustering = deriveCharacterCreationViewModel({
      flow: flow({
        step: 'equipment',
        draft: createInitialCharacterDraft(characterId, {
          completedTerms: [completedTerm()]
        })
      }),
      projection: projection('ACTIVE', {
        actionPlan: {
          status: 'ACTIVE',
          pendingDecisions: [],
          legalActions: []
        }
      }),
      readOnly: false
    })

    assert.equal(termSkills.wizard?.termSkills, null)
    assert.equal(mustering.wizard?.musteringOut, null)
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
      projection: projection('AGING', {
        actionPlan: {
          status: 'AGING',
          pendingDecisions: [],
          legalActions: [
            {
              key: 'decideAnagathics',
              status: 'AGING',
              commandTypes: ['DecideCharacterCreationAnagathics']
            }
          ]
        }
      }),
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

  it('recovers pending aging choices from projected term facts after refresh', () => {
    const currentProjection = projection('REENLISTMENT', {
      terms: [
        projectedCompletedTerm({
          complete: false,
          musteringOut: false,
          facts: {
            aging: {
              roll: { expression: '2d6', rolls: [1, 1], total: 2 },
              modifier: -1,
              age: 34,
              characteristicChanges: [{ type: 'PHYSICAL', modifier: -1 }]
            }
          }
        })
      ],
      actionPlan: {
        status: 'REENLISTMENT',
        pendingDecisions: [{ key: 'agingResolution' }],
        legalActions: [
          {
            key: 'resolveAging',
            status: 'REENLISTMENT',
            commandTypes: [
              'ResolveCharacterCreationAging',
              'ResolveCharacterCreationAgingLosses'
            ],
            rollRequirement: { key: 'aging', dice: '2d6' }
          }
        ]
      }
    })

    const viewModel = deriveCharacterCreationViewModel({
      flow: resolvedCareerFlow(),
      projection: currentProjection,
      character: character(currentProjection),
      readOnly: false
    })

    assert.equal(viewModel.wizard?.agingChoices?.title, 'Aging effects')
    assert.deepEqual(viewModel.wizard?.agingChoices?.choices[0]?.options, [
      { characteristic: 'str', label: 'STR' },
      { characteristic: 'dex', label: 'DEX' },
      { characteristic: 'end', label: 'END' }
    ])
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
      projection: projection('MUSTERING_OUT', {
        actionPlan: {
          status: 'MUSTERING_OUT',
          pendingDecisions: [{ key: 'musteringBenefitSelection' }],
          legalActions: [
            {
              key: 'resolveMusteringBenefit',
              status: 'MUSTERING_OUT',
              commandTypes: ['RollCharacterCreationMusteringBenefit'],
              rollRequirement: { key: 'musteringBenefit', dice: '1d6' },
              musteringBenefitOptions: [
                { career: 'Merchant', kind: 'cash' },
                { career: 'Merchant', kind: 'material' }
              ]
            }
          ]
        }
      }),
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

  it('keeps the owner local review step after projected mustering completes', () => {
    const currentProjection = projection('MUSTERING_OUT', {
      terms: [
        projectedCompletedTerm({
          career: 'Scout',
          musteringOut: true,
          facts: {
            musteringBenefits: [
              {
                career: 'Scout',
                kind: 'material',
                roll: { expression: '1d6', rolls: [4], total: 4 },
                modifier: 0,
                tableRoll: 4,
                value: 'Gun',
                credits: 0,
                materialItem: 'Gun'
              }
            ]
          }
        })
      ],
      actionPlan: {
        status: 'MUSTERING_OUT',
        pendingDecisions: [],
        legalActions: []
      }
    })
    const reviewFlow = flow({
      step: 'review',
      draft: createInitialCharacterDraft(characterId, {
        name: 'Iona Vesh',
        completedTerms: [completedTerm()]
      })
    })

    const owner = deriveCharacterCreationViewModel({
      flow: reviewFlow,
      projection: currentProjection,
      character: character(currentProjection),
      readOnly: false
    })
    const spectator = deriveCharacterCreationViewModel({
      flow: reviewFlow,
      projection: currentProjection,
      character: character(currentProjection),
      readOnly: true
    })

    assert.equal(owner.wizard?.step, 'review')
    assert.equal(owner.wizard?.review?.title, 'Iona Vesh')
    assert.equal(spectator.wizard?.step, 'equipment')
    assert.equal(spectator.wizard?.musteringOut?.title, 'Mustering out')
  })

  it('includes term history and review summaries', () => {
    const careerHistory = deriveCharacterCreationViewModel({
      flow: flow({
        step: 'career',
        draft: createInitialCharacterDraft(characterId, {
          completedTerms: [completedTerm()]
        })
      }),
      projection: projection('CAREER_SELECTION', {
        terms: [
          projectedCompletedTerm({
            career: 'Merchant',
            skillsAndTraining: ['Broker-1']
          })
        ]
      }),
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
      projection: projection('ACTIVE', {
        terms: [
          projectedCompletedTerm({
            career: 'Merchant',
            skillsAndTraining: ['Broker-1']
          })
        ]
      }),
      readOnly: false
    })

    assert.equal(review.wizard?.review?.title, 'Iona Vesh')
    assert.equal(review.wizard?.review?.sections[0]?.label, 'Basics')
  })

  it('prefers projected term history over stale local completed terms', () => {
    const viewModel = deriveCharacterCreationViewModel({
      flow: flow({
        step: 'career',
        draft: createInitialCharacterDraft(characterId, {
          completedTerms: [completedTerm()]
        })
      }),
      projection: projection('CAREER_SELECTION', {
        terms: [
          projectedCompletedTerm({
            career: 'Scout',
            skillsAndTraining: ['Pilot-1']
          })
        ]
      }),
      readOnly: false
    })

    assert.equal(
      viewModel.wizard?.termHistory?.terms[0]?.startsWith('1. Scout: survived'),
      true
    )
    assert.equal(
      viewModel.wizard?.termHistory?.terms[0]?.includes('Merchant'),
      false
    )
  })

  it('prefers projected terms in the review summary over stale local completed terms', () => {
    const viewModel = deriveCharacterCreationViewModel({
      flow: flow({
        step: 'review',
        draft: createInitialCharacterDraft(characterId, {
          completedTerms: [completedTerm()]
        })
      }),
      projection: projection('ACTIVE', {
        terms: [
          projectedCompletedTerm({
            career: 'Scout',
            skillsAndTraining: ['Pilot-1']
          })
        ]
      }),
      readOnly: false
    })

    const terms = viewModel.wizard?.review?.sections.find(
      (section) => section.key === 'career-history'
    )

    assert.equal(terms?.items[0]?.label, 'Term 1')
    assert.equal(terms?.items[0]?.value.includes('Scout'), true)
    assert.equal(terms?.items[0]?.value.includes('Merchant'), false)
  })
})
