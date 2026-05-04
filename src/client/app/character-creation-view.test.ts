import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asCharacterId } from '../../shared/ids'
import {
  createCharacterCreationFlow,
  createInitialCharacterDraft
} from './character-creation-flow'
import {
  characterCreationPrimaryCtaLabels,
  characterCreationStepLabels,
  deriveCharacterCreationButtonStates,
  deriveCharacterCreationCtaLabels,
  deriveCharacterCreationFieldViewModels,
  deriveCharacterCreationReviewSummary,
  deriveCharacterCreationStepProgressItems,
  deriveCharacterCreationValidationSummary,
  equipmentText,
  parseCharacterCreationDraftPatch
} from './character-creation-view'

const characterId = asCharacterId('mustering-out-scout')

const completeFlow = () => ({
  step: 'review' as const,
  draft: createInitialCharacterDraft(characterId, {
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
  })
})

describe('character creation view helpers', () => {
  it('exposes step and CTA labels for the flow steps', () => {
    assert.deepEqual(characterCreationStepLabels, {
      basics: 'Basics',
      characteristics: 'Characteristics',
      skills: 'Skills',
      equipment: 'Equipment',
      review: 'Review'
    })
    assert.equal(
      characterCreationPrimaryCtaLabels.basics,
      'Continue to characteristics'
    )
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
        key: 'age',
        label: 'Age',
        kind: 'number',
        step: 'basics',
        value: '',
        required: false,
        errors: []
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
        step: 'skills',
        label: 'Skills',
        index: 2,
        current: true,
        complete: false,
        invalid: true,
        disabled: false,
        errors: ['At least one skill is required']
      },
      {
        step: 'equipment',
        label: 'Equipment',
        index: 3,
        current: false,
        complete: false,
        invalid: false,
        disabled: true,
        errors: []
      },
      {
        step: 'review',
        label: 'Review',
        index: 4,
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
        age: '34',
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
        notes: 'Detached scout.'
      }),
      {
        name: ' Iona Vesh ',
        characterType: 'NPC',
        age: 34,
        credits: 1200,
        notes: 'Detached scout.',
        skills: ['Pilot-1', 'Vacc Suit-0', 'Mechanic-0'],
        equipment: [
          { name: 'Vacc Suit', quantity: 1, notes: 'Carried' },
          { name: 'Laser Pistol', quantity: 1, notes: '3D6' },
          { name: 'Medkit', quantity: 2, notes: '' }
        ],
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
        age: undefined,
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
        key: 'skills',
        label: 'Skills',
        items: [{ label: 'Skills', value: 'Pilot-1, Vacc Suit-0' }]
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
