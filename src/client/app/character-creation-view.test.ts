import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asCharacterId } from '../../shared/ids'
import {
  createCharacterCreationFlow,
  createInitialCharacterDraft,
  type CharacterCreationFlow
} from './character-creation-flow'
import {
  characterCreationPrimaryCtaLabels,
  characterCreationStepLabels,
  characterCreationViewSteps,
  deriveCharacterCreationBasicTrainingButton,
  deriveCharacterCreationButtonStates,
  deriveCharacterCreationCareerOptionViewModels,
  deriveCharacterCreationCareerRollButton,
  deriveCharacterCreationCharacteristicRollButton,
  deriveCharacterCreationCtaLabels,
  deriveCharacterCreationFailedQualificationViewModel,
  deriveCharacterCreationFieldViewModels,
  deriveCharacterCreationHomeworldViewModel,
  deriveCharacterCreationNextStepViewModel,
  deriveCharacterCreationReviewSummary,
  deriveCharacterCreationStatStrip,
  deriveCharacterCreationStepProgressItems,
  deriveCharacterCreationValidationSummary,
  equipmentText,
  parseCharacterCreationDraftPatch
} from './character-creation-view'

const characterId = asCharacterId('mustering-out-scout')

const completeFlow = (): CharacterCreationFlow => ({
  step: 'review' as const,
  draft: {
    ...createInitialCharacterDraft(characterId, {
      characterType: 'PLAYER',
      name: 'Iona Vesh',
      age: 34,
      characteristics: {
        str: 7,
        dex: 8,
        end: 7,
        int: 9,
        edu: 8,
        soc: 6
      },
      skills: ['Pilot-1', 'Vacc Suit-0'],
      equipment: [
        { name: 'Vacc Suit', quantity: 1, notes: 'Carried' },
        { name: 'Medkit', quantity: 2, notes: '' }
      ],
      credits: 1200,
      notes: 'Detached scout.'
    }),
    homeworld: {
      lawLevel: 'No Law',
      tradeCodes: ['Asteroid']
    },
    backgroundSkills: ['Zero-G-0', 'Slug Pistol-0', 'Admin-0'],
    pendingCascadeSkills: [],
    careerPlan: {
      career: 'Scout',
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
      drafted: false,
      termSkillRolls: [{ table: 'serviceSkills', roll: 1, skill: 'Pilot' }],
      agingRoll: 0,
      agingMessage: 'Character aged to 34.',
      agingSelections: [],
      reenlistmentRoll: 7,
      reenlistmentOutcome: 'allowed'
    },
    completedTerms: [
      {
        career: 'Scout',
        drafted: false,
        age: 34,
        qualificationRoll: 8,
        survivalRoll: 9,
        survivalPassed: true,
        canCommission: false,
        commissionRoll: null,
        commissionPassed: null,
        canAdvance: false,
        advancementRoll: null,
        advancementPassed: null,
        termSkillRolls: [{ table: 'serviceSkills', roll: 1, skill: 'Pilot' }],
        agingRoll: 0,
        agingMessage: 'Character aged to 34.',
        agingSelections: [],
        reenlistmentRoll: 7,
        reenlistmentOutcome: 'allowed'
      }
    ],
    musteringBenefits: [
      {
        career: 'Scout',
        kind: 'cash',
        roll: 2,
        value: '10000',
        credits: 10000
      }
    ]
  }
})

