import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { asCharacterId, asGameId, asUserId } from '../../shared/ids'
import type { GameState } from '../../shared/state'
import {
  advanceCharacterCreationStep,
  applyCharacterCreationBasicTraining,
  applyCharacterCreationBackgroundSkillSelection,
  applyCharacterCreationAnagathicsDecision,
  applyCharacterCreationCharacteristicRoll,
  applyCharacterCreationCareerRoll,
  applyCharacterCreationCareerPlan,
  applyCharacterCreationAgingChange,
  applyCharacterCreationAgingRoll,
  applyCharacterCreationMusteringBenefit,
  applyCharacterCreationReenlistmentRoll,
  applyCharacterCreationTermSkillRoll,
  applyParsedCharacterCreationDraftPatch,
  backCharacterCreationStep,
  backCharacterCreationWizardStep,
  canRollCharacterCreationMusteringBenefit,
  characterCreationMusteringBenefitRollModifier,
  type CharacterCreationFlow,
  characterCreationCareerNames,
  completeCharacterCreationCareerTerm,
  characterCreationSteps,
  createCharacterCreationFlow,
  createInitialCharacterDraft,
  createManualCharacterCreationFlow,
  deriveCharacterCreationCommands,
  deriveCharacterCreationBasicTrainingAction,
  deriveCharacterCreationAnagathicsDecision,
  deriveCharacterSheetPatch,
  deriveCreateCharacterCommand,
  deriveCharacterCreationBackgroundSkillPlan,
  deriveInitialCharacterCreationStateCommands,
  deriveNextCharacterCreationCharacteristicRoll,
  deriveNextCharacterCreationCareerRoll,
  deriveNextCharacterCreationAgingRoll,
  deriveNextCharacterCreationReenlistmentRoll,
  deriveCharacterCreationAgingChangeOptions,
  deriveCharacterCreationTermSkillTableActions,
  deriveStartCharacterCareerTermCommand,
  deriveStartCharacterCreationCommand,
  deriveUpdateCharacterSheetCommand,
  evaluateCharacterCreationCareerPlan,
  remainingMusteringBenefits,
  remainingCharacterCreationTermSkillRolls,
  nextCharacterCreationWizardStep,
  removeCharacterCreationBackgroundSkillSelection,
  resolveCharacterCreationCascadeSkill,
  resolveCharacterCreationTermCascadeSkill,
  selectCharacterCreationCareerPlan,
  skipCharacterCreationCareerRoll,
  updateCharacterCreationDraft,
  updateCharacterCreationFields,
  validateCurrentCharacterCreationStep
} from './character-creation-flow'

const identity = {
  gameId: asGameId('game-1'),
  actorId: asUserId('user-1')
}

const characterId = asCharacterId('mustering-out-scout')

const state = {
  id: identity.gameId,
  slug: 'game-1',
  name: 'Spinward Test',
  ownerId: identity.actorId,
  players: {},
  characters: {},
  boards: {},
  pieces: {},
  diceLog: [],
  selectedBoardId: null,
  eventSeq: 12
} satisfies GameState

const completeDraft = () =>
  createInitialCharacterDraft(characterId, {
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
    homeworld: {
      lawLevel: 'No Law',
      tradeCodes: ['Asteroid']
    },
    backgroundSkills: ['Zero-G-0', 'Gun Combat-0', 'Admin-0'],
    pendingCascadeSkills: [],
    careerPlan: selectCharacterCreationCareerPlan('Merchant'),
    skills: ['Pilot-1', 'Vacc Suit-0'],
    equipment: [{ name: 'Vacc Suit', quantity: 1, notes: 'Carried' }],
    credits: 1200,
    notes: 'Detached scout.'
  })

