const gender = Object.freeze({FEMALE: 'Female', MALE: 'Male', OTHER: 'Other'})

// const
// creationStage = Object.freeze([
//   'Characteristics',
//   'Home World',
//   'Career',
//   'Basic Training',
//   'Survival',
//   'Commission and Advancement',
//   'Skills and Training',
//   'Aging',
//   'Re-enlistment',
//   'Benefits',
//   'Next Career',
//   'Buy Starting Equipment'
// ])

const nobleTitle = Object.freeze({
  10: {Title: {Male: 'Lord', Female: 'Lady', Other: 'Lady'}},
  11: {Title: {Male: 'Sir', Female: 'Dame', Other: 'Dame'}},
  12: {Title: {Male: 'Baron', Female: 'Baroness', Other: 'Baroness'}},
  13: {Title: {Male: 'Marquis', Female: 'Marquesa', Other: 'Marquesa'}},
  14: {Title: {Male: 'Count', Female: 'Countess', Other: 'Countess'}},
  15: {Title: {Male: 'Duke', Female: 'Duchess', Other: 'Duchess'}},
  16: {Title: {Male: 'Archduke', Female: 'Archduchess', Other: 'Archduchess'}},
  17: {
    Title: {
      Male: 'Crown Prince',
      Female: 'Crown Princess',
      Other: 'Crown Princess'
    }
  },
  18: {Title: {Male: 'Emperor', Female: 'Empress', Other: 'Empress'}}
})

const primaryEducationSkillsData = Object.freeze([
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
])

const homeWorldSkillsByLawLevel = Object.freeze({
  'No Law': 'Gun Combat*',
  'Low Law': 'Gun Combat*',
  'Medium Law': 'Gun Combat*',
  'High Law': 'Melee Combat*'
})

const homeWorldSkillsByTradeCode = Object.freeze({
  Agricultural: 'Animals*',
  Asteroid: 'Zero-G',
  Desert: 'Survival',
  'Fluid Oceans': 'Watercraft*',
  Garden: 'Animals*',
  'High Technology': 'Computer',
  'High Population': 'Streetwise',
  'Ice-Capped': 'Zero-G',
  Industrial: 'Broker',
  'Low Technology': 'Survival',
  Poor: 'Animals*',
  Rich: 'Carousing',
  'Water World': 'Watercraft*',
  Vacuum: 'Zero-G'
})

// 1d6 - 1 lookup
const theDraft = Object.freeze([
  'Aerospace',
  'Marine',
  'Maritime Defense',
  'Navy',
  'Scout',
  'Surface Defense'
])

// 1d6 - 1 lookup
// should be a function that takes in current benefits
// also return flag indicating injury table roll
const survivalMishaps = Object.freeze([
  'Injured in action. (This is the same as a result of 2 on the Injury table.) Alternatively, roll twice on the Injury table and take the lower result.',
  'Honorably discharged from the service.',
  'Honorably discharged from the service after a long legal battle. Legal issues create a debt of Cr10,000.',
  'Dishonorably discharged from the service. Lose all benefits.',
  'Dishonorably discharged from the service after serving an extra 4 years in prison for a crime. Lose all benefits.',
  'Medically discharged from the service. Roll on the Injury table.'
])

// 1d6 - 1 lookup
// should be a function that takes in current characteristics
const injury = Object.freeze([
  'Nearly killed. Reduce one physical characteristic by 1D6, reduce both other physical characteristics by 2 (or one of them by 4).',
  'Severely injured. Reduce one physical characteristic by 1D6.',
  'Missing eye or limb. Reduce Strength or Dexterity by 2.',
  'Scarred. You are scarred and injured. Reduce any one physical characteristic by 2.',
  'Injured. Reduce any physical characteristic by 1.',
  'Lightly injured. No permanent effect.'
])

const medicalBills = Object.freeze([
  {
    Career: [
      'Aerospace',
      'Marine',
      'Maritime Defense',
      'Navy',
      'Scout',
      'Surface Defense'
    ],
    4: 75,
    8: 100,
    12: 100
  },
  {
    Career: [
      'Agent',
      'Athlete',
      'Bureaucrat',
      'Diplomat',
      'Entertainer',
      'Hunter',
      'Mercenary',
      'Merchant',
      'Noble',
      'Physician',
      'Pirate',
      'Scientist',
      'Technician'
    ],
    4: 50,
    8: 75,
    12: 100
  },
  {
    Career: ['Barbarian', 'Belter', 'Colonist', 'Drifter', 'Rogue'],
    4: 0,
    8: 5,
    12: 75
  }
])

const CharacteristicTypes = Object.freeze({
  PHYSICAL: 'PHYSICAL',
  MENTAL: 'MENTAL'
})

