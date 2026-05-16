import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { CEPHEUS_SRD_RULESET } from '../../../../shared/character-creation/cepheus-srd-ruleset'
import { asCharacterId, asUserId } from '../../../../shared/ids'
import type {
  CharacterCreationProjection,
  CharacterState
} from '../../../../shared/state'
import {
  deriveCharacterExportViewModel,
  deriveCharacteristicExportLine,
  deriveCharacterUpp,
  derivePlainCharacterExport,
  formatUppCharacteristic,
  isCharacterCreationFinal,
  sortSkillsForExport
} from './export-view'

const character = (
  overrides: Partial<CharacterState> = {}
): CharacterState => ({
  id: asCharacterId('traveller-1'),
  ownerId: null,
  type: 'PLAYER',
  name: 'Iona Vesh',
  active: true,
  notes: 'Detached scout.',
  age: 34,
  characteristics: {
    str: 7,
    dex: 8,
    end: 9,
    int: 10,
    edu: 11,
    soc: 6
  },
  skills: ['Vacc Suit-0', 'Pilot-1', 'Broker-2'],
  equipment: [{ name: 'Vacc Suit', quantity: 1, notes: 'Carried' }],
  credits: 1200,
  creation: finalizedCreation(),
  ...overrides
})

const finalizedCreation = (): CharacterCreationProjection => ({
  state: {
    status: 'PLAYABLE',
    context: {
      canCommission: false,
      canAdvance: false
    }
  },
  terms: [
    {
      career: 'Scout',
      skills: ['Pilot-1'],
      skillsAndTraining: ['Vacc Suit-0'],
      benefits: ['Low Passage'],
      facts: {
        qualification: {
          career: 'Scout',
          passed: true,
          previousCareerCount: 0,
          failedQualificationOptions: [],
          qualification: {
            expression: '2d6',
            rolls: [4, 4],
            total: 8,
            characteristic: 'int',
            modifier: 1,
            target: 6,
            success: true
          }
        },
        survival: {
          passed: true,
          canCommission: false,
          canAdvance: true,
          survival: {
            expression: '2d6',
            rolls: [4, 3],
            total: 7,
            characteristic: 'end',
            modifier: 0,
            target: 7,
            success: true
          }
        },
        advancement: {
          skipped: false,
          passed: true,
          advancement: {
            expression: '2d6',
            rolls: [6, 4],
            total: 10,
            characteristic: 'edu',
            modifier: 1,
            target: 8,
            success: true
          },
          rank: {
            career: 'Scout',
            previousRank: 0,
            newRank: 1,
            title: 'Courier',
            bonusSkill: null
          }
        },
        aging: {
          roll: { expression: '2d6', rolls: [6, 5], total: 11 },
          modifier: 0,
          age: 34,
          characteristicChanges: []
        },
        anagathicsDecision: { useAnagathics: false, termIndex: 0 },
        reenlistment: {
          outcome: 'allowed',
          reenlistment: {
            expression: '2d6',
            rolls: [5, 5],
            total: 10,
            characteristic: null,
            modifier: 0,
            target: 6,
            success: true,
            outcome: 'allowed'
          }
        },
        musteringBenefits: [
          {
            career: 'Scout',
            kind: 'material',
            roll: { expression: '2d6', rolls: [1, 2], total: 3 },
            modifier: 1,
            tableRoll: 4,
            value: 'Low Passage',
            credits: 0,
            materialItem: 'Low Passage'
          }
        ]
      },
      complete: true,
      canReenlist: true,
      completedBasicTraining: false,
      musteringOut: false,
      anagathics: false
    }
  ],
  careers: [{ name: 'Scout', rank: 1 }],
  canEnterDraft: true,
  failedToQualify: false,
  characteristicChanges: [],
  creationComplete: true
})