describe('character creation view helpers', () => {
  it('exposes step and CTA labels for the flow steps', () => {
    assert.deepEqual(characterCreationStepLabels, {
      basics: 'Basics',
      characteristics: 'Characteristics',
      homeworld: 'Homeworld',
      career: 'Career',
      skills: 'Skills',
      equipment: 'Equipment',
      review: 'Review'
    })
    assert.deepEqual(characterCreationViewSteps(), [
      'basics',
      'characteristics',
      'homeworld',
      'career',
      'skills',
      'equipment',
      'review'
    ])
    assert.equal(
      characterCreationPrimaryCtaLabels.basics,
      'Continue to characteristics'
    )
    assert.equal(
      characterCreationPrimaryCtaLabels.characteristics,
      'Continue to homeworld'
    )
    assert.equal(
      characterCreationPrimaryCtaLabels.homeworld,
      'Continue to career'
    )
    assert.deepEqual(deriveCharacterCreationCtaLabels('career'), {
      primary: 'Continue to skills',
      secondary: 'Back'
    })
    assert.deepEqual(deriveCharacterCreationCtaLabels('homeworld'), {
      primary: 'Continue to career',
      secondary: 'Back'
    })
    assert.deepEqual(deriveCharacterCreationCtaLabels('basics'), {
      primary: 'Continue to characteristics',
      secondary: null
    })
    assert.deepEqual(deriveCharacterCreationCtaLabels('review'), {
      primary: 'Create character',
      secondary: 'Back'
    })
  })

  it('derives compact field view models with validation errors', () => {
    const basics = createCharacterCreationFlow(characterId)

    assert.deepEqual(deriveCharacterCreationFieldViewModels(basics), [
      {
        key: 'name',
        label: 'Name',
        kind: 'text',
        step: 'basics',
        value: '',
        required: true,
        errors: ['Name is required']
      },
      {
        key: 'characterType',
        label: 'Type',
        kind: 'select',
        step: 'basics',
        value: 'PLAYER',
        required: true,
        errors: []
      }
    ])

    const characteristics = {
      ...basics,
      step: 'characteristics' as const
    }
    assert.deepEqual(
      deriveCharacterCreationFieldViewModels(characteristics).map((field) => ({
        key: field.key,
        value: field.value,
        errors: field.errors
      })),
      [
        { key: 'str', value: '', errors: ['STR is required'] },
        { key: 'dex', value: '', errors: ['DEX is required'] },
        { key: 'end', value: '', errors: ['END is required'] },
        { key: 'int', value: '', errors: ['INT is required'] },
        { key: 'edu', value: '', errors: ['EDU is required'] },
        { key: 'soc', value: '', errors: ['SOC is required'] }
      ]
    )

    const equipment = {
      step: 'equipment' as const,
      draft: createInitialCharacterDraft(characterId, {
        credits: -1,
        equipment: [{ name: 'Vacc Suit', quantity: 1, notes: 'Carried' }]
      })
    }
    assert.deepEqual(deriveCharacterCreationFieldViewModels(equipment), [
      {
        key: 'equipment',
        label: 'Equipment',
        kind: 'textarea',
        step: 'equipment',
        value: 'Vacc Suit | 1 | Carried',
        required: false,
        errors: []
      },
      {
        key: 'credits',
        label: 'Credits',
        kind: 'number',
        step: 'equipment',
        value: '-1',
        required: false,
        errors: ['Credits must be a non-negative number']
      },
      {
        key: 'notes',
        label: 'Notes',
        kind: 'textarea',
        step: 'equipment',
        value: '',
        required: false,
        errors: []
      }
    ])
  })

  it('derives career step field view models with SRD roll requirements', () => {
    const careerFlow = {
      step: 'career' as const,
      draft: {
        ...createInitialCharacterDraft(characterId, {
          name: 'Iona Vesh',
          characteristics: {
            str: 7,
            dex: 8,
            end: 7,
            int: 9,
            edu: 8,
            soc: 6
          }
        }),
        careerPlan: {
          career: 'Merchant',
          qualificationRoll: 7,
          qualificationPassed: true,
          survivalRoll: 8,
          survivalPassed: true,
          commissionRoll: null,
          commissionPassed: null,
          advancementRoll: null,
          advancementPassed: null,
          canCommission: true,
          canAdvance: false,
          drafted: false,
          anagathics: null
        }
      }
    }

    assert.deepEqual(deriveCharacterCreationFieldViewModels(careerFlow), [
      {
        key: 'career',
        label: 'Career',
        kind: 'select',
        step: 'career',
        value: 'Merchant',
        required: true,
        errors: []
      },
      {
        key: 'qualificationRoll',
        label: 'Qualification roll',
        kind: 'number',
        step: 'career',
        value: '7',
        required: true,
        errors: []
      },
      {
        key: 'survivalRoll',
        label: 'Survival roll',
        kind: 'number',
        step: 'career',
        value: '8',
        required: true,
        errors: []
      },
      {
        key: 'commissionRoll',
        label: 'Commission roll',
        kind: 'number',
        step: 'career',
        value: '',
        required: true,
        errors: ['Commission roll is required']
      },
      {
        key: 'advancementRoll',
        label: 'Advancement roll',
        kind: 'number',
        step: 'career',
        value: '',
        required: false,
        errors: []
      }
    ])
  })

  it('derives only failed qualification fallback options from the shared planner', () => {
    const failedFlow = {
      step: 'career' as const,
      draft: createInitialCharacterDraft(characterId, {
        careerPlan: {
          career: 'Merchant',
          qualificationRoll: 2,
          qualificationPassed: false,
          survivalRoll: null,
          survivalPassed: null,
          commissionRoll: null,
          commissionPassed: null,
          advancementRoll: null,
          advancementPassed: null,
          canCommission: null,
          canAdvance: null,
          drafted: false
        }
      })
    }

    assert.deepEqual(
      deriveCharacterCreationFailedQualificationViewModel(failedFlow),
      {
        open: true,
        title: 'Qualification failed',
        message: 'Choose Drifter or roll for the Draft.',
        options: [
          {
            option: 'Drifter',
            label: 'Drifter',
            actionLabel: 'Become a Drifter',
            rollRequirement: null
          },
          {
            option: 'Draft',
            label: 'Draft',
            actionLabel: 'Roll draft',
            rollRequirement: '1d6'
          }
        ]
      }
    )

    const alreadyDraftedFlow = {
      ...failedFlow,
      draft: {
        ...failedFlow.draft,
        completedTerms: [
          {
            career: 'Scout',
            drafted: true,
            age: 22,
            qualificationRoll: null,
            survivalRoll: 7,
            survivalPassed: true,
            canCommission: false,
            commissionRoll: null,
            commissionPassed: null,
            canAdvance: false,
            advancementRoll: null,
            advancementPassed: null,
            reenlistmentRoll: null,
            reenlistmentOutcome: null
          }
        ]
      }
    }

    assert.deepEqual(
      deriveCharacterCreationFailedQualificationViewModel(
        alreadyDraftedFlow
      ).options.map((option) => option.option),
      ['Drifter']
    )
  })

  it('derives homeworld fields, options, and background skill summary', () => {
    const flow = {
      step: 'career' as const,
      draft: {
        ...createInitialCharacterDraft(characterId, {
          name: 'Iona Vesh',
          characteristics: {
            str: 7,
            dex: 8,
            end: 7,
            int: 9,
            edu: 9,
            soc: 6
          }
        }),
        homeworld: {
          lawLevel: 'No Law',
          tradeCodes: ['Asteroid', 'Industrial']
        },
        backgroundSkills: ['Zero-G-0'],
        pendingCascadeSkills: ['Gun Combat-0']
      }
    }

    assert.deepEqual(
      deriveCharacterCreationFieldViewModels(flow, 'homeworld'),
      [
        {
          key: 'homeworld.lawLevel',
          label: 'Law level',
          kind: 'text',
          step: 'homeworld',
          value: 'No Law',
          required: true,
          errors: []
        },
        {
          key: 'homeworld.tradeCodes',
          label: 'Trade code',
          kind: 'text',
          step: 'homeworld',
          value: 'Asteroid, Industrial',
          required: true,
          errors: []
        }
      ]
    )

    const viewModel = deriveCharacterCreationHomeworldViewModel(flow)

    assert.equal(viewModel.step, 'homeworld')
    assert.deepEqual(
      viewModel.lawLevelOptions.filter((option) => option.selected),
      [{ value: 'No Law', label: 'No Law', selected: true }]
    )
    assert.deepEqual(
      viewModel.tradeCodeOptions.filter((option) => option.selected),
      [
        { value: 'Asteroid', label: 'Asteroid', selected: true },
        { value: 'Industrial', label: 'Industrial', selected: true }
      ]
    )
    assert.deepEqual(viewModel.summary, {
      lawLevel: 'No Law',
      tradeCodes: ['Asteroid', 'Industrial'],
      tradeCodeSummary: 'Asteroid, Industrial',
      backgroundSkillSummary: '2/4 background skills selected',
      cascadeSummary: '1 cascade choice pending'
    })
    assert.deepEqual(viewModel.pendingCascadeChoice, {
      open: true,
      cascadeSkill: 'Gun Combat-0',
      title: 'Choose Gun Combat',
      prompt: 'Resolve Gun Combat-0 into a specialty.',
      label: 'Gun Combat',
      level: 0,
      options: [
        { value: 'Archery-0', label: 'Archery', cascade: false },
        { value: 'Energy Pistol-0', label: 'Energy Pistol', cascade: false },
        { value: 'Energy Rifle-0', label: 'Energy Rifle', cascade: false },
        { value: 'Shotgun-0', label: 'Shotgun', cascade: false },
        { value: 'Slug Pistol-0', label: 'Slug Pistol', cascade: false },
        { value: 'Slug Rifle-0', label: 'Slug Rifle', cascade: false }
      ]
    })
    assert.deepEqual(viewModel.backgroundSkills, {
      allowance: 4,
      selectedSkills: ['Zero-G-0'],
      availableSkills: [
        'Gun Combat*',
        'Zero-G',
        'Broker',
        'Admin',
        'Advocate',
        'Animals*',
        'Carousing',
        'Comms',
        'Computer',
        'Electronics',
        'Engineering',
        'Life Sciences',
        'Linguistics',
        'Mechanics',
        'Medicine',
        'Physical Sciences',
        'Social Sciences',
        'Space Sciences'
      ],
      skillOptions: [
        {
          value: 'Gun Combat-0',
          label: 'Gun Combat*',
          selected: true,
          preselected: true,
          cascade: true
        },
        {
          value: 'Zero-G-0',
          label: 'Zero-G',
          selected: true,
          preselected: true,
          cascade: false
        },
        {
          value: 'Broker-0',
          label: 'Broker',
          selected: false,
          preselected: true,
          cascade: false
        },
        {
          value: 'Admin-0',
          label: 'Admin',
          selected: false,
          preselected: false,
          cascade: false
        },
        {
          value: 'Advocate-0',
          label: 'Advocate',
          selected: false,
          preselected: false,
          cascade: false
        },
        {
          value: 'Animals-0',
          label: 'Animals*',
          selected: false,
          preselected: false,
          cascade: true
        },
        {
          value: 'Carousing-0',
          label: 'Carousing',
          selected: false,
          preselected: false,
          cascade: false
        },
        {
          value: 'Comms-0',
          label: 'Comms',
          selected: false,
          preselected: false,
          cascade: false
        },
        {
          value: 'Computer-0',
          label: 'Computer',
          selected: false,
          preselected: false,
          cascade: false
        },
        {
          value: 'Electronics-0',
          label: 'Electronics',
          selected: false,
          preselected: false,
          cascade: false
        },
        {
          value: 'Engineering-0',
          label: 'Engineering',
          selected: false,
          preselected: false,
          cascade: false
        },
        {
          value: 'Life Sciences-0',
          label: 'Life Sciences',
          selected: false,
          preselected: false,
          cascade: false
        },
        {
          value: 'Linguistics-0',
          label: 'Linguistics',
          selected: false,
          preselected: false,
          cascade: false
        },
        {
          value: 'Mechanics-0',
          label: 'Mechanics',
          selected: false,
          preselected: false,
          cascade: false
        },
        {
          value: 'Medicine-0',
          label: 'Medicine',
          selected: false,
          preselected: false,
          cascade: false
        },
        {
          value: 'Physical Sciences-0',
          label: 'Physical Sciences',
          selected: false,
          preselected: false,
          cascade: false
        },
        {
          value: 'Social Sciences-0',
          label: 'Social Sciences',
          selected: false,
          preselected: false,
          cascade: false
        },
        {
          value: 'Space Sciences-0',
          label: 'Space Sciences',
          selected: false,
          preselected: false,
          cascade: false
        }
      ],
      remainingSelections: 2,
      pendingCascadeSkills: ['Gun Combat-0'],
      cascadeSkillChoices: [
        {
          cascadeSkill: 'Gun Combat-0',
          label: 'Gun Combat',
          level: 0,
          options: [
            { value: 'Archery-0', label: 'Archery', cascade: false },
            {
              value: 'Energy Pistol-0',
              label: 'Energy Pistol',
              cascade: false
            },
            { value: 'Energy Rifle-0', label: 'Energy Rifle', cascade: false },
            { value: 'Shotgun-0', label: 'Shotgun', cascade: false },
            { value: 'Slug Pistol-0', label: 'Slug Pistol', cascade: false },
            { value: 'Slug Rifle-0', label: 'Slug Rifle', cascade: false }
          ]
        }
      ],
      errors: ['1 cascade skill choice remains'],
      message: '1 cascade skill choice remains'
    })
  })

  it('derives a compact stat strip from any creation step', () => {
    assert.deepEqual(
      deriveCharacterCreationStatStrip({
        draft: createInitialCharacterDraft(characterId, {
          characteristics: {
            str: 3,
            dex: 6,
            end: 8,
            int: 9,
            edu: 12,
            soc: null
          }
        })
      }),
      [
        {
          key: 'str',
          label: 'Str',
          value: '3',
          modifier: '-1',
          missing: false
        },
        { key: 'dex', label: 'Dex', value: '6', modifier: '0', missing: false },
        { key: 'end', label: 'End', value: '8', modifier: '0', missing: false },
        {
          key: 'int',
          label: 'Int',
          value: '9',
          modifier: '+1',
          missing: false
        },
        {
          key: 'edu',
          label: 'Edu',
          value: '12',
          modifier: '+2',
          missing: false
        },
        { key: 'soc', label: 'Soc', value: '-', modifier: '-', missing: true }
      ]
    )
  })

  it('derives a mobile next-step model with phase prompt and actions', () => {
    const flow = {
      step: 'homeworld' as const,
      draft: {
        ...createInitialCharacterDraft(characterId, {
          name: 'Iona Vesh',
          characteristics: {
            str: 7,
            dex: 8,
            end: 7,
            int: 9,
            edu: 9,
            soc: 6
          }
        }),
        homeworld: {
          lawLevel: 'No Law',
          tradeCodes: ['Asteroid']
        },
        backgroundSkills: ['Zero-G-0', 'Admin-0', 'Broker-0'],
        pendingCascadeSkills: ['Gun Combat-0']
      }
    }

    const viewModel = deriveCharacterCreationNextStepViewModel(flow)

    assert.equal(viewModel.step, 'homeworld')
    assert.equal(viewModel.phase, 'Homeworld')
    assert.equal(viewModel.prompt, 'Choose a Gun Combat specialty.')
    assert.deepEqual(viewModel.blockingChoice, {
      open: true,
      cascadeSkill: 'Gun Combat-0',
      title: 'Choose Gun Combat',
      prompt: 'Resolve Gun Combat-0 into a specialty.',
      label: 'Gun Combat',
      level: 0,
      options: [
        { value: 'Archery-0', label: 'Archery', cascade: false },
        { value: 'Energy Pistol-0', label: 'Energy Pistol', cascade: false },
        { value: 'Energy Rifle-0', label: 'Energy Rifle', cascade: false },
        { value: 'Shotgun-0', label: 'Shotgun', cascade: false },
        { value: 'Slug Pistol-0', label: 'Slug Pistol', cascade: false },
        { value: 'Slug Rifle-0', label: 'Slug Rifle', cascade: false }
      ]
    })
    assert.deepEqual(viewModel.primaryAction, {
      label: 'Continue to career',
      disabled: true,
      reason: '1 issue to fix'
    })
    assert.deepEqual(viewModel.secondaryAction, {
      label: 'Back',
      disabled: false,
      reason: null
    })
    assert.deepEqual(viewModel.validation, {
      ok: false,
      step: 'homeworld',
      errors: ['Pending background cascade skills must be resolved'],
      errorCount: 1,
      message: '1 issue to fix'
    })
    assert.deepEqual(
      viewModel.stats.map(({ label, value, modifier, missing }) => ({
        label,
        value,
        modifier,
        missing
      })),
      [
        { label: 'Str', value: '7', modifier: '0', missing: false },
        { label: 'Dex', value: '8', modifier: '0', missing: false },
        { label: 'End', value: '7', modifier: '0', missing: false },
        { label: 'Int', value: '9', modifier: '+1', missing: false },
        { label: 'Edu', value: '9', modifier: '+1', missing: false },
        { label: 'Soc', value: '6', modifier: '0', missing: false }
      ]
    )
  })

  it('derives the basic training button from an empty skills step', () => {
    const flow = {
      step: 'skills' as const,
      draft: createInitialCharacterDraft(characterId, {
        name: 'Iona Vesh',
        characteristics: completeFlow().draft.characteristics,
        careerPlan: completeFlow().draft.careerPlan
      })
    }

    assert.deepEqual(deriveCharacterCreationBasicTrainingButton(flow), {
      label: 'Apply basic training',
      reason: 'First Scout term grants service skills at level 0',
      skills: [
        'Comms-0',
        'Electronics-0',
        'Gun Combat-0',
        'Gunnery-0',
        'Recon-0',
        'Piloting-0'
      ],
      disabled: false
    })

    assert.equal(
      deriveCharacterCreationBasicTrainingButton({
        ...flow,
        draft: { ...flow.draft, skills: ['Pilot-0'] }
      }),
      null
    )
  })

  it('derives the next characteristic roll button from missing stats', () => {
    const flow = {
      step: 'characteristics' as const,
      draft: createInitialCharacterDraft(characterId, {
        name: 'Iona Vesh',
        characteristics: {
          str: 7,
          dex: null,
          end: null,
          int: null,
          edu: null,
          soc: null
        }
      })
    }

    assert.deepEqual(deriveCharacterCreationCharacteristicRollButton(flow), {
      label: 'Roll Dex',
      reason: 'Iona Vesh Dex',
      disabled: false
    })

    assert.equal(
      deriveCharacterCreationCharacteristicRollButton({
        ...flow,
        step: 'career'
      }),
      null
    )
  })

  it('derives the next career roll button from SRD career progress', () => {
    const careerFlow = {
      step: 'career' as const,
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
          career: 'Merchant',
          qualificationRoll: null,
          qualificationPassed: null,
          survivalRoll: null,
          survivalPassed: null,
          commissionRoll: null,
          commissionPassed: null,
          advancementRoll: null,
          advancementPassed: null,
          canCommission: null,
          canAdvance: null,
          drafted: false
        }
      })
    }

    assert.deepEqual(deriveCharacterCreationCareerRollButton(careerFlow), {
      label: 'Roll qualification',
      reason: 'Iona Vesh Merchant qualification',
      disabled: false,
      skipLabel: null
    })

    assert.equal(
      deriveCharacterCreationCareerRollButton({
        ...careerFlow,
        step: 'skills'
      }),
      null
    )
  })

  it('derives SRD career option view models from draft characteristics', () => {
    const options = deriveCharacterCreationCareerOptionViewModels({
      careerPlan: completeFlow().draft.careerPlan,
      characteristics: {
        str: 7,
        dex: 8,
        end: 7,
        int: 9,
        edu: 8,
        soc: 6
      }
    })

    assert.deepEqual(options[0], {
      key: 'Scout',
      label: 'Scout',
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
    })
  })

  it('derives validation summaries from the current flow rules', () => {
    const flow = createCharacterCreationFlow(characterId)

    assert.deepEqual(deriveCharacterCreationValidationSummary(flow), {
      ok: false,
      step: 'basics',
      errors: ['Name is required'],
      errorCount: 1,
      message: '1 issue to fix'
    })
    assert.deepEqual(
      deriveCharacterCreationValidationSummary(completeFlow(), 'review'),
      {
        ok: true,
        step: 'review',
        errors: [],
        errorCount: 0,
        message: 'Ready to continue'
      }
    )
  })

  it('blocks career progression after failed qualification', () => {
    const flow = {
      step: 'career' as const,
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
          career: 'Merchant',
          qualificationRoll: 2,
          qualificationPassed: false,
          survivalRoll: null,
          survivalPassed: null,
          commissionRoll: null,
          commissionPassed: null,
          advancementRoll: null,
          advancementPassed: null,
          canCommission: true,
          canAdvance: false,
          drafted: false
        }
      })
    }

    assert.deepEqual(deriveCharacterCreationValidationSummary(flow), {
      ok: false,
      step: 'career',
      errors: [
        'Qualification failed; choose a different career',
        'Survival roll is required',
        'Commission roll is required'
      ],
      errorCount: 3,
      message: '3 issues to fix'
    })
  })

  it('derives mobile wizard progress items from step validation', () => {
    const flow = {
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
        }
      })
    }

    assert.deepEqual(deriveCharacterCreationStepProgressItems(flow), [
      {
        step: 'basics',
        label: 'Basics',
        index: 0,
        current: false,
        complete: true,
        invalid: false,
        disabled: false,
        errors: []
      },
      {
        step: 'characteristics',
        label: 'Characteristics',
        index: 1,
        current: false,
        complete: true,
        invalid: false,
        disabled: false,
        errors: []
      },
      {
        step: 'homeworld',
        label: 'Homeworld',
        index: 2,
        current: false,
        complete: false,
        invalid: true,
        disabled: false,
        errors: [
          'Homeworld law level is required',
          'Homeworld trade code is required'
        ]
      },
      {
        step: 'career',
        label: 'Career',
        index: 3,
        current: false,
        complete: false,
        invalid: true,
        disabled: false,
        errors: [
          'Career is required',
          'Qualification roll is required',
          'Survival roll is required'
        ]
      },
      {
        step: 'skills',
        label: 'Skills',
        index: 4,
        current: true,
        complete: false,
        invalid: true,
        disabled: false,
        errors: ['At least one skill is required']
      },
      {
        step: 'equipment',
        label: 'Equipment',
        index: 5,
        current: false,
        complete: false,
        invalid: false,
        disabled: true,
        errors: []
      },
      {
        step: 'review',
        label: 'Review',
        index: 6,
        current: false,
        complete: false,
        invalid: false,
        disabled: true,
        errors: []
      }
    ])
  })

  it('derives button enabled state from current step validation', () => {
    assert.deepEqual(
      deriveCharacterCreationButtonStates(
        createCharacterCreationFlow(characterId)
      ),
      {
        primary: {
          label: 'Continue to characteristics',
          disabled: true,
          reason: '1 issue to fix'
        },
        secondary: null
      }
    )

    assert.deepEqual(deriveCharacterCreationButtonStates(completeFlow()), {
      primary: {
        label: 'Create character',
        disabled: false,
        reason: null
      },
      secondary: {
        label: 'Back',
        disabled: false,
        reason: null
      }
    })
  })

  it('parses simple form values into a draft patch', () => {
    assert.deepEqual(
      parseCharacterCreationDraftPatch({
        name: ' Iona Vesh ',
        characterType: 'NPC',
        str: '7',
        dex: '8',
        end: '',
        'characteristics.int': '9',
        edu: 8,
        soc: 'bad',
        skills: 'Pilot-1, Vacc Suit-0\nMechanic-0',
        equipment:
          'Vacc Suit | 1 | Carried\nLaser Pistol | bad | 3D6\n\nMedkit | 2',
        credits: '1200',
        notes: 'Detached scout.',
        career: 'Scout',
        drafted: 'true',
        qualificationRoll: 8,
        survivalRoll: '',
        commissionRoll: null,
        advancementRoll: 'bad',
        'homeworld.lawLevel': ' No Law ',
        'homeworld.tradeCodes': 'Asteroid, Industrial'
      }),
      {
        name: ' Iona Vesh ',
        characterType: 'NPC',
        credits: 1200,
        notes: 'Detached scout.',
        skills: ['Pilot-1', 'Vacc Suit-0', 'Mechanic-0'],
        equipment: [
          { name: 'Vacc Suit', quantity: 1, notes: 'Carried' },
          { name: 'Laser Pistol', quantity: 1, notes: '3D6' },
          { name: 'Medkit', quantity: 2, notes: '' }
        ],
        careerPlan: {
          career: 'Scout',
          qualificationRoll: 8,
          qualificationPassed: null,
          survivalRoll: null,
          survivalPassed: null,
          commissionRoll: null,
          commissionPassed: null,
          advancementRoll: Number.NaN,
          advancementPassed: null,
          canCommission: null,
          canAdvance: null,
          drafted: true,
          anagathics: null
        },
        homeworld: {
          lawLevel: 'No Law',
          tradeCodes: ['Asteroid', 'Industrial']
        },
        characteristics: {
          str: 7,
          dex: 8,
          end: null,
          int: 9,
          edu: 8,
          soc: Number.NaN
        }
      }
    )
  })

  it('keeps sparse form values sparse and ignores unknown character types', () => {
    assert.deepEqual(
      parseCharacterCreationDraftPatch({
        characterType: 'ALIEN',
        credits: '',
        skills: ''
      }),
      {
        credits: 0,
        skills: []
      }
    )
  })

  it('derives review summaries suitable for display', () => {
    const summary = deriveCharacterCreationReviewSummary(completeFlow())

    assert.equal(summary.title, 'Iona Vesh')
    assert.equal(summary.subtitle, 'PLAYER')
    assert.deepEqual(summary.sections, [
      {
        key: 'basics',
        label: 'Basics',
        items: [
          { label: 'Name', value: 'Iona Vesh' },
          { label: 'Type', value: 'PLAYER' },
          { label: 'Age', value: '34' }
        ]
      },
      {
        key: 'characteristics',
        label: 'Characteristics',
        items: [
          { label: 'Str', value: '7' },
          { label: 'Dex', value: '8' },
          { label: 'End', value: '7' },
          { label: 'Int', value: '9' },
          { label: 'Edu', value: '8' },
          { label: 'Soc', value: '6' }
        ]
      },
      {
        key: 'career',
        label: 'Career',
        items: [
          { label: 'Career', value: 'Scout' },
          { label: 'Qualification', value: '8 (passed)' },
          { label: 'Survival', value: '9 (passed)' },
          { label: 'Commission', value: 'Not available' },
          { label: 'Advancement', value: 'Not available' }
        ]
      },
      {
        key: 'career-history',
        label: 'Terms',
        items: [
          {
            label: 'Term 1',
            value:
              'Scout, survived, training Pilot (1), aging 0 Character aged to 34.'
          }
        ]
      },
      {
        key: 'skills',
        label: 'Skills',
        items: [{ label: 'Skills', value: 'Pilot-1, Vacc Suit-0' }]
      },
      {
        key: 'mustering-out',
        label: 'Mustering out',
        items: [{ label: 'Benefit 1', value: 'Scout cash 2: 10000' }]
      },
      {
        key: 'equipment',
        label: 'Equipment',
        items: [
          { label: 'Equipment', value: 'Vacc Suit x1, Medkit x2' },
          { label: 'Credits', value: '1200' },
          { label: 'Notes', value: 'Detached scout.' }
        ]
      }
    ])
  })

  it('formats equipment text for textarea controls', () => {
    assert.equal(
      equipmentText([
        { name: 'Vacc Suit', quantity: 1, notes: 'Carried' },
        { name: 'Medkit', quantity: 2, notes: '' }
      ]),
      'Vacc Suit | 1 | Carried\nMedkit | 2 | '
    )
  })
})