describe('character creation flow', () => {
  it('creates a blank player draft at the basics step', () => {
    const flow = createCharacterCreationFlow(characterId)

    assert.equal(flow.step, 'basics')
    assert.equal(flow.draft.characterId, characterId)
    assert.equal(flow.draft.characterType, 'PLAYER')
    assert.equal(flow.draft.name, '')
    assert.equal(flow.draft.age, 18)
    assert.deepEqual(flow.draft.characteristics, {
      str: null,
      dex: null,
      end: null,
      int: null,
      edu: null,
      soc: null
    })
    assert.deepEqual(characterCreationSteps(), [
      'basics',
      'characteristics',
      'homeworld',
      'career',
      'skills',
      'equipment',
      'review'
    ])
    assert.deepEqual(characterCreationCareerNames().slice(0, 3), [
      'Scout',
      'Merchant',
      'Marine'
    ])
  })

  it('initializes a manual draft from room state and name defaults', () => {
    const existingCharacterId = asCharacterId('character-2')
    const roomState = {
      ...state,
      characters: {
        [existingCharacterId]: {
          id: existingCharacterId,
          ownerId: identity.actorId,
          type: 'PLAYER',
          name: 'Character 2',
          active: true,
          notes: '',
          age: null,
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
          creation: null
        }
      }
    } satisfies GameState

    const defaultFlow = createManualCharacterCreationFlow({ state: roomState })
    assert.equal(defaultFlow.step, 'basics')
    assert.equal(defaultFlow.draft.name, 'Character 2')
    assert.equal(defaultFlow.draft.characterId, asCharacterId('character-2-2'))

    const namedFlow = createManualCharacterCreationFlow({
      state: roomState,
      name: '  Iona Vesh  ',
      characterType: 'NPC'
    })
    assert.equal(namedFlow.draft.name, 'Iona Vesh')
    assert.equal(namedFlow.draft.characterType, 'NPC')
    assert.equal(namedFlow.draft.characterId, asCharacterId('iona-vesh-2'))
  })

  it('updates draft fields without mutating the original draft', () => {
    const draft = createInitialCharacterDraft(characterId, {
      skills: ['Pilot-1']
    })
    const updated = updateCharacterCreationDraft(draft, {
      name: '  Iona Vesh  ',
      characteristics: { str: 7, dex: 8 },
      skills: ['Pilot-1', 'pilot-1', ' Vacc Suit-0 ', ''],
      equipment: [
        { name: ' Vacc Suit ', quantity: 1, notes: ' Carried ' },
        { name: '', quantity: 2, notes: 'ignored' },
        { name: 'Medkit', quantity: 0, notes: '' }
      ]
    })

    assert.equal(draft.name, '')
    assert.deepEqual(draft.characteristics, {
      str: null,
      dex: null,
      end: null,
      int: null,
      edu: null,
      soc: null
    })
    assert.deepEqual(draft.homeworld, {
      lawLevel: null,
      tradeCodes: []
    })
    assert.equal(updated.name, '  Iona Vesh  ')
    assert.deepEqual(updated.characteristics, {
      str: 7,
      dex: 8,
      end: null,
      int: null,
      edu: null,
      soc: null
    })
    assert.deepEqual(updated.homeworld, {
      lawLevel: null,
      tradeCodes: []
    })
    assert.equal(updated.careerPlan, null)
    assert.deepEqual(updated.skills, ['Pilot-1', 'Vacc Suit-0'])
    assert.deepEqual(updated.equipment, [
      { name: 'Vacc Suit', quantity: 1, notes: 'Carried' },
      { name: 'Medkit', quantity: 1, notes: '' }
    ])
  })

  it('applies and evaluates an SRD career plan without mutating the draft', () => {
    const draft = createInitialCharacterDraft(characterId, {
      characteristics: completeDraft().characteristics
    })
    const careerPlan = selectCharacterCreationCareerPlan('Merchant', {
      qualificationRoll: 6,
      survivalRoll: 5,
      commissionRoll: 4,
      advancementRoll: 8,
      drafted: true
    })

    const evaluated = evaluateCharacterCreationCareerPlan(draft, careerPlan)
    assert.equal(evaluated.career, 'Merchant')
    assert.equal(evaluated.qualificationPassed, true)
    assert.equal(evaluated.survivalPassed, true)
    assert.equal(evaluated.canCommission, true)
    assert.equal(evaluated.canAdvance, false)
    assert.equal(evaluated.commissionPassed, true)
    assert.equal(evaluated.advancementPassed, true)
    assert.equal(evaluated.rank, 1)
    assert.equal(evaluated.rankTitle, 'Deck Cadet')
    assert.equal(evaluated.rankBonusSkill, null)
    assert.equal(evaluated.drafted, true)
    assert.equal(draft.careerPlan, null)

    const updated = applyCharacterCreationCareerPlan(draft, careerPlan)
    assert.deepEqual(updated.careerPlan, evaluated)
    assert.equal(draft.careerPlan, null)
  })

  it('keeps a failed-qualification Drifter fallback ready for survival', () => {
    const draft = createInitialCharacterDraft(characterId, {
      characteristics: completeDraft().characteristics
    })
    const drifterPlan = selectCharacterCreationCareerPlan('Drifter', {
      qualificationRoll: null,
      qualificationPassed: true,
      drafted: false
    })
    const flow = {
      step: 'career' as const,
      draft: applyCharacterCreationCareerPlan(draft, drifterPlan)
    }

    assert.equal(flow.draft.careerPlan?.career, 'Drifter')
    assert.equal(flow.draft.careerPlan?.qualificationPassed, true)
    assert.equal(
      deriveNextCharacterCreationCareerRoll(flow)?.key,
      'survivalRoll'
    )
    assert.deepEqual(validateCurrentCharacterCreationStep(flow).errors, [
      'Career term rolls are incomplete'
    ])
  })

  it('walks characteristic rolls one stat at a time from server dice totals', () => {
    let flow = createCharacterCreationFlow(characterId, {
      name: 'Iona Vesh'
    })
    flow = { ...flow, step: 'characteristics' }

    assert.deepEqual(deriveNextCharacterCreationCharacteristicRoll(flow), {
      key: 'str',
      label: 'Roll Str',
      reason: 'Iona Vesh Str'
    })

    const result = applyCharacterCreationCharacteristicRoll(flow, 8)
    flow = result.flow
    assert.equal(result.moved, false)
    assert.equal(flow.draft.characteristics.str, 8)
    assert.deepEqual(deriveNextCharacterCreationCharacteristicRoll(flow), {
      key: 'dex',
      label: 'Roll Dex',
      reason: 'Iona Vesh Dex'
    })

    for (const roll of [7, 6, 9, 10, 5]) {
      flow = applyCharacterCreationCharacteristicRoll(flow, roll).flow
    }

    assert.deepEqual(flow.draft.characteristics, {
      str: 8,
      dex: 7,
      end: 6,
      int: 9,
      edu: 10,
      soc: 5
    })
    assert.equal(deriveNextCharacterCreationCharacteristicRoll(flow), null)
  })

  it('can apply characteristic rolls in any selected order', () => {
    let flow = createCharacterCreationFlow(characterId, {
      name: 'Iona Vesh'
    })
    flow = { ...flow, step: 'characteristics' }

    flow = applyCharacterCreationCharacteristicRoll(flow, 10, 'edu').flow
    flow = applyCharacterCreationCharacteristicRoll(flow, 9, 'int').flow
    flow = applyCharacterCreationCharacteristicRoll(flow, 7, 'str').flow

    assert.equal(flow.draft.characteristics.edu, 10)
    assert.equal(flow.draft.characteristics.int, 9)
    assert.equal(flow.draft.characteristics.str, 7)
    assert.equal(flow.draft.characteristics.dex, null)
  })

  it('uses homeworld background before career and derives background skills', () => {
    const characteristicsFlow = {
      step: 'characteristics' as const,
      draft: createInitialCharacterDraft(characterId, {
        name: 'Iona Vesh',
        characteristics: completeDraft().characteristics
      })
    }

    const homeworldStep = nextCharacterCreationWizardStep(characteristicsFlow)
    assert.equal(homeworldStep.moved, true)
    assert.equal(homeworldStep.flow.step, 'homeworld')
    assert.deepEqual(homeworldStep.validation, {
      ok: false,
      step: 'homeworld',
      errors: [
        'Homeworld law level is required',
        'Homeworld trade code is required'
      ]
    })
    assert.equal(
      advanceCharacterCreationStep(homeworldStep.flow).step,
      'homeworld'
    )

    const selectedHomeworld = updateCharacterCreationFields(
      homeworldStep.flow,
      {
        homeworld: {
          lawLevel: ' No Law ',
          tradeCodes: [' Asteroid ', 'Asteroid', ' Industrial ']
        }
      }
    )

    assert.deepEqual(selectedHomeworld.draft.homeworld, {
      lawLevel: 'No Law',
      tradeCodes: ['Asteroid', 'Industrial']
    })
    assert.deepEqual(
      deriveCharacterCreationBackgroundSkillPlan(selectedHomeworld.draft),
      {
        backgroundSkills: ['Zero-G-0', 'Broker-0'],
        pendingCascadeSkills: ['Gun Combat-0']
      }
    )
    assert.deepEqual(selectedHomeworld.draft.backgroundSkills, [
      'Zero-G-0',
      'Broker-0'
    ])
    assert.deepEqual(selectedHomeworld.draft.pendingCascadeSkills, [
      'Gun Combat-0'
    ])

    const careerStep = nextCharacterCreationWizardStep(selectedHomeworld)
    assert.equal(careerStep.moved, false)
    assert.equal(careerStep.flow.step, 'homeworld')
    assert.deepEqual(careerStep.validation, {
      ok: false,
      step: 'homeworld',
      errors: ['Pending background cascade skills must be resolved']
    })

    const resolvedHomeworld = {
      ...selectedHomeworld,
      draft: resolveCharacterCreationCascadeSkill({
        draft: selectedHomeworld.draft,
        cascadeSkill: 'Gun Combat-0',
        selection: 'Slug Rifle'
      })
    }

    assert.deepEqual(resolvedHomeworld.draft.backgroundSkills, [
      'Zero-G-0',
      'Broker-0',
      'Slug Rifle-0'
    ])
    assert.deepEqual(resolvedHomeworld.draft.pendingCascadeSkills, [])

    const resolvedCareerStep =
      nextCharacterCreationWizardStep(resolvedHomeworld)
    assert.equal(resolvedCareerStep.moved, true)
    assert.equal(resolvedCareerStep.flow.step, 'career')
    assert.deepEqual(resolvedCareerStep.validation, {
      ok: false,
      step: 'career',
      errors: ['Career is required']
    })
  })

  it('requires primary education background selections before career', () => {
    const flow = {
      step: 'homeworld' as const,
      draft: createInitialCharacterDraft(characterId, {
        name: 'Iona Vesh',
        characteristics: completeDraft().characteristics,
        homeworld: {
          lawLevel: 'No Law',
          tradeCodes: ['Asteroid']
        }
      })
    }

    assert.deepEqual(flow.draft.backgroundSkills, ['Zero-G-0'])
    assert.deepEqual(flow.draft.pendingCascadeSkills, ['Gun Combat-0'])
    assert.deepEqual(validateCurrentCharacterCreationStep(flow), {
      ok: false,
      step: 'homeworld',
      errors: [
        'Pending background cascade skills must be resolved',
        'Required background skill selections are incomplete'
      ]
    })

    const selectedDraft = applyCharacterCreationBackgroundSkillSelection(
      flow.draft,
      ' Admin '
    )
    assert.deepEqual(selectedDraft.backgroundSkills, ['Zero-G-0', 'Admin-0'])
    assert.deepEqual(selectedDraft.pendingCascadeSkills, ['Gun Combat-0'])

    const removedDraft = removeCharacterCreationBackgroundSkillSelection(
      selectedDraft,
      'Admin'
    )
    assert.deepEqual(removedDraft.backgroundSkills, ['Zero-G-0'])
    assert.deepEqual(removedDraft.pendingCascadeSkills, ['Gun Combat-0'])

    const resolvedDraft = resolveCharacterCreationCascadeSkill({
      draft: selectedDraft,
      cascadeSkill: 'Gun Combat-0',
      selection: 'Slug Rifle'
    })
    assert.deepEqual(resolvedDraft.backgroundSkills, [
      'Zero-G-0',
      'Admin-0',
      'Slug Rifle-0'
    ])
    assert.deepEqual(resolvedDraft.pendingCascadeSkills, [])

    const careerStep = nextCharacterCreationWizardStep({
      ...flow,
      draft: resolvedDraft
    })
    assert.equal(careerStep.moved, true)
    assert.equal(careerStep.flow.step, 'career')
    assert.deepEqual(careerStep.validation, {
      ok: false,
      step: 'career',
      errors: ['Career is required']
    })
  })

  it('preserves resolved background cascade skills when unchanged form values sync', () => {
    let draft = createInitialCharacterDraft(characterId, {
      name: 'Iona Vesh',
      characteristics: completeDraft().characteristics,
      homeworld: {
        lawLevel: 'No Law',
        tradeCodes: ['Asteroid']
      }
    })

    draft = resolveCharacterCreationCascadeSkill({
      draft,
      cascadeSkill: 'Gun Combat-0',
      selection: 'Slug Rifle'
    })
    draft = applyCharacterCreationBackgroundSkillSelection(draft, 'Admin')

    const synced = updateCharacterCreationDraft(draft, {
      characteristics: completeDraft().characteristics,
      homeworld: {
        lawLevel: 'No Law',
        tradeCodes: ['Asteroid']
      }
    })

    assert.deepEqual(synced.backgroundSkills, [
      'Zero-G-0',
      'Slug Rifle-0',
      'Admin-0'
    ])
    assert.deepEqual(synced.pendingCascadeSkills, [])
  })

  it('applies first-term basic training from the selected career service skills', () => {
    let flow = createCharacterCreationFlow(characterId, {
      name: 'Iona Vesh',
      characteristics: completeDraft().characteristics,
      careerPlan: selectCharacterCreationCareerPlan('Scout', {
        qualificationRoll: 8,
        qualificationPassed: true,
        survivalRoll: 7,
        survivalPassed: true
      })
    })
    flow = { ...flow, step: 'skills' }

    const action = deriveCharacterCreationBasicTrainingAction(flow)
    assert.equal(action?.label, 'Apply basic training')
    assert.equal(
      action?.reason,
      'First Scout term grants service skills at level 0'
    )
    assert.deepEqual(action?.skills, [
      'Comms-0',
      'Electronics-0',
      'Gun Combat-0',
      'Gunnery-0',
      'Recon-0',
      'Piloting-0'
    ])

    const result = applyCharacterCreationBasicTraining(flow)
    assert.equal(result.moved, false)
    assert.deepEqual(result.flow.draft.skills, action?.skills)
    assert.equal(deriveCharacterCreationBasicTrainingAction(result.flow), null)
  })

  it('walks SRD career checks with server dice roll totals', () => {
    let flow = createCharacterCreationFlow(characterId, {
      name: 'Iona Vesh',
      characteristics: completeDraft().characteristics,
      careerPlan: selectCharacterCreationCareerPlan('Merchant')
    })
    flow = { ...flow, step: 'career' }

    assert.deepEqual(deriveNextCharacterCreationCareerRoll(flow), {
      key: 'qualificationRoll',
      label: 'Roll qualification',
      reason: 'Iona Vesh Merchant qualification'
    })

    let result = applyCharacterCreationCareerRoll(flow, 7)
    flow = result.flow
    assert.equal(result.moved, false)
    assert.equal(flow.draft.careerPlan?.qualificationRoll, 7)
    assert.equal(flow.draft.careerPlan?.qualificationPassed, true)
    assert.deepEqual(deriveNextCharacterCreationCareerRoll(flow), {
      key: 'survivalRoll',
      label: 'Roll survival',
      reason: 'Iona Vesh Merchant survival'
    })

    result = applyCharacterCreationCareerRoll(flow, 8)
    flow = result.flow
    assert.equal(flow.draft.careerPlan?.survivalRoll, 8)
    assert.equal(flow.draft.careerPlan?.survivalPassed, true)
    assert.equal(flow.draft.careerPlan?.canCommission, true)
    assert.deepEqual(deriveNextCharacterCreationCareerRoll(flow), {
      key: 'commissionRoll',
      label: 'Roll commission',
      reason: 'Iona Vesh Merchant commission'
    })

    result = applyCharacterCreationCareerRoll(flow, 4)
    flow = result.flow
    assert.equal(flow.draft.careerPlan?.commissionRoll, 4)
    assert.equal(flow.draft.careerPlan?.commissionPassed, true)
    assert.equal(flow.draft.careerPlan?.rank, 1)
    assert.equal(flow.draft.careerPlan?.rankTitle, 'Deck Cadet')
    assert.equal(deriveNextCharacterCreationCareerRoll(flow), null)
    assert.equal(remainingCharacterCreationTermSkillRolls(flow.draft), 1)
    assert.deepEqual(
      deriveCharacterCreationTermSkillTableActions(flow).map(
        ({ table, label, disabled }) => ({ table, label, disabled })
      ),
      [
        {
          table: 'personalDevelopment',
          label: 'Personal development',
          disabled: false
        },
        { table: 'serviceSkills', label: 'Service skills', disabled: false },
        {
          table: 'specialistSkills',
          label: 'Specialist skills',
          disabled: false
        },
        {
          table: 'advancedEducation',
          label: 'Advanced education',
          disabled: false
        }
      ]
    )

    result = applyCharacterCreationTermSkillRoll({
      flow,
      table: 'serviceSkills',
      roll: 1
    })
    flow = result.flow
    assert.equal(remainingCharacterCreationTermSkillRolls(flow.draft), 0)
    assert.deepEqual(flow.draft.careerPlan?.termSkillRolls, [
      { table: 'serviceSkills', roll: 1, skill: 'Comms' }
    ])
    assert.deepEqual(flow.draft.skills, [
      'Comms-1',
      'Engineering-0',
      'Gun Combat-0',
      'Melee Combat-0',
      'Broker-0',
      'Vehicle-0'
    ])
  })

  it('applies advancement rank titles and rank bonus skills', () => {
    const priorTerm = {
      career: 'Merchant',
      drafted: false,
      age: 22,
      rank: 2,
      qualificationRoll: 7,
      survivalRoll: 8,
      survivalPassed: true,
      canCommission: true,
      commissionRoll: 8,
      commissionPassed: true,
      canAdvance: false,
      advancementRoll: null,
      advancementPassed: null,
      termSkillRolls: [
        { table: 'serviceSkills' as const, roll: 1, skill: 'Comms' }
      ],
      reenlistmentRoll: 7,
      reenlistmentOutcome: 'allowed' as const
    }
    let flow: CharacterCreationFlow = {
      step: 'career',
      draft: createInitialCharacterDraft(characterId, {
        name: 'Iona Vesh',
        characteristics: completeDraft().characteristics,
        completedTerms: [priorTerm],
        careerPlan: selectCharacterCreationCareerPlan('Merchant', {
          qualificationRoll: 12,
          qualificationPassed: true,
          survivalRoll: 8,
          survivalPassed: true,
          canCommission: false,
          canAdvance: true
        })
      })
    }

    assert.deepEqual(deriveNextCharacterCreationCareerRoll(flow), {
      key: 'advancementRoll',
      label: 'Roll advancement',
      reason: 'Iona Vesh Merchant advancement'
    })

    flow = applyCharacterCreationCareerRoll(flow, 8).flow

    assert.equal(flow.draft.careerPlan?.advancementPassed, true)
    assert.equal(flow.draft.careerPlan?.rank, 3)
    assert.equal(flow.draft.careerPlan?.rankTitle, 'Third Officer')
    assert.equal(flow.draft.careerPlan?.rankBonusSkill, 'Piloting')
    assert.deepEqual(flow.draft.skills, ['Piloting-1'])
  })

  it('lets optional commission and advancement rolls be skipped', () => {
    let flow: CharacterCreationFlow = {
      step: 'career',
      draft: createInitialCharacterDraft(characterId, {
        name: 'Iona Vesh',
        characteristics: completeDraft().characteristics,
        careerPlan: selectCharacterCreationCareerPlan('Merchant', {
          qualificationRoll: 7,
          qualificationPassed: true,
          survivalRoll: 8,
          survivalPassed: true,
          canCommission: true
        })
      })
    }

    flow = skipCharacterCreationCareerRoll(flow).flow

    assert.equal(flow.draft.careerPlan?.commissionRoll, -1)
    assert.equal(flow.draft.careerPlan?.commissionPassed, false)
    assert.equal(deriveNextCharacterCreationCareerRoll(flow), null)
    assert.equal(remainingCharacterCreationTermSkillRolls(flow.draft), 1)

    flow = {
      step: 'career',
      draft: createInitialCharacterDraft(characterId, {
        name: 'Iona Vesh',
        characteristics: completeDraft().characteristics,
        completedTerms: [
          {
            career: 'Merchant',
            drafted: false,
            age: 22,
            rank: 1,
            qualificationRoll: 7,
            survivalRoll: 8,
            survivalPassed: true,
            canCommission: true,
            commissionRoll: 8,
            commissionPassed: true,
            canAdvance: false,
            advancementRoll: null,
            advancementPassed: null,
            termSkillRolls: [
              { table: 'serviceSkills' as const, roll: 1, skill: 'Comms' }
            ],
            reenlistmentRoll: 7,
            reenlistmentOutcome: 'allowed'
          }
        ],
        careerPlan: selectCharacterCreationCareerPlan('Merchant', {
          qualificationRoll: 12,
          qualificationPassed: true,
          survivalRoll: 8,
          survivalPassed: true,
          canCommission: false,
          canAdvance: true
        })
      })
    }

    flow = skipCharacterCreationCareerRoll(flow).flow

    assert.equal(flow.draft.careerPlan?.advancementRoll, -1)
    assert.equal(flow.draft.careerPlan?.advancementPassed, false)
    assert.equal(deriveNextCharacterCreationCareerRoll(flow), null)
  })

  it('applies personal development rolls as characteristic gains', () => {
    const originalStr = completeDraft().characteristics.str ?? 0
    let flow: CharacterCreationFlow = {
      step: 'career' as const,
      draft: applyCharacterCreationCareerPlan(
        createInitialCharacterDraft(characterId, {
          name: 'Iona Vesh',
          characteristics: completeDraft().characteristics,
          careerPlan: selectCharacterCreationCareerPlan('Merchant')
        }),
        {
          ...selectCharacterCreationCareerPlan('Merchant'),
          qualificationRoll: 8,
          qualificationPassed: true,
          survivalRoll: 8,
          survivalPassed: true,
          canCommission: true,
          commissionRoll: 8,
          commissionPassed: true,
          canAdvance: false,
          advancementRoll: null,
          advancementPassed: null
        }
      )
    }

    flow = applyCharacterCreationTermSkillRoll({
      flow,
      table: 'personalDevelopment',
      roll: 1
    }).flow

    assert.equal(flow.draft.characteristics.str, originalStr + 1)
    assert.equal(remainingCharacterCreationTermSkillRolls(flow.draft), 0)
    assert.deepEqual(flow.draft.careerPlan?.termSkillRolls, [
      { table: 'personalDevelopment', roll: 1, skill: '+1 Str' }
    ])
    assert.deepEqual(flow.draft.skills, [
      'Comms-0',
      'Engineering-0',
      'Gun Combat-0',
      'Melee Combat-0',
      'Broker-0',
      'Vehicle-0'
    ])
  })

  it('requires rolled career cascade skills to be resolved before term completion', () => {
    let flow: CharacterCreationFlow = {
      step: 'career',
      draft: applyCharacterCreationCareerPlan(
        createInitialCharacterDraft(characterId, {
          name: 'Iona Vesh',
          characteristics: completeDraft().characteristics,
          careerPlan: selectCharacterCreationCareerPlan('Merchant')
        }),
        {
          ...selectCharacterCreationCareerPlan('Merchant'),
          qualificationRoll: 8,
          qualificationPassed: true,
          survivalRoll: 8,
          survivalPassed: true,
          canCommission: true,
          commissionRoll: 8,
          commissionPassed: true,
          canAdvance: false,
          advancementRoll: null,
          advancementPassed: null
        }
      )
    }

    flow = applyCharacterCreationTermSkillRoll({
      flow,
      table: 'serviceSkills',
      roll: 3
    }).flow

    assert.deepEqual(flow.draft.pendingTermCascadeSkills, ['Gun Combat-1'])
    assert.equal(deriveCharacterCreationTermSkillTableActions(flow).length, 0)
    assert.deepEqual(validateCurrentCharacterCreationStep(flow).errors, [
      'Career term must be completed',
      'Pending career cascade skills must be resolved'
    ])
    assert.deepEqual(flow.draft.skills, [
      'Comms-0',
      'Engineering-0',
      'Gun Combat-0',
      'Melee Combat-0',
      'Broker-0',
      'Vehicle-0'
    ])

    flow = resolveCharacterCreationTermCascadeSkill({
      flow,
      cascadeSkill: 'Gun Combat-1',
      selection: 'Slug Rifle'
    }).flow

    assert.deepEqual(flow.draft.pendingTermCascadeSkills, [])
    assert.deepEqual(flow.draft.skills, [
      'Comms-0',
      'Engineering-0',
      'Gun Combat-0',
      'Melee Combat-0',
      'Broker-0',
      'Vehicle-0',
      'Slug Rifle-1'
    ])

    assert.equal(deriveNextCharacterCreationReenlistmentRoll(flow), null)
    flow = applyCharacterCreationAnagathicsDecision({
      flow,
      useAnagathics: false
    }).flow
    assert.deepEqual(deriveNextCharacterCreationAgingRoll(flow), {
      label: 'Roll aging',
      reason: 'Iona Vesh aging',
      modifier: -1
    })
    flow = applyCharacterCreationAgingRoll(flow, 7).flow
    assert.deepEqual(deriveNextCharacterCreationReenlistmentRoll(flow), {
      label: 'Roll reenlistment',
      reason: 'Iona Vesh Merchant reenlistment'
    })
    flow = applyCharacterCreationReenlistmentRoll(flow, 7).flow
    assert.equal(flow.draft.careerPlan?.reenlistmentOutcome, 'allowed')

    const completed = completeCharacterCreationCareerTerm({
      flow,
      continueCareer: false
    })
    assert.equal(completed.moved, true)
    assert.equal(completed.flow.draft.completedTerms.length, 1)
  })

  it('applies reenlistment outcomes before a term can be closed', () => {
    let flow: CharacterCreationFlow = {
      step: 'career',
      draft: applyCharacterCreationCareerPlan(
        createInitialCharacterDraft(characterId, {
          name: 'Iona Vesh',
          characteristics: completeDraft().characteristics,
          careerPlan: selectCharacterCreationCareerPlan('Merchant')
        }),
        {
          ...selectCharacterCreationCareerPlan('Merchant'),
          qualificationRoll: 8,
          qualificationPassed: true,
          survivalRoll: 8,
          survivalPassed: true,
          canCommission: true,
          commissionRoll: 8,
          commissionPassed: true,
          canAdvance: false,
          advancementRoll: null,
          advancementPassed: null,
          termSkillRolls: [{ table: 'serviceSkills', roll: 1, skill: 'Comms' }]
        }
      )
    }

    assert.deepEqual(deriveCharacterCreationAnagathicsDecision(flow), {
      label: 'Decide anagathics',
      reason: 'Iona Vesh Merchant anagathics'
    })
    assert.equal(deriveNextCharacterCreationReenlistmentRoll(flow), null)
    assert.deepEqual(validateCurrentCharacterCreationStep(flow).errors, [
      'Career term must be completed',
      'Anagathics decision is incomplete'
    ])

    flow = applyCharacterCreationAnagathicsDecision({
      flow,
      useAnagathics: false
    }).flow
    assert.equal(flow.draft.careerPlan?.anagathics, false)
    assert.deepEqual(deriveNextCharacterCreationAgingRoll(flow), {
      label: 'Roll aging',
      reason: 'Iona Vesh aging',
      modifier: -1
    })
    flow = applyCharacterCreationAgingRoll(flow, 7).flow
    assert.deepEqual(deriveNextCharacterCreationReenlistmentRoll(flow), {
      label: 'Roll reenlistment',
      reason: 'Iona Vesh Merchant reenlistment'
    })
    assert.deepEqual(validateCurrentCharacterCreationStep(flow).errors, [
      'Career term must be completed',
      'Reenlistment roll is incomplete'
    ])

    flow = applyCharacterCreationReenlistmentRoll(flow, 12).flow
    assert.equal(flow.draft.careerPlan?.reenlistmentOutcome, 'forced')
    assert.equal(
      completeCharacterCreationCareerTerm({ flow, continueCareer: true }).flow
        .step,
      'career'
    )

    const forcedPlan = flow.draft.careerPlan
    if (!forcedPlan) throw new Error('Expected career plan')
    flow = applyCharacterCreationReenlistmentRoll(
      {
        ...flow,
        draft: {
          ...flow.draft,
          careerPlan: {
            ...forcedPlan,
            reenlistmentRoll: null,
            reenlistmentOutcome: null
          }
        }
      },
      3
    ).flow
    assert.equal(flow.draft.careerPlan?.reenlistmentOutcome, 'blocked')
    assert.equal(
      completeCharacterCreationCareerTerm({ flow, continueCareer: true }).flow
        .step,
      'skills'
    )
  })

  it('requires aging rolls and characteristic choices before reenlistment', () => {
    const completedTerm = {
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
      termSkillRolls: [
        { table: 'serviceSkills' as const, roll: 1, skill: 'Comms' }
      ],
      reenlistmentRoll: 7,
      reenlistmentOutcome: 'allowed' as const
    }
    let flow: CharacterCreationFlow = {
      step: 'career',
      draft: applyCharacterCreationCareerPlan(
        createInitialCharacterDraft(characterId, {
          name: 'Iona Vesh',
          age: 30,
          characteristics: completeDraft().characteristics,
          completedTerms: [
            completedTerm,
            { ...completedTerm, anagathics: true, age: 26 },
            { ...completedTerm, age: 30 }
          ],
          careerPlan: selectCharacterCreationCareerPlan('Merchant')
        }),
        {
          ...selectCharacterCreationCareerPlan('Merchant'),
          qualificationRoll: 8,
          qualificationPassed: true,
          survivalRoll: 8,
          survivalPassed: true,
          canCommission: true,
          commissionRoll: 8,
          commissionPassed: true,
          canAdvance: false,
          advancementRoll: null,
          advancementPassed: null,
          termSkillRolls: [{ table: 'serviceSkills', roll: 1, skill: 'Comms' }]
        }
      )
    }

    assert.deepEqual(deriveCharacterCreationAnagathicsDecision(flow), {
      label: 'Decide anagathics',
      reason: 'Iona Vesh Merchant anagathics'
    })
    assert.equal(deriveNextCharacterCreationAgingRoll(flow), null)
    assert.equal(deriveNextCharacterCreationReenlistmentRoll(flow), null)
    assert.deepEqual(validateCurrentCharacterCreationStep(flow).errors, [
      'Career term must be completed',
      'Anagathics decision is incomplete'
    ])

    flow = applyCharacterCreationAnagathicsDecision({
      flow,
      useAnagathics: true
    }).flow

    assert.deepEqual(deriveNextCharacterCreationAgingRoll(flow), {
      label: 'Roll aging',
      reason: 'Iona Vesh aging',
      modifier: -2
    })
    assert.equal(deriveNextCharacterCreationReenlistmentRoll(flow), null)
    assert.deepEqual(validateCurrentCharacterCreationStep(flow).errors, [
      'Career term must be completed',
      'Aging roll is incomplete'
    ])

    flow = applyCharacterCreationAgingRoll(flow, -2).flow
    assert.equal(flow.draft.age, 34)
    assert.equal(flow.draft.pendingAgingChanges.length, 3)
    assert.deepEqual(deriveCharacterCreationAgingChangeOptions(flow)[0], {
      index: 0,
      type: 'PHYSICAL',
      modifier: -1,
      options: ['str', 'dex', 'end']
    })

    flow = applyCharacterCreationAgingChange({
      flow,
      index: 0,
      characteristic: 'str'
    }).flow
    assert.equal(flow.draft.characteristics.str, 6)
    assert.deepEqual(
      deriveCharacterCreationAgingChangeOptions(flow)[0].options,
      ['dex', 'end']
    )
  })

  it('stops career roll progression after failed qualification', () => {
    const flow = {
      step: 'career' as const,
      draft: createInitialCharacterDraft(characterId, {
        name: 'Iona Vesh',
        characteristics: completeDraft().characteristics,
        careerPlan: selectCharacterCreationCareerPlan('Merchant')
      })
    }

    const result = applyCharacterCreationCareerRoll(flow, 2)

    assert.equal(result.flow.draft.careerPlan?.qualificationRoll, 2)
    assert.equal(result.flow.draft.careerPlan?.qualificationPassed, false)
    assert.equal(deriveNextCharacterCreationCareerRoll(result.flow), null)
  })

  it('skips qualification and starts survival after entering the draft', () => {
    const draft = createInitialCharacterDraft(characterId, {
      name: 'Iona Vesh',
      characteristics: completeDraft().characteristics,
      careerPlan: selectCharacterCreationCareerPlan('Marine', {
        drafted: true
      })
    })
    const careerPlan = draft.careerPlan
    if (!careerPlan) throw new Error('Expected draft career plan')
    const flow = {
      step: 'career' as const,
      draft: applyCharacterCreationCareerPlan(draft, careerPlan)
    }

    assert.equal(flow.draft.careerPlan?.qualificationPassed, true)
    assert.deepEqual(deriveNextCharacterCreationCareerRoll(flow), {
      key: 'survivalRoll',
      label: 'Roll survival',
      reason: 'Iona Vesh Marine survival'
    })
  })

  it('does not complete a career term after failed survival', () => {
    const flow = {
      step: 'career' as const,
      draft: createInitialCharacterDraft(characterId, {
        name: 'Iona Vesh',
        age: 18,
        characteristics: completeDraft().characteristics,
        careerPlan: selectCharacterCreationCareerPlan('Scout', {
          qualificationRoll: 8,
          qualificationPassed: true,
          survivalRoll: 4,
          survivalPassed: false,
          canCommission: false,
          canAdvance: false
        })
      })
    }

    const result = completeCharacterCreationCareerTerm({
      flow,
      continueCareer: false
    })

    assert.equal(result.moved, false)
    assert.equal(result.flow.step, 'career')
    assert.equal(result.flow.draft.completedTerms.length, 0)
  })

  it('records a completed career term and starts another term in the same career', () => {
    const resolvedDraft = applyCharacterCreationCareerPlan(
      createInitialCharacterDraft(characterId, {
        name: 'Iona Vesh',
        age: 22,
        characteristics: completeDraft().characteristics
      }),
      selectCharacterCreationCareerPlan('Merchant', {
        qualificationRoll: 7,
        survivalRoll: 8,
        commissionRoll: 4,
        termSkillRolls: [{ table: 'serviceSkills', roll: 1, skill: 'Comms' }],
        agingRoll: 7,
        agingMessage: 'No aging effects.',
        reenlistmentRoll: 7,
        reenlistmentOutcome: 'allowed'
      })
    )
    const flow = {
      step: 'career' as const,
      draft: resolvedDraft
    }

    const result = completeCharacterCreationCareerTerm({
      flow,
      continueCareer: true
    })

    assert.equal(result.moved, false)
    assert.equal(result.flow.step, 'career')
    assert.equal(result.flow.draft.age, 22)
    assert.equal(result.flow.draft.completedTerms.length, 1)
    assert.deepEqual(result.flow.draft.completedTerms[0], {
      career: 'Merchant',
      drafted: false,
      age: 22,
      rank: 1,
      rankTitle: 'Deck Cadet',
      qualificationRoll: 7,
      survivalRoll: 8,
      survivalPassed: true,
      canCommission: true,
      commissionRoll: 4,
      commissionPassed: true,
      canAdvance: false,
      advancementRoll: null,
      advancementPassed: null,
      termSkillRolls: [{ table: 'serviceSkills', roll: 1, skill: 'Comms' }],
      agingRoll: 7,
      agingMessage: 'No aging effects.',
      agingSelections: [],
      reenlistmentRoll: 7,
      reenlistmentOutcome: 'allowed'
    })
    assert.equal(result.flow.draft.careerPlan?.career, 'Merchant')
    assert.equal(result.flow.draft.careerPlan?.drafted, false)
    assert.equal(result.flow.draft.careerPlan?.qualificationPassed, true)
    assert.deepEqual(deriveNextCharacterCreationCareerRoll(result.flow), {
      key: 'survivalRoll',
      label: 'Roll survival',
      reason: 'Iona Vesh Merchant survival'
    })
  })

  it('musters out completed terms into credits, equipment, and sheet history', () => {
    let flow: CharacterCreationFlow = {
      step: 'career' as const,
      draft: applyCharacterCreationCareerPlan(
        createInitialCharacterDraft(characterId, {
          name: 'Iona Vesh',
          age: 22,
          characteristics: completeDraft().characteristics,
          homeworld: completeDraft().homeworld,
          backgroundSkills: completeDraft().backgroundSkills,
          skills: ['Pilot-1']
        }),
        selectCharacterCreationCareerPlan('Merchant', {
          qualificationRoll: 7,
          survivalRoll: 8,
          commissionRoll: 4,
          termSkillRolls: [{ table: 'serviceSkills', roll: 1, skill: 'Comms' }],
          agingRoll: 7,
          agingMessage: 'No aging effects.',
          reenlistmentRoll: 5,
          reenlistmentOutcome: 'blocked'
        })
      )
    }

    flow = completeCharacterCreationCareerTerm({
      flow,
      continueCareer: false
    }).flow
    assert.equal(flow.step, 'skills')
    assert.equal(flow.draft.age, 22)
    assert.equal(remainingMusteringBenefits(flow.draft), 2)

    flow = { ...flow, step: 'equipment' }
    const benefitResult = applyCharacterCreationMusteringBenefit({
      flow,
      kind: 'material',
      roll: 3
    })

    assert.equal(benefitResult.moved, false)
    assert.equal(remainingMusteringBenefits(benefitResult.flow.draft), 1)
    assert.deepEqual(benefitResult.flow.draft.musteringBenefits, [
      {
        career: 'Merchant',
        kind: 'material',
        roll: 3,
        value: 'Weapon',
        credits: 0
      }
    ])
    assert.deepEqual(benefitResult.flow.draft.equipment, [
      {
        name: 'Weapon',
        quantity: 1,
        notes: 'Mustering out: Merchant'
      }
    ])

    const patch = deriveCharacterSheetPatch(benefitResult.flow.draft)
    assert.equal(
      patch.notes,
      [
        'Rules source: Cepheus Engine SRD.',
        'Term 1: Merchant, survived.',
        'Mustering out: Merchant material 3 -> Weapon.'
      ].join('\n')
    )
  })

  it('limits cash benefits and applies mustering-out roll modifiers', () => {
    const completedTerm = {
      career: 'Merchant',
      drafted: false,
      age: 22,
      rank: 5,
      qualificationRoll: 8,
      survivalRoll: 8,
      survivalPassed: true,
      canCommission: true,
      commissionRoll: 8,
      commissionPassed: true,
      canAdvance: false,
      advancementRoll: null,
      advancementPassed: null,
      termSkillRolls: [
        { table: 'serviceSkills' as const, roll: 1, skill: 'Comms' }
      ],
      reenlistmentRoll: 7,
      reenlistmentOutcome: 'allowed' as const
    }
    const flow: CharacterCreationFlow = {
      step: 'equipment',
      draft: createInitialCharacterDraft(characterId, {
        name: 'Iona Vesh',
        skills: ['Gambling-1'],
        completedTerms: Array.from({ length: 7 }, (_, index) => ({
          ...completedTerm,
          age: 22 + index * 4
        })),
        musteringBenefits: [
          {
            career: 'Scout',
            kind: 'cash',
            roll: 1,
            value: '1000',
            credits: 1000
          },
          {
            career: 'Merchant',
            kind: 'cash',
            roll: 2,
            value: '5000',
            credits: 5000
          },
          {
            career: 'Merchant',
            kind: 'cash',
            roll: 3,
            value: '10000',
            credits: 10000
          }
        ]
      })
    }

    assert.equal(remainingMusteringBenefits(flow.draft), 8)
    assert.equal(
      characterCreationMusteringBenefitRollModifier({
        draft: flow.draft,
        kind: 'cash'
      }),
      2
    )
    assert.equal(
      characterCreationMusteringBenefitRollModifier({
        draft: flow.draft,
        kind: 'material'
      }),
      1
    )
    assert.equal(
      canRollCharacterCreationMusteringBenefit({
        draft: flow.draft,
        kind: 'cash'
      }),
      false
    )
    assert.equal(
      canRollCharacterCreationMusteringBenefit({
        draft: flow.draft,
        kind: 'material'
      }),
      true
    )
  })

  it('ignores undefined patch fields from sparse form updates', () => {
    const draft = createInitialCharacterDraft(characterId, {
      name: 'Iona Vesh',
      age: 34,
      credits: 1200,
      notes: 'Detached scout.'
    })
    const updated = updateCharacterCreationDraft(draft, {
      age: undefined,
      credits: undefined,
      notes: undefined
    })

    assert.equal(updated.age, 34)
    assert.equal(updated.credits, 1200)
    assert.equal(updated.notes, 'Detached scout.')
  })

  it('blocks advancement until the current step is valid', () => {
    const emptyFlow = createCharacterCreationFlow(characterId)

    assert.deepEqual(validateCurrentCharacterCreationStep(emptyFlow), {
      ok: false,
      step: 'basics',
      errors: ['Name is required']
    })
    assert.equal(advanceCharacterCreationStep(emptyFlow).step, 'basics')

    const withName = updateCharacterCreationFields(emptyFlow, {
      name: 'Iona Vesh'
    })
    assert.equal(advanceCharacterCreationStep(withName).step, 'characteristics')
  })

  it('walks forward and back across the creation steps', () => {
    let flow = createCharacterCreationFlow(characterId, {
      name: 'Iona Vesh'
    })

    flow = advanceCharacterCreationStep(flow)
    assert.equal(flow.step, 'characteristics')
    flow = updateCharacterCreationFields(flow, {
      characteristics: completeDraft().characteristics
    })
    flow = advanceCharacterCreationStep(flow)
    assert.equal(flow.step, 'homeworld')
    flow = updateCharacterCreationFields(flow, {
      homeworld: completeDraft().homeworld
    })
    flow = {
      ...flow,
      draft: applyCharacterCreationBackgroundSkillSelection(flow.draft, 'Admin')
    }
    flow = {
      ...flow,
      draft: resolveCharacterCreationCascadeSkill({
        draft: flow.draft,
        cascadeSkill: 'Gun Combat-0',
        selection: 'Slug Rifle'
      })
    }
    flow = advanceCharacterCreationStep(flow)
    assert.equal(flow.step, 'career')
    flow = updateCharacterCreationFields(flow, {
      careerPlan: selectCharacterCreationCareerPlan('Scout')
    })
    flow = advanceCharacterCreationStep(flow)
    assert.equal(flow.step, 'skills')
    flow = updateCharacterCreationFields(flow, { skills: ['Pilot-1'] })
    flow = advanceCharacterCreationStep(flow)
    assert.equal(flow.step, 'equipment')
    flow = advanceCharacterCreationStep(flow)
    assert.equal(flow.step, 'review')
    assert.equal(advanceCharacterCreationStep(flow).step, 'review')
    assert.equal(backCharacterCreationStep(flow).step, 'equipment')
  })

  it('moves wizard steps with validation results', () => {
    const emptyFlow = createCharacterCreationFlow(characterId)
    const blocked = nextCharacterCreationWizardStep(emptyFlow)

    assert.equal(blocked.moved, false)
    assert.equal(blocked.flow.step, 'basics')
    assert.deepEqual(blocked.validation, {
      ok: false,
      step: 'basics',
      errors: ['Name is required']
    })

    const next = nextCharacterCreationWizardStep(
      updateCharacterCreationFields(emptyFlow, { name: 'Iona Vesh' })
    )
    assert.equal(next.moved, true)
    assert.equal(next.flow.step, 'characteristics')
    assert.deepEqual(next.validation, {
      ok: false,
      step: 'characteristics',
      errors: [
        'STR is required',
        'DEX is required',
        'END is required',
        'INT is required',
        'EDU is required',
        'SOC is required'
      ]
    })

    const back = backCharacterCreationWizardStep(next.flow)
    assert.equal(back.moved, true)
    assert.equal(back.flow.step, 'basics')
    assert.deepEqual(back.validation, {
      ok: true,
      step: 'basics',
      errors: []
    })
  })

  it('applies parsed draft patches with current-step validation', () => {
    const flow = createCharacterCreationFlow(characterId)
    const result = applyParsedCharacterCreationDraftPatch(flow, {
      name: 'Iona Vesh',
      age: 34,
      skills: ['Pilot-1', 'pilot-1', ' Vacc Suit-0 '],
      characteristics: { str: 7, dex: Number.NaN }
    })

    assert.equal(result.moved, false)
    assert.equal(result.flow.step, 'basics')
    assert.equal(result.flow.draft.name, 'Iona Vesh')
    assert.equal(result.flow.draft.age, 34)
    assert.deepEqual(result.flow.draft.skills, ['Pilot-1', 'Vacc Suit-0'])
    assert.deepEqual(result.validation, {
      ok: true,
      step: 'basics',
      errors: []
    })

    const characteristics = nextCharacterCreationWizardStep(result.flow)
    assert.deepEqual(characteristics.validation.errors, [
      'DEX must be a finite number',
      'END is required',
      'INT is required',
      'EDU is required',
      'SOC is required'
    ])
  })

  it('requires a career before the skills step can be reached', () => {
    const homeworldFlow = {
      step: 'homeworld' as const,
      draft: updateCharacterCreationDraft(completeDraft(), {
        careerPlan: null
      })
    }

    const careerStep = nextCharacterCreationWizardStep(homeworldFlow)
    assert.equal(careerStep.moved, true)
    assert.equal(careerStep.flow.step, 'career')
    assert.deepEqual(careerStep.validation, {
      ok: false,
      step: 'career',
      errors: ['Career is required']
    })
    assert.equal(advanceCharacterCreationStep(careerStep.flow).step, 'career')

    const skillsStep = nextCharacterCreationWizardStep(
      updateCharacterCreationFields(careerStep.flow, {
        careerPlan: selectCharacterCreationCareerPlan('Merchant')
      })
    )
    assert.equal(skillsStep.moved, true)
    assert.equal(skillsStep.flow.step, 'skills')
  })

  it('validates the review step against the whole draft', () => {
    const flow = {
      step: 'review' as const,
      draft: createInitialCharacterDraft(characterId, {
        name: 'Iona Vesh',
        credits: -1
      })
    }

    assert.deepEqual(validateCurrentCharacterCreationStep(flow), {
      ok: false,
      step: 'review',
      errors: [
        'STR is required',
        'DEX is required',
        'END is required',
        'INT is required',
        'EDU is required',
        'SOC is required',
        'Homeworld law level is required',
        'Homeworld trade code is required',
        'Career is required',
        'At least one skill is required',
        'Credits must be a non-negative number'
      ]
    })
  })

  it('derives sequenced create and sheet update commands from a valid draft', () => {
    const draft = completeDraft()

    const createCommand = deriveCreateCharacterCommand(draft, {
      identity,
      state
    })
    assert.equal(createCommand.type, 'CreateCharacter')
    assert.equal(createCommand.gameId, identity.gameId)
    assert.equal(createCommand.actorId, identity.actorId)
    assert.equal(createCommand.characterId, characterId)
    assert.equal(createCommand.characterType, 'PLAYER')
    assert.equal(createCommand.name, 'Iona Vesh')
    assert.equal(createCommand.expectedSeq, 12)

    const updateCommand = deriveUpdateCharacterSheetCommand(draft, {
      identity,
      state
    })
    assert.equal(updateCommand.type, 'UpdateCharacterSheet')
    assert.equal(updateCommand.characterId, characterId)
    assert.equal(updateCommand.expectedSeq, 12)
    assert.deepEqual(updateCommand.characteristics, draft.characteristics)
    assert.deepEqual(updateCommand.skills, [
      'Zero-G-0',
      'Gun Combat-0',
      'Admin-0',
      'Pilot-1',
      'Vacc Suit-0'
    ])
    assert.deepEqual(updateCommand.equipment, [
      { name: 'Vacc Suit', quantity: 1, notes: 'Carried' }
    ])

    const startCreationCommand = deriveStartCharacterCreationCommand(draft, {
      identity,
      state
    })
    assert.equal(startCreationCommand.type, 'StartCharacterCreation')
    assert.equal(startCreationCommand.characterId, characterId)
    assert.equal(startCreationCommand.expectedSeq, 12)

    const startTermCommand = deriveStartCharacterCareerTermCommand(draft, {
      identity,
      state
    })
    assert.equal(startTermCommand.type, 'StartCharacterCareerTerm')
    assert.equal(startTermCommand.characterId, characterId)
    assert.equal(startTermCommand.career, 'Merchant')
    assert.equal(startTermCommand.expectedSeq, 12)
  })

  it('derives event-backed creation lifecycle commands for sequential dispatch', () => {
    assert.deepEqual(
      deriveInitialCharacterCreationStateCommands(completeDraft(), {
        identity,
        state: null
      }),
      []
    )

    const commands = deriveInitialCharacterCreationStateCommands(
      completeDraft(),
      {
        identity,
        state
      }
    )

    assert.deepEqual(
      commands.map((command) => command.type),
      [
        'StartCharacterCreation',
        'AdvanceCharacterCreation',
        'SetCharacterCreationHomeworld',
        'SelectCharacterCreationBackgroundSkill',
        'ResolveCharacterCreationCascadeSkill',
        'CompleteCharacterCreationHomeworld',
        'StartCharacterCareerTerm',
        'AdvanceCharacterCreation'
      ]
    )
    assert.deepEqual(
      commands.map((command) => command.expectedSeq),
      Array.from({ length: commands.length }, () => undefined)
    )

    const events = commands
      .filter((command) => command.type === 'AdvanceCharacterCreation')
      .map((command) =>
        command.type === 'AdvanceCharacterCreation'
          ? command.creationEvent.type
          : null
    )
    assert.deepEqual(events, [
      'SET_CHARACTERISTICS',
      'SELECT_CAREER'
    ])

    const startTerm = commands.find(
      (command) => command.type === 'StartCharacterCareerTerm'
    )
    assert.equal(startTerm?.type, 'StartCharacterCareerTerm')
    if (startTerm?.type !== 'StartCharacterCareerTerm') return
    assert.equal(startTerm.career, 'Merchant')
  })

  it('derives a playable creation sequence from an evaluated career plan', () => {
    const draft = applyCharacterCreationCareerPlan(
      completeDraft(),
      selectCharacterCreationCareerPlan('Merchant', {
        survivalRoll: 5,
        drafted: true
      })
    )

    const commands = deriveInitialCharacterCreationStateCommands(draft, {
      identity,
      state
    })
    assert.deepEqual(
      commands.map((command) => command.type),
      [
        'StartCharacterCreation',
        'AdvanceCharacterCreation',
        'SetCharacterCreationHomeworld',
        'SelectCharacterCreationBackgroundSkill',
        'ResolveCharacterCreationCascadeSkill',
        'CompleteCharacterCreationHomeworld',
        'StartCharacterCareerTerm',
        'AdvanceCharacterCreation',
        'AdvanceCharacterCreation',
        'AdvanceCharacterCreation',
        'AdvanceCharacterCreation',
        'AdvanceCharacterCreation',
        'ResolveCharacterCreationAging',
        'AdvanceCharacterCreation',
        'AdvanceCharacterCreation',
        'CompleteCharacterCreation'
      ]
    )
    assert.deepEqual(
      commands.map((command) => command.expectedSeq),
      Array.from({ length: commands.length }, () => undefined)
    )

    const startTerm = commands.find(
      (command) => command.type === 'StartCharacterCareerTerm'
    )
    assert.equal(startTerm?.type, 'StartCharacterCareerTerm')
    if (startTerm?.type !== 'StartCharacterCareerTerm') return
    assert.equal(startTerm.career, 'Merchant')
    assert.equal(startTerm.drafted, true)

    const events = commands
      .filter((command) => command.type === 'AdvanceCharacterCreation')
      .map((command) =>
        command.type === 'AdvanceCharacterCreation'
          ? command.creationEvent
          : null
      )
    assert.deepEqual(events, [
      { type: 'SET_CHARACTERISTICS' },
      { type: 'SELECT_CAREER', isNewCareer: true, drafted: true },
      { type: 'COMPLETE_BASIC_TRAINING' },
      { type: 'SURVIVAL_PASSED', canCommission: true, canAdvance: false },
      { type: 'SKIP_COMMISSION' },
      { type: 'COMPLETE_SKILLS' },
      { type: 'LEAVE_CAREER' },
      { type: 'FINISH_MUSTERING' }
    ])
    assert.equal(
      commands.find((command) => command.type === 'ResolveCharacterCreationAging')
        ?.type,
      'ResolveCharacterCreationAging'
    )
  })

  it('derives a detached sheet patch copy', () => {
    const draft = completeDraft()
    const patch = deriveCharacterSheetPatch(draft)

    assert.deepEqual(patch, {
      age: 34,
      characteristics: {
        str: 7,
        dex: 8,
        end: 7,
        int: 9,
        edu: 8,
        soc: 6
      },
      skills: ['Zero-G-0', 'Gun Combat-0', 'Admin-0', 'Pilot-1', 'Vacc Suit-0'],
      equipment: [{ name: 'Vacc Suit', quantity: 1, notes: 'Carried' }],
      credits: 1200,
      notes: 'Detached scout.'
    })

    patch.skills?.push('Mechanic-0')
    assert.deepEqual(draft.skills, ['Pilot-1', 'Vacc Suit-0'])
  })

  it('derives both creation commands only when the full flow is valid', () => {
    const invalidCommands = deriveCharacterCreationCommands(
      createCharacterCreationFlow(characterId),
      { identity, state }
    )
    assert.deepEqual(invalidCommands, [])

    const unsequencedCommands = deriveCharacterCreationCommands(
      {
        step: 'review',
        draft: completeDraft()
      },
      { identity, state: null }
    )
    assert.deepEqual(unsequencedCommands, [])

    const commands = deriveCharacterCreationCommands(
      {
        step: 'review',
        draft: completeDraft()
      },
      { identity, state }
    )

    assert.deepEqual(
      commands.map((command) => command.type),
      [
        'CreateCharacter',
        'StartCharacterCreation',
        'AdvanceCharacterCreation',
        'SetCharacterCreationHomeworld',
        'SelectCharacterCreationBackgroundSkill',
        'ResolveCharacterCreationCascadeSkill',
        'CompleteCharacterCreationHomeworld',
        'StartCharacterCareerTerm',
        'AdvanceCharacterCreation',
        'UpdateCharacterSheet'
      ]
    )
    assert.deepEqual(
      commands.map((command) => command.expectedSeq),
      Array.from({ length: commands.length }, () => undefined)
    )

    const playableDraft = applyCharacterCreationCareerPlan(
      completeDraft(),
      selectCharacterCreationCareerPlan('Merchant', {
        survivalRoll: 5,
        commissionRoll: 4
      })
    )
    const playableCommands = deriveCharacterCreationCommands(
      {
        step: 'review',
        draft: playableDraft
      },
      { identity, state }
    )
    assert.equal(playableCommands.length, 18)
    assert.deepEqual(
      playableCommands
        .filter((command) => command.type === 'AdvanceCharacterCreation')
        .map((command) =>
          command.type === 'AdvanceCharacterCreation'
            ? command.creationEvent.type
            : null
        ),
      [
        'SET_CHARACTERISTICS',
        'SELECT_CAREER',
        'COMPLETE_BASIC_TRAINING',
        'SURVIVAL_PASSED',
        'COMPLETE_COMMISSION',
        'COMPLETE_SKILLS',
        'LEAVE_CAREER',
        'FINISH_MUSTERING'
      ]
    )
    assert.equal(
      playableCommands.find(
        (command) => command.type === 'CompleteCharacterCreation'
      )?.type,
      'CompleteCharacterCreation'
    )
    assert.equal(
      playableCommands.find(
        (command) => command.type === 'ResolveCharacterCreationAging'
      )?.type,
      'ResolveCharacterCreationAging'
    )
    assert.equal(playableCommands.at(-1)?.type, 'FinalizeCharacterCreation')
  })
})
