export interface CepheusCareerDefinition {
  name: string
  qualification: string
  survival: string
  commission: string
  advancement: string
  serviceSkills: readonly string[]
  specialistSkills: readonly string[]
  personalDevelopment: readonly string[]
  advancedEducation: readonly string[]
}

export const CEPHEUS_SRD_CAREERS = [
  {
    name: 'Scout',
    qualification: 'Int 6+',
    survival: 'End 7+',
    commission: '-',
    advancement: '-',
    serviceSkills: [
      'Comms',
      'Electronics',
      'Gun Combat*',
      'Gunnery*',
      'Recon',
      'Piloting'
    ],
    specialistSkills: [
      'Engineering',
      'Gunnery*',
      'Demolitions',
      'Navigation',
      'Medicine',
      'Vehicle*'
    ],
    personalDevelopment: [
      '+1 Str',
      '+1 Dex',
      '+1 End',
      "Jack o' Trades",
      '+1 Edu',
      'Melee Combat*'
    ],
    advancedEducation: [
      'Advocate',
      'Computer',
      'Linguistics',
      'Medicine',
      'Navigation',
      'Tactics'
    ]
  },
  {
    name: 'Merchant',
    qualification: 'Int 4+',
    survival: 'Int 5+',
    commission: 'Int 5+',
    advancement: 'Edu 8+',
    serviceSkills: [
      'Comms',
      'Engineering',
      'Gun Combat*',
      'Melee Combat*',
      'Broker',
      'Vehicle*'
    ],
    specialistSkills: [
      'Carousing',
      'Gunnery*',
      "Jack o' Trades",
      'Medicine',
      'Navigation',
      'Piloting'
    ],
    personalDevelopment: [
      '+1 Str',
      '+1 Dex',
      '+1 End',
      'Zero-G',
      'Melee Combat*',
      'Steward'
    ],
    advancedEducation: [
      'Advocate',
      'Engineering',
      'Medicine',
      'Navigation',
      'Sciences*',
      'Tactics'
    ]
  },
  {
    name: 'Marine',
    qualification: 'Int 6+',
    survival: 'End 6+',
    commission: 'Edu 6+',
    advancement: 'Soc 7+',
    serviceSkills: [
      'Comms',
      'Demolitions',
      'Gun Combat*',
      'Gunnery*',
      'Melee Combat*',
      'Battle Dress'
    ],
    specialistSkills: [
      'Electronics',
      'Gun Combat*',
      'Melee Combat*',
      'Survival',
      'Recon',
      'Vehicle*'
    ],
    personalDevelopment: [
      '+1 Str',
      '+1 Dex',
      '+1 End',
      '+1 Int',
      '+1 Edu',
      'Melee Combat*'
    ],
    advancedEducation: [
      'Advocate',
      'Computer',
      'Gravitics',
      'Medicine',
      'Navigation',
      'Tactics'
    ]
  },
  {
    name: 'Navy',
    qualification: 'Int 6+',
    survival: 'Int 5+',
    commission: 'Soc 7+',
    advancement: 'Edu 6+',
    serviceSkills: [
      'Comms',
      'Engineering',
      'Gun Combat*',
      'Gunnery*',
      'Melee Combat*',
      'Vehicle*'
    ],
    specialistSkills: [
      'Gravitics',
      "Jack o' Trades",
      'Melee Combat*',
      'Navigation',
      'Leadership',
      'Piloting'
    ],
    personalDevelopment: [
      '+1 Str',
      '+1 Dex',
      '+1 End',
      '+1 Int',
      '+1 Edu',
      'Melee Combat*'
    ],
    advancedEducation: [
      'Advocate',
      'Computer',
      'Engineering',
      'Medicine',
      'Navigation',
      'Tactics'
    ]
  },
  {
    name: 'Belter',
    qualification: 'Int 4+',
    survival: 'Dex 7+',
    commission: '-',
    advancement: '-',
    serviceSkills: [
      'Comms',
      'Demolitions',
      'Gun Combat*',
      'Gunnery*',
      'Prospecting',
      'Piloting'
    ],
    specialistSkills: [
      'Zero-G',
      'Computer',
      'Electronics',
      'Prospecting',
      'Sciences*',
      'Vehicle*'
    ],
    personalDevelopment: [
      '+1 Str',
      '+1 Dex',
      '+1 End',
      'Zero-G',
      'Melee Combat*',
      'Gambling'
    ],
    advancedEducation: [
      'Advocate',
      'Engineering',
      'Medicine',
      'Navigation',
      'Comms',
      'Tactics'
    ]
  },
  {
    name: 'Agent',
    qualification: 'Soc 6+',
    survival: 'Int 6+',
    commission: 'Edu 7+',
    advancement: 'Edu 6+',
    serviceSkills: [
      'Admin',
      'Computer',
      'Streetwise',
      'Bribery',
      'Leadership',
      'Vehicle*'
    ],
    specialistSkills: [
      'Gun Combat*',
      'Melee Combat*',
      'Bribery',
      'Leadership',
      'Recon',
      'Survival'
    ],
    personalDevelopment: [
      '+1 Dex',
      '+1 End',
      '+1 Int',
      '+1 Edu',
      'Athletics',
      'Carousing'
    ],
    advancedEducation: [
      'Advocate',
      'Computer',
      'Liaison',
      'Linguistics',
      'Medicine',
      'Leadership'
    ]
  },
  {
    name: 'Aerospace',
    qualification: 'End 5+',
    survival: 'Dex 5+',
    commission: 'Edu 6+',
    advancement: 'Edu 7+',
    serviceSkills: [
      'Electronics',
      'Gun Combat*',
      'Gunnery*',
      'Melee Combat*',
      'Survival',
      'Aircraft*'
    ],
    specialistSkills: [
      'Comms',
      'Gravitics',
      'Gun Combat*',
      'Gunnery*',
      'Recon',
      'Piloting'
    ],
    personalDevelopment: [
      '+1 Str',
      '+1 Dex',
      '+1 End',
      'Athletics',
      'Melee Combat*',
      'Vehicle*'
    ],
    advancedEducation: [
      'Advocate',
      'Computer',
      "Jack o' Trades",
      'Medicine',
      'Leadership',
      'Tactics'
    ]
  },
  {
    name: 'Mercenary',
    qualification: 'Int 4+',
    survival: 'End 6+',
    commission: 'Int 7+',
    advancement: 'Int 6+',
    serviceSkills: [
      'Comms',
      'Mechanics',
      'Gun Combat*',
      'Melee Combat*',
      'Gambling',
      'Battle Dress'
    ],
    specialistSkills: [
      'Gravitics',
      'Gun Combat*',
      'Gunnery*',
      'Melee Combat*',
      'Recon',
      'Vehicle*'
    ],
    personalDevelopment: [
      '+1 Str',
      '+1 Dex',
      '+1 End',
      'Zero-G',
      'Melee Combat*',
      'Gambling'
    ],
    advancedEducation: [
      'Advocate',
      'Engineering',
      'Medicine',
      'Navigation',
      'Sciences*',
      'Tactics'
    ]
  },
  {
    name: 'Physician',
    qualification: 'Edu 6+',
    survival: 'Int 4+',
    commission: 'Int 5+',
    advancement: 'Edu 8+',
    serviceSkills: [
      'Admin',
      'Computer',
      'Mechanics',
      'Medicine',
      'Leadership',
      'Sciences*'
    ],
    specialistSkills: [
      'Computer',
      'Carousing',
      'Electronics',
      'Medicine',
      'Medicine',
      'Sciences*'
    ],
    personalDevelopment: [
      '+1 Str',
      '+1 Dex',
      '+1 End',
      '+1 Int',
      '+1 Edu',
      'Gun Combat*'
    ],
    advancedEducation: [
      'Advocate',
      'Computer',
      "Jack o' Trades",
      'Linguistics',
      'Medicine',
      'Sciences*'
    ]
  },
  {
    name: 'Rogue',
    qualification: 'Dex 5+',
    survival: 'Dex 4+',
    commission: 'Str 6+',
    advancement: 'Int 7+',
    serviceSkills: [
      'Streetwise',
      'Mechanics',
      'Gun Combat*',
      'Melee Combat*',
      'Recon',
      'Vehicle*'
    ],
    specialistSkills: [
      'Computer',
      'Electronics',
      'Bribery',
      'Broker',
      'Recon',
      'Vehicle*'
    ],
    personalDevelopment: [
      '+1 Str',
      '+1 Dex',
      '+1 End',
      'Melee Combat*',
      'Bribery',
      'Gambling'
    ],
    advancedEducation: [
      'Computer',
      'Gravitics',
      "Jack o' Trades",
      'Medicine',
      'Advocate',
      'Tactics'
    ]
  },
  {
    name: 'Technician',
    qualification: 'Edu 6+',
    survival: 'Dex 4+',
    commission: 'Edu 5+',
    advancement: 'Int 8+',
    serviceSkills: [
      'Admin',
      'Computer',
      'Mechanics',
      'Medicine',
      'Electronics',
      'Sciences*'
    ],
    specialistSkills: [
      'Computer',
      'Electronics',
      'Gravitics',
      'Linguistics',
      'Engineering',
      'Animals*'
    ],
    personalDevelopment: [
      '+1 Str',
      '+1 Dex',
      '+1 End',
      '+1 Int',
      '+1 Edu',
      'Gun Combat*'
    ],
    advancedEducation: [
      'Advocate',
      'Computer',
      "Jack o' Trades",
      'Linguistics',
      'Medicine',
      'Sciences*'
    ]
  },
  {
    name: 'Drifter',
    qualification: 'Dex 5+',
    survival: 'End 5+',
    commission: '-',
    advancement: '-',
    serviceSkills: [
      'Streetwise',
      'Mechanics',
      'Gun Combat*',
      'Melee Combat*',
      'Recon',
      'Vehicle*'
    ],
    specialistSkills: [
      'Electronics',
      'Melee Combat*',
      'Bribery',
      'Streetwise',
      'Gambling',
      'Recon'
    ],
    personalDevelopment: [
      '+1 Str',
      '+1 Dex',
      '+1 End',
      'Melee Combat*',
      'Bribery',
      'Gambling'
    ],
    advancedEducation: [
      'Computer',
      'Engineering',
      "Jack o' Trades",
      'Medicine',
      'Liaison',
      'Tactics'
    ]
  }
] satisfies readonly CepheusCareerDefinition[]