// should be a function that takes in stats
const aging = Object.freeze([
  {
    Roll: '-6',
    Effects:
      'Reduce three physical characteristics by 2, reduce one mental characteristic by 1',
    Changes: [
      {type: CharacteristicTypes.PHYSICAL, modifier: -2},
      {type: CharacteristicTypes.PHYSICAL, modifier: -2},
      {type: CharacteristicTypes.PHYSICAL, modifier: -2},
      {type: CharacteristicTypes.MENTAL, modifier: -1}
    ]
  },
  {
    Roll: '-5',
    Effects: 'Reduce three physical characteristics by 2.',
    Changes: [
      {type: CharacteristicTypes.PHYSICAL, modifier: -2},
      {type: CharacteristicTypes.PHYSICAL, modifier: -2},
      {type: CharacteristicTypes.PHYSICAL, modifier: -2}
    ]
  },
  {
    Roll: '-4',
    Effects:
      'Reduce two physical characteristics by 2, reduce one physical characteristic by 1',
    Changes: [
      {type: CharacteristicTypes.PHYSICAL, modifier: -2},
      {type: CharacteristicTypes.PHYSICAL, modifier: -2},
      {type: CharacteristicTypes.PHYSICAL, modifier: -1}
    ]
  },
  {
    Roll: '-3',
    Effects:
      'Reduce one physical characteristic by 2, reduce two physical characteristic by 1',
    Changes: [
      {type: CharacteristicTypes.PHYSICAL, modifier: -2},
      {type: CharacteristicTypes.PHYSICAL, modifier: -1},
      {type: CharacteristicTypes.PHYSICAL, modifier: -1}
    ]
  },
  {
    Roll: '-2',
    Effects: 'Reduce three physical characteristics by 1',
    Changes: [
      {type: CharacteristicTypes.PHYSICAL, modifier: -1},
      {type: CharacteristicTypes.PHYSICAL, modifier: -1},
      {type: CharacteristicTypes.PHYSICAL, modifier: -1}
    ]
  },
  {
    Roll: '-1',
    Effects: 'Reduce two physical characteristics by 1',
    Changes: [
      {type: CharacteristicTypes.PHYSICAL, modifier: -1},
      {type: CharacteristicTypes.PHYSICAL, modifier: -1}
    ]
  },
  {
    Roll: '0',
    Effects: 'Reduce one physical characteristic by 1',
    Changes: [{type: CharacteristicTypes.PHYSICAL, modifier: -1}]
  },
  {
    Roll: '1',
    Effects: 'No effect',
    Changes: []
  }
])

const retirement = Object.freeze([
  {
    Terms: '5',
    AnnualPay: 'Cr10,000'
  },
  {
    Terms: '6',
    AnnualPay: 'Cr12,000'
  },
  {
    Terms: '7',
    AnnualPay: 'Cr14,000'
  },
  {
    Terms: '8',
    AnnualPay: 'Cr16,000'
  },
  {
    Terms: '9+',
    AnnualPay: '+Cr2,000 per term beyond 8'
  }
])

const cascadeSkills = Object.freeze({
  Aircraft: ['Grav Vehicle', 'Rotor Aircraft', 'Winged Aircraft'],
  Animals: ['Farming', 'Riding', 'Survival', 'Veterinary Medicine'],
  'Gun Combat': [
    'Archery',
    'Energy Pistol',
    'Energy Rifle',
    'Shotgun',
    'Slug Pistol',
    'Slug Rifle'
  ],
  Gunnery: [
    'Bay Weapons',
    'Heavy Weapons',
    'Screens',
    'Spinal Mounts',
    'Turret Weapons'
  ],
  'Melee Combat': [
    'Natural Weapons',
    'Bludgeoning Weapons',
    'Piercing Weapons',
    'Slashing Weapons'
  ],
  Sciences: [
    'Life Sciences',
    'Physical Sciences',
    'Social Sciences',
    'Space Sciences'
  ],
  Vehicle: [
    'Aircraft*',
    'Mole',
    'Tracked Vehicle',
    'Watercraft*',
    'Wheeled Vehicle'
  ],
  Watercraft: ['Motorboats', 'Ocean Ships', 'Sailing Ships', 'Submarine'],
  Weapon: ['Gun Combat*', 'Melee Combat*']
})

module.exports = {
  gender,
  nobleTitle,
  primaryEducationSkillsData,
  homeWorldSkillsByLawLevel,
  homeWorldSkillsByTradeCode,
  theDraft,
  survivalMishaps,
  injury,
  medicalBills,
  CharacteristicTypes,
  aging,
  retirement,
  cascadeSkills
}