describe('character sheet export view', () => {
  it('formats UPP characteristics with Traveller-style extended digits', () => {
    assert.equal(formatUppCharacteristic(9), '9')
    assert.equal(formatUppCharacteristic(10), 'A')
    assert.equal(formatUppCharacteristic(15), 'F')
    assert.equal(formatUppCharacteristic(null), '?')
    assert.equal(formatUppCharacteristic(-1), '?')
    assert.equal(
      deriveCharacterUpp({
        str: 7,
        dex: 8,
        end: 9,
        int: 10,
        edu: 11,
        soc: null
      }),
      '789AB?'
    )
  })

  it('formats characteristic and skill export helpers for table use', () => {
    assert.equal(
      deriveCharacteristicExportLine(character().characteristics),
      'Str 7, Dex 8, End 9 (+1), Int 10 (+1), Edu 11 (+1), Soc 6'
    )
    assert.deepEqual(sortSkillsForExport(['Pilot-1', 'Broker-2', 'Admin-0']), [
      'Broker-2',
      'Pilot-1',
      'Admin-0'
    ])
    assert.deepEqual(
      sortSkillsForExport([
        ' Vacc Suit-0 ',
        'Broker-2',
        'Pilot-1',
        'Broker-2',
        ''
      ]),
      ['Broker-2', 'Pilot-1', 'Vacc Suit-0']
    )
  })

  it('detects finalized creation from either complete flag or playable state', () => {
    assert.equal(isCharacterCreationFinal(character()), true)
    assert.equal(
      isCharacterCreationFinal(
        character({
          creation: {
            ...finalizedCreation(),
            creationComplete: false
          }
        })
      ),
      true
    )
    assert.equal(isCharacterCreationFinal(character({ creation: null })), false)
  })

  it('derives a plain text export block for finalized characters', () => {
    assert.deepEqual(deriveCharacterExportViewModel(character()), {
      title: 'Iona Vesh',
      upp: '789AB6',
      characteristics:
        'Str 7, Dex 8, End 9 (+1), Int 10 (+1), Edu 11 (+1), Soc 6',
      type: 'PLAYER',
      age: '34',
      homeworld: 'Unspecified',
      backgroundSkills: null,
      careers: 'Scout rank 1 (Courier)',
      terms: 1,
      skills: 'Broker-2, Pilot-1, Vacc Suit-0',
      credits: 'Cr1200',
      equipment: 'Vacc Suit x1 (Carried)',
      ledger: [],
      careerHistory: [
        'Term 1: Scout - qualification passed 8 vs 6 (Int DM +1); survival passed 7 vs 7 (End DM 0); advancement passed 10 vs 8 (Edu DM +1) to rank 1 (Courier); aging 11: no effect; no anagathics; reenlistment passed 10 vs 6 (DM 0): allowed; benefits Low Passage (Scout material benefit; roll 3; DM +1; table 4); term complete'
      ],
      notes: 'Detached scout.'
    })

    assert.equal(
      derivePlainCharacterExport(character()),
      [
        'Iona Vesh',
        'UPP: 789AB6',
        'Characteristics: Str 7, Dex 8, End 9 (+1), Int 10 (+1), Edu 11 (+1), Soc 6',
        'Type: PLAYER',
        'Age: 34',
        'Homeworld: Unspecified',
        'Careers: Scout rank 1 (Courier)',
        'Terms: 1',
        'Skills: Broker-2, Pilot-1, Vacc Suit-0',
        'Credits: Cr1200',
        'Equipment: Vacc Suit x1 (Carried)',
        'Career History:',
        '- Term 1: Scout - qualification passed 8 vs 6 (Int DM +1); survival passed 7 vs 7 (End DM 0); advancement passed 10 vs 8 (Edu DM +1) to rank 1 (Courier); aging 11: no effect; no anagathics; reenlistment passed 10 vs 6 (DM 0): allowed; benefits Low Passage (Scout material benefit; roll 3; DM +1; table 4); term complete',
        'Notes:',
        'Detached scout.'
      ].join('\n')
    )
  })

  it('includes credit ledger provenance in finalized exports', () => {
    const exportText =
      derivePlainCharacterExport(
        character({
          credits: 950,
          ledger: [
            {
              id: 'ledger-1',
              actorId: asUserId('referee'),
              createdAt: '2026-05-03T12:10:00.000Z',
              amount: -250,
              balance: 950,
              reason: 'Bought ammunition'
            }
          ]
        })
      ) ?? ''

    assert.equal(exportText.includes('Credit Ledger:'), true)
    assert.equal(
      exportText.includes(
        '- Cr-250 -> Cr950: Bought ammunition (2026-05-03, referee)'
      ),
      true
    )
  })

  it('includes projected anagathics cost in term history exports', () => {
    const creation = finalizedCreation()
    const term = creation.terms[0]
    term.anagathics = true
    term.anagathicsCost = 20000
    term.facts = {
      ...term.facts,
      anagathicsDecision: { useAnagathics: true, termIndex: 0 }
    }

    assert.equal(
      /used anagathics \(Cr20000\)/.test(
        derivePlainCharacterExport(character({ creation })) ?? ''
      ),
      true
    )
  })

  it('includes mishap injury provenance in term history exports', () => {
    const creation = finalizedCreation()
    creation.terms[0].facts = {
      ...creation.terms[0].facts,
      survival: {
        passed: false,
        canCommission: false,
        canAdvance: false,
        survival: {
          expression: '2d6',
          rolls: [1, 2],
          total: 3,
          characteristic: 'end',
          modifier: 0,
          target: 7,
          success: false
        }
      },
      mishap: {
        roll: { expression: '1d6', rolls: [1], total: 1 },
        outcome: {
          career: 'Scout',
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
      },
      injury: {
        severityRoll: { expression: '1d6', rolls: [4], total: 4 },
        outcome: {
          career: 'Scout',
          roll: 2,
          id: 'severely_injured',
          description:
            'Severely injured. Reduce one physical characteristic by 1D6.',
          crisisRisk: true
        },
        selectedLosses: [{ characteristic: 'str', modifier: -4 }],
        characteristicPatch: { str: 3 }
      }
    }

    const exportText = derivePlainCharacterExport(character({ creation })) ?? ''

    assert.equal(exportText.includes('mishap 1: Injured in action.'), true)
    assert.equal(
      exportText.includes(
        'injury table 2, severity 4: Severely injured. Reduce one physical characteristic by 1D6.; losses Str -4'
      ),
      true
    )
  })

  it('formats material characteristic gains in term history exports', () => {
    const creation = finalizedCreation()
    creation.terms[0].facts = {
      ...creation.terms[0].facts,
      musteringBenefits: [
        {
          career: 'Aerospace',
          kind: 'material',
          roll: { expression: '2d6', rolls: [4, 4], total: 8 },
          modifier: 0,
          tableRoll: 8,
          value: '+1 Soc',
          credits: 0,
          materialItem: null
        }
      ]
    }

    assert.equal(
      /benefits Soc \+1 \(Aerospace material benefit; roll 8; DM 0; table 8\)/.test(
        derivePlainCharacterExport(character({ creation })) ?? ''
      ),
      true
    )
  })

  it('includes homeworld background skill sources in finalized exports', () => {
    const creation = {
      ...finalizedCreation(),
      homeworld: {
        name: 'Homeworld',
        lawLevel: 'Low Law',
        tradeCodes: ['Asteroid']
      },
      backgroundSkills: ['Slug Pistol-0', 'Zero-G-0', 'Admin-0']
    }

    const exportText = derivePlainCharacterExport(character({ creation })) ?? ''

    assert.equal(
      exportText.includes(
        'Background Skills: Slug Pistol-0 (law Low Law), Zero-G-0 (trade Asteroid), Admin-0 (primary education)'
      ),
      true
    )
  })

  it('uses an injected ruleset for background skill export sources', () => {
    const ruleset = {
      ...CEPHEUS_SRD_RULESET,
      homeWorldSkillsByLawLevel: {
        Frontier: 'Discipline*'
      },
      homeWorldSkillsByTradeCode: {
        Research: 'Science'
      },
      cascadeSkills: {
        ...CEPHEUS_SRD_RULESET.cascadeSkills,
        Discipline: ['Focus', 'Resolve']
      }
    }
    const creation = {
      ...finalizedCreation(),
      homeworld: {
        name: 'Custom Homeworld',
        lawLevel: 'Frontier',
        tradeCodes: ['Research']
      },
      backgroundSkills: ['Focus-0', 'Science-0', 'Admin-0']
    }

    const exportText =
      derivePlainCharacterExport(character({ creation }), { ruleset }) ?? ''

    assert.equal(
      exportText.includes(
        'Background Skills: Focus-0 (law Frontier), Science-0 (trade Research), Admin-0 (primary education)'
      ),
      true
    )
  })

  it('omits ruleset-specific background sources when the ruleset is unresolved', () => {
    const creation = {
      ...finalizedCreation(),
      homeworld: {
        name: 'Custom Homeworld',
        lawLevel: 'Frontier',
        tradeCodes: ['Research']
      },
      backgroundSkills: ['Focus-0', 'Science-0', 'Admin-0']
    }

    const exportText =
      derivePlainCharacterExport(character({ creation }), {
        ruleset: null
      }) ?? ''

    assert.equal(exportText.includes('Background Skills:'), false)
  })

  it('includes career-entry penalties and draft table provenance', () => {
    const creation = finalizedCreation()
    const firstTerm = creation.terms[0]
    if (firstTerm.facts?.qualification) {
      firstTerm.facts.qualification.previousCareerCount = 2
    }
    creation.terms.push({
      career: 'Navy',
      draft: 1,
      skills: [],
      skillsAndTraining: [],
      benefits: [],
      facts: {
        draft: {
          roll: { expression: '1d6', rolls: [4], total: 4 },
          tableRoll: 4,
          acceptedCareer: 'Navy'
        }
      },
      complete: true,
      canReenlist: false,
      completedBasicTraining: false,
      musteringOut: false,
      anagathics: false
    })

    const exportText = derivePlainCharacterExport(character({ creation })) ?? ''

    assert.equal(exportText.includes('previous career DM -4'), true)
    assert.equal(
      exportText.includes('Term 2: Navy - drafted Navy from table 4 (roll 4)'),
      true
    )
  })

  it('includes basic training and term skill roll provenance', () => {
    const creation = finalizedCreation()
    creation.terms[0].facts = {
      ...creation.terms[0].facts,
      basicTrainingSkills: ['Comms-0'],
      termSkillRolls: [
        {
          career: 'Scout',
          table: 'serviceSkills',
          roll: { expression: '1d6', rolls: [3], total: 3 },
          tableRoll: 3,
          rawSkill: 'Piloting',
          skill: 'Piloting-1',
          characteristic: null,
          pendingCascadeSkill: null
        },
        {
          career: 'Scout',
          table: 'personalDevelopment',
          roll: { expression: '1d6', rolls: [1], total: 1 },
          tableRoll: 1,
          rawSkill: '+1 Str',
          skill: null,
          characteristic: { key: 'str', modifier: 1 },
          pendingCascadeSkill: null
        },
        {
          career: 'Scout',
          table: 'specialistSkills',
          roll: { expression: '1d6', rolls: [6], total: 6 },
          tableRoll: 6,
          rawSkill: 'Gun Combat*',
          skill: null,
          characteristic: null,
          pendingCascadeSkill: 'Slug Rifle'
        }
      ]
    }

    const exportText = derivePlainCharacterExport(character({ creation })) ?? ''

    assert.equal(exportText.includes('basic training Comms-0'), true)
    assert.equal(
      exportText.includes('term skills service skills roll 3: Piloting-1'),
      true
    )
    assert.equal(
      exportText.includes('personal development roll 1: Str +1'),
      true
    )
    assert.equal(
      exportText.includes(
        'specialist skills roll 6: Gun Combat* -> Slug Rifle'
      ),
      true
    )
  })

  it('prefers semantic term facts over conflicting legacy aggregates', () => {
    const creation = finalizedCreation()
    const term = creation.terms[0]
    creation.careers = [{ name: 'Scout', rank: 0 }]
    term.skills = ['Legacy Skill-6']
    term.skillsAndTraining = ['Legacy Training-5']
    term.benefits = ['Legacy Benefit']
    term.survival = 2
    term.advancement = 2
    term.reEnlistment = 2
    const advancement = term.facts?.advancement
    if (advancement && !advancement.skipped && advancement.rank) {
      advancement.rank.newRank = 2
      advancement.rank.title = 'Senior Scout'
    }
    term.facts = {
      ...term.facts,
      basicTrainingSkills: ['Comms-0'],
      termSkillRolls: [
        {
          career: 'Scout',
          table: 'serviceSkills',
          roll: { expression: '1d6', rolls: [3], total: 3 },
          tableRoll: 3,
          rawSkill: 'Piloting',
          skill: 'Piloting-1',
          characteristic: null,
          pendingCascadeSkill: null
        }
      ],
      musteringBenefits: [
        {
          career: 'Scout',
          kind: 'material',
          roll: { expression: '2d6', rolls: [2, 2], total: 4 },
          modifier: 0,
          tableRoll: 4,
          value: 'Blade',
          credits: 0,
          materialItem: 'Blade'
        }
      ]
    }

    const exportText = derivePlainCharacterExport(character({ creation })) ?? ''

    assert.equal(
      exportText.includes('Careers: Scout rank 2 (Senior Scout)'),
      true
    )
    assert.equal(exportText.includes('Careers: Scout rank 0'), false)
    assert.equal(exportText.includes('skills Piloting-1, Comms-0'), true)
    assert.equal(
      exportText.includes(
        'benefits Blade (Scout material benefit; roll 4; DM 0; table 4)'
      ),
      true
    )
    assert.equal(exportText.includes('Legacy Skill'), false)
    assert.equal(exportText.includes('Legacy Training'), false)
    assert.equal(exportText.includes('Legacy Benefit'), false)
    assert.equal(exportText.includes('survival 2'), false)
    assert.equal(exportText.includes('advancement 2'), false)
    assert.equal(exportText.includes('reenlistment 2'), false)
  })

  it('derives final career rank display from completed-term read-model facts before stale aggregates', () => {
    const creation = finalizedCreation()
    const term = creation.terms[0]
    creation.careers = [{ name: 'Scout', rank: 6 }]
    term.facts = {
      survival: term.facts?.survival,
      advancement: { skipped: true },
      termSkillRolls: []
    }

    const view = deriveCharacterExportViewModel(character({ creation }))

    assert.equal(view?.careers, 'Scout rank 0')
  })

  it('exports facts-only terms without legacy aggregates', () => {
    const creation = finalizedCreation()
    const term = creation.terms[0]
    term.skills = []
    term.skillsAndTraining = []
    term.benefits = []
    term.facts = {
      ...term.facts,
      basicTrainingSkills: ['Comms-0'],
      termSkillRolls: [
        {
          career: 'Scout',
          table: 'serviceSkills',
          roll: { expression: '1d6', rolls: [3], total: 3 },
          tableRoll: 3,
          rawSkill: 'Piloting',
          skill: 'Piloting-1',
          characteristic: null,
          pendingCascadeSkill: null
        }
      ],
      musteringBenefits: [
        {
          career: 'Scout',
          kind: 'material',
          roll: { expression: '2d6', rolls: [2, 2], total: 4 },
          modifier: 0,
          tableRoll: 4,
          value: 'Blade',
          credits: 0,
          materialItem: 'Blade'
        }
      ]
    }

    const history = deriveCharacterExportViewModel(character({ creation }))
      ?.careerHistory[0]

    assert.equal(history?.includes('skills Piloting-1, Comms-0'), true)
    assert.equal(history?.includes('basic training Comms-0'), true)
    assert.equal(
      history?.includes('term skills service skills roll 3: Piloting-1'),
      true
    )
    assert.equal(
      history?.includes(
        'benefits Blade (Scout material benefit; roll 4; DM 0; table 4)'
      ),
      true
    )
  })

  it('does not fall back to conflicting legacy skills when semantic facts have none', () => {
    const creation = finalizedCreation()
    const term = creation.terms[0]
    term.skills = ['Legacy Skill-6']
    term.skillsAndTraining = ['Legacy Training-5']
    term.benefits = ['Legacy Benefit']
    term.facts = {
      survival: term.facts?.survival,
      termSkillRolls: [],
      musteringBenefits: []
    }

    const history = deriveCharacterExportViewModel(character({ creation }))
      ?.careerHistory[0]

    assert.equal(
      history,
      'Term 1: Scout - survival passed 7 vs 7 (End DM 0); term complete'
    )
  })

  it('includes resolved cascade choices and aging loss provenance', () => {
    const creation = finalizedCreation()
    creation.terms[0].facts = {
      ...creation.terms[0].facts,
      termCascadeSelections: [
        { cascadeSkill: 'Gun Combat*', selection: 'Slug Rifle' }
      ],
      aging: {
        roll: { expression: '2d6', rolls: [1, 2], total: 3 },
        modifier: -1,
        age: 46,
        characteristicChanges: [{ type: 'PHYSICAL', modifier: -1 }]
      },
      agingLosses: {
        selectedLosses: [
          { type: 'PHYSICAL', modifier: -1, characteristic: 'str' }
        ],
        characteristicPatch: { str: 6 }
      }
    }

    const exportText = derivePlainCharacterExport(character({ creation })) ?? ''

    assert.equal(
      exportText.includes('cascade choices Gun Combat* -> Slug Rifle'),
      true
    )
    assert.equal(exportText.includes('aging 3: physical -1'), true)
    assert.equal(exportText.includes('aging losses Str -1 (physical)'), true)
  })

  it('omits export text before creation is finalized', () => {
    assert.equal(
      derivePlainCharacterExport(
        character({
          creation: {
            ...finalizedCreation(),
            state: {
              status: 'ACTIVE',
              context: {
                canCommission: false,
                canAdvance: false
              }
            },
            creationComplete: false
          }
        })
      ),
      null
    )
  })
})
