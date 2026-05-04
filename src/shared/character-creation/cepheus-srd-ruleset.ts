import type { AgingEffect, CareerBasicsTable, CareerSkillTable } from './types'

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

export interface CepheusSrdRuleset {
  gender: Record<string, string>
  careerBasics: CareerBasicsTable
  serviceSkills: CareerSkillTable
  specialistSkills: CareerSkillTable
  personalDevelopment: CareerSkillTable
  advEducation: CareerSkillTable
  ranksAndSkills: Record<string, Record<string, string>>
  cashBenefits: Record<string, Record<string, number>>
  materialBenefits: Record<string, Record<string, string>>
  primaryEducationSkillsData: readonly string[]
  homeWorldSkillsByLawLevel: Record<string, string>
  homeWorldSkillsByTradeCode: Record<string, string>
  cascadeSkills: Record<string, readonly string[]>
  theDraft: readonly string[]
  aging: readonly AgingEffect[]
}

const ROLL_TABLE_KEYS = ['1', '2', '3', '4', '5', '6'] as const

const RAW_CEPHEUS_SRD_RULESET = {
  "gender": {
    "FEMALE": "Female",
    "MALE": "Male",
    "OTHER": "Other"
  },
  "careerBasics": {
    "Athlete": {
      "Qualifications": "End 8+",
      "Survival": "Dex 5+",
      "Commission": "-",
      "Advancement": "-",
      "ReEnlistment": "6+"
    },
    "Aerospace": {
      "Qualifications": "End 5+",
      "Survival": "Dex 5+",
      "Commission": "Edu 6+",
      "Advancement": "Edu 7+",
      "ReEnlistment": "5+"
    },
    "Agent": {
      "Qualifications": "Soc 6+",
      "Survival": "Int 6+",
      "Commission": "Edu 7+",
      "Advancement": "Edu 6+",
      "ReEnlistment": "6+"
    },
    "Barbarian": {
      "Qualifications": "End 5+",
      "Survival": "Str 6+",
      "Commission": "-",
      "Advancement": "-",
      "ReEnlistment": "5+"
    },
    "Belter": {
      "Qualifications": "Int 4+",
      "Survival": "Dex 7+",
      "Commission": "-",
      "Advancement": "-",
      "ReEnlistment": "5+"
    },
    "Bureaucrat": {
      "Qualifications": "Soc 6+",
      "Survival": "Edu 4+",
      "Commission": "Soc 5+",
      "Advancement": "Int 8+",
      "ReEnlistment": "5+"
    },
    "Colonist": {
      "Qualifications": "End 5+",
      "Survival": "End 6+",
      "Commission": "Int 7+",
      "Advancement": "Edu 6+",
      "ReEnlistment": "5+"
    },
    "Diplomat": {
      "Qualifications": "Soc 6+",
      "Survival": "Edu 5+",
      "Commission": "Int 7+",
      "Advancement": "Soc 7+",
      "ReEnlistment": "5+"
    },
    "Drifter": {
      "Qualifications": "Dex 5+",
      "Survival": "End 5+",
      "Commission": "-",
      "Advancement": "-",
      "ReEnlistment": "5+"
    },
    "Entertainer": {
      "Qualifications": "Soc 8+",
      "Survival": "Int 4+",
      "Commission": "-",
      "Advancement": "-",
      "ReEnlistment": "6+"
    },
    "Hunter": {
      "Qualifications": "End 5+",
      "Survival": "Str 8+",
      "Commission": "-",
      "Advancement": "-",
      "ReEnlistment": "6+"
    },
    "Marine": {
      "Qualifications": "Int 6+",
      "Survival": "End 6+",
      "Commission": "Edu 6+",
      "Advancement": "Soc 7+",
      "ReEnlistment": "6+"
    },
    "Maritime Defense": {
      "Qualifications": "End 5+",
      "Survival": "End 5+",
      "Commission": "Int 6+",
      "Advancement": "Edu 7+",
      "ReEnlistment": "5+"
    },
    "Mercenary": {
      "Qualifications": "Int 4+",
      "Survival": "End 6+",
      "Commission": "Int 7+",
      "Advancement": "Int 6+",
      "ReEnlistment": "5+"
    },
    "Merchant": {
      "Qualifications": "Int 4+",
      "Survival": "Int 5+",
      "Commission": "Int 5+",
      "Advancement": "Edu 8+",
      "ReEnlistment": "4+"
    },
    "Navy": {
      "Qualifications": "Int 6+",
      "Survival": "Int 5+",
      "Commission": "Soc 7+",
      "Advancement": "Edu 6+",
      "ReEnlistment": "5+"
    },
    "Noble": {
      "Qualifications": "Soc 8+",
      "Survival": "Soc 4+",
      "Commission": "Edu 5+",
      "Advancement": "Int 8+",
      "ReEnlistment": "6+"
    },
    "Physician": {
      "Qualifications": "Edu 6+",
      "Survival": "Int 4+",
      "Commission": "Int 5+",
      "Advancement": "Edu 8+",
      "ReEnlistment": "5+"
    },
    "Pirate": {
      "Qualifications": "Dex 5+",
      "Survival": "Dex 6+",
      "Commission": "Str 7+",
      "Advancement": "Int 6+",
      "ReEnlistment": "5+"
    },
    "Rogue": {
      "Qualifications": "Dex 5+",
      "Survival": "Dex 4+",
      "Commission": "Str 6+",
      "Advancement": "Int 7+",
      "ReEnlistment": "4+"
    },
    "Scientist": {
      "Qualifications": "Edu 6+",
      "Survival": "Edu 5+",
      "Commission": "Int 7+",
      "Advancement": "Int 6+",
      "ReEnlistment": "5+"
    },
    "Scout": {
      "Qualifications": "Int 6+",
      "Survival": "End 7+",
      "Commission": "-",
      "Advancement": "-",
      "ReEnlistment": "6+"
    },
    "Surface Defense": {
      "Qualifications": "End 5+",
      "Survival": "Edu 5+",
      "Commission": "End 6+",
      "Advancement": "Edu 7+",
      "ReEnlistment": "5+"
    },
    "Technician": {
      "Qualifications": "Edu 6+",
      "Survival": "Dex 4+",
      "Commission": "Edu 5+",
      "Advancement": "Int 8+",
      "ReEnlistment": "5+"
    }
  },
  "serviceSkills": {
    "Athlete": {
      "1": "Athletics",
      "2": "Admin",
      "3": "Carousing",
      "4": "Computer",
      "5": "Gambling",
      "6": "Vehicle*"
    },
    "Aerospace": {
      "1": "Electronics",
      "2": "Gun Combat*",
      "3": "Gunnery*",
      "4": "Melee Combat*",
      "5": "Survival",
      "6": "Aircraft*"
    },
    "Agent": {
      "1": "Admin",
      "2": "Computer",
      "3": "Streetwise",
      "4": "Bribery",
      "5": "Leadership",
      "6": "Vehicle*"
    },
    "Barbarian": {
      "1": "Mechanics",
      "2": "Gun Combat*",
      "3": "Melee Combat*",
      "4": "Recon",
      "5": "Survival",
      "6": "Animals*"
    },
    "Belter": {
      "1": "Comms",
      "2": "Demolitions",
      "3": "Gun Combat*",
      "4": "Gunnery*",
      "5": "Prospecting",
      "6": "Piloting"
    },
    "Bureaucrat": {
      "1": "Admin",
      "2": "Computer",
      "3": "Carousing",
      "4": "Bribery",
      "5": "Leadership",
      "6": "Vehicle*"
    },
    "Colonist": {
      "1": "Mechanics",
      "2": "Gun Combat*",
      "3": "Animals*",
      "4": "Electronics",
      "5": "Survival",
      "6": "Vehicle*"
    },
    "Diplomat": {
      "1": "Admin",
      "2": "Computer",
      "3": "Carousing",
      "4": "Bribery",
      "5": "Liaison",
      "6": "Vehicle*"
    },
    "Drifter": {
      "1": "Streetwise",
      "2": "Mechanics",
      "3": "Gun Combat*",
      "4": "Melee Combat*",
      "5": "Recon",
      "6": "Vehicle*"
    },
    "Entertainer": {
      "1": "Athletics",
      "2": "Admin",
      "3": "Carousing",
      "4": "Bribery",
      "5": "Gambling",
      "6": "Vehicle*"
    },
    "Hunter": {
      "1": "Mechanics",
      "2": "Gun Combat*",
      "3": "Melee Combat*",
      "4": "Recon",
      "5": "Survival",
      "6": "Vehicle*"
    },
    "Marine": {
      "1": "Comms",
      "2": "Demolitions",
      "3": "Gun Combat*",
      "4": "Gunnery*",
      "5": "Melee Combat*",
      "6": "Battle Dress"
    },
    "Maritime Defense": {
      "1": "Mechanics",
      "2": "Gun Combat*",
      "3": "Gunnery*",
      "4": "Melee Combat*",
      "5": "Survival",
      "6": "Watercraft*"
    },
    "Mercenary": {
      "1": "Comms",
      "2": "Mechanics",
      "3": "Gun Combat*",
      "4": "Melee Combat*",
      "5": "Gambling",
      "6": "Battle Dress"
    },
    "Merchant": {
      "1": "Comms",
      "2": "Engineering",
      "3": "Gun Combat*",
      "4": "Melee Combat*",
      "5": "Broker",
      "6": "Vehicle*"
    },
    "Navy": {
      "1": "Comms",
      "2": "Engineering",
      "3": "Gun Combat*",
      "4": "Gunnery*",
      "5": "Melee Combat*",
      "6": "Vehicle*"
    },
    "Noble": {
      "1": "Athletics",
      "2": "Admin",
      "3": "Carousing",
      "4": "Leadership",
      "5": "Gambling",
      "6": "Vehicle*"
    },
    "Physician": {
      "1": "Admin",
      "2": "Computer",
      "3": "Mechanics",
      "4": "Medicine",
      "5": "Leadership",
      "6": "Sciences*"
    },
    "Pirate": {
      "1": "Streetwise",
      "2": "Electronics",
      "3": "Gun Combat*",
      "4": "Melee Combat*",
      "5": "Recon",
      "6": "Vehicle*"
    },
    "Rogue": {
      "1": "Streetwise",
      "2": "Mechanics",
      "3": "Gun Combat*",
      "4": "Melee Combat*",
      "5": "Recon",
      "6": "Vehicle*"
    },
    "Scientist": {
      "1": "Admin",
      "2": "Computer",
      "3": "Electronics",
      "4": "Medicine",
      "5": "Bribery",
      "6": "Sciences*"
    },
    "Scout": {
      "1": "Comms",
      "2": "Electronics",
      "3": "Gun Combat*",
      "4": "Gunnery*",
      "5": "Recon",
      "6": "Piloting"
    },
    "Surface Defense": {
      "1": "Mechanics",
      "2": "Gun Combat*",
      "3": "Gunnery*",
      "4": "Melee Combat*",
      "5": "Recon",
      "6": "Battle Dress"
    },
    "Technician": {
      "1": "Admin",
      "2": "Computer",
      "3": "Mechanics",
      "4": "Medicine",
      "5": "Electronics",
      "6": "Sciences*"
    }
  },
  "specialistSkills": {
    "Athlete": {
      "1": "Zero-G",
      "2": "Athletics",
      "3": "Athletics",
      "4": "Computer",
      "5": "Leadership",
      "6": "Gambling"
    },
    "Aerospace": {
      "1": "Comms",
      "2": "Gravitics",
      "3": "Gun Combat*",
      "4": "Gunnery*",
      "5": "Recon",
      "6": "Piloting"
    },
    "Agent": {
      "1": "Gun Combat*",
      "2": "Melee Combat*",
      "3": "Bribery",
      "4": "Leadership",
      "5": "Recon",
      "6": "Survival"
    },
    "Barbarian": {
      "1": "Gun Combat*",
      "2": "Jack o' Trades",
      "3": "Melee Combat*",
      "4": "Recon",
      "5": "Animals*",
      "6": "Tactics"
    },
    "Belter": {
      "1": "Zero-G",
      "2": "Computer",
      "3": "Electronics",
      "4": "Prospecting",
      "5": "Sciences*",
      "6": "Vehicle*"
    },
    "Bureaucrat": {
      "1": "Admin",
      "2": "Computer",
      "3": "Perception",
      "4": "Leadership",
      "5": "Steward",
      "6": "Vehicle*"
    },
    "Colonist": {
      "1": "Athletics",
      "2": "Carousing",
      "3": "Jack o' Trades",
      "4": "Engineering",
      "5": "Animals*",
      "6": "Vehicle*"
    },
    "Diplomat": {
      "1": "Carousing",
      "2": "Linguistics",
      "3": "Bribery",
      "4": "Liaison",
      "5": "Steward",
      "6": "Vehicle*"
    },
    "Drifter": {
      "1": "Electronics",
      "2": "Melee Combat*",
      "3": "Bribery",
      "4": "Streetwise",
      "5": "Gambling",
      "6": "Recon"
    },
    "Entertainer": {
      "1": "Computer",
      "2": "Carousing",
      "3": "Bribery",
      "4": "Liaison",
      "5": "Gambling",
      "6": "Recon"
    },
    "Hunter": {
      "1": "Admin",
      "2": "Comms",
      "3": "Electronics",
      "4": "Recon",
      "5": "Animals*",
      "6": "Vehicle*"
    },
    "Marine": {
      "1": "Electronics",
      "2": "Gun Combat*",
      "3": "Melee Combat*",
      "4": "Survival",
      "5": "Recon",
      "6": "Vehicle*"
    },
    "Maritime Defense": {
      "1": "Comms",
      "2": "Electronics",
      "3": "Gun Combat*",
      "4": "Demolitions",
      "5": "Recon",
      "6": "Watercraft*"
    },
    "Mercenary": {
      "1": "Gravitics",
      "2": "Gun Combat*",
      "3": "Gunnery*",
      "4": "Melee Combat*",
      "5": "Recon",
      "6": "Vehicle*"
    },
    "Merchant": {
      "1": "Carousing",
      "2": "Gunnery*",
      "3": "Jack o' Trades",
      "4": "Medicine",
      "5": "Navigation",
      "6": "Piloting"
    },
    "Navy": {
      "1": "Gravitics",
      "2": "Jack o' Trades",
      "3": "Melee Combat*",
      "4": "Navigation",
      "5": "Leadership",
      "6": "Piloting"
    },
    "Noble": {
      "1": "Computer",
      "2": "Carousing",
      "3": "Gun Combat*",
      "4": "Melee Combat*",
      "5": "Liaison",
      "6": "Animals*"
    },
    "Physician": {
      "1": "Computer",
      "2": "Carousing",
      "3": "Electronics",
      "4": "Medicine",
      "5": "Medicine",
      "6": "Sciences*"
    },
    "Pirate": {
      "1": "Zero-G",
      "2": "Comms",
      "3": "Engineering",
      "4": "Gunnery*",
      "5": "Navigation",
      "6": "Piloting"
    },
    "Rogue": {
      "1": "Computer",
      "2": "Electronics",
      "3": "Bribery",
      "4": "Broker",
      "5": "Recon",
      "6": "Vehicle*"
    },
    "Scientist": {
      "1": "Navigation",
      "2": "Admin",
      "3": "Sciences*",
      "4": "Sciences*",
      "5": "Animals*",
      "6": "Vehicle*"
    },
    "Scout": {
      "1": "Engineering",
      "2": "Gunnery*",
      "3": "Demolitions",
      "4": "Navigation",
      "5": "Medicine",
      "6": "Vehicle*"
    },
    "Surface Defense": {
      "1": "Comms",
      "2": "Demolitions",
      "3": "Gun Combat*",
      "4": "Melee Combat*",
      "5": "Survival",
      "6": "Vehicle*"
    },
    "Technician": {
      "1": "Computer",
      "2": "Electronics",
      "3": "Gravitics",
      "4": "Linguistics",
      "5": "Engineering",
      "6": "Animals*"
    }
  },
  "personalDevelopment": {
    "Athlete": {
      "1": "+1 Dex",
      "2": "+1 Int",
      "3": "+1 Edu",
      "4": "+1 Soc",
      "5": "Carousing",
      "6": "Melee Combat*"
    },
    "Aerospace": {
      "1": "+1 Str",
      "2": "+1 Dex",
      "3": "+1 End",
      "4": "Athletics",
      "5": "Melee Combat*",
      "6": "Vehicle*"
    },
    "Agent": {
      "1": "+1 Dex",
      "2": "+1 End",
      "3": "+1 Int",
      "4": "+1 Edu",
      "5": "Athletics",
      "6": "Carousing"
    },
    "Barbarian": {
      "1": "+1 Str",
      "2": "+1 Dex",
      "3": "+1 End",
      "4": "+1 Int",
      "5": "Athletics",
      "6": "Gun Combat*"
    },
    "Belter": {
      "1": "+1 Str",
      "2": "+1 Dex",
      "3": "+1 End",
      "4": "Zero-G",
      "5": "Melee Combat*",
      "6": "Gambling"
    },
    "Bureaucrat": {
      "1": "+1 Dex",
      "2": "+1 End",
      "3": "+1 Int",
      "4": "+1 Edu",
      "5": "Athletics",
      "6": "Carousing"
    },
    "Colonist": {
      "1": "+1 Str",
      "2": "+1 Dex",
      "3": "+1 End",
      "4": "+1 Int",
      "5": "Athletics",
      "6": "Gun Combat*"
    },
    "Diplomat": {
      "1": "+1 Dex",
      "2": "+1 End",
      "3": "+1 Int",
      "4": "+1 Edu",
      "5": "Athletics",
      "6": "Carousing"
    },
    "Drifter": {
      "1": "+1 Str",
      "2": "+1 Dex",
      "3": "+1 End",
      "4": "Melee Combat*",
      "5": "Bribery",
      "6": "Gambling"
    },
    "Entertainer": {
      "1": "+1 Dex",
      "2": "+1 Int",
      "3": "+1 Edu",
      "4": "+1 Soc",
      "5": "Carousing",
      "6": "Melee Combat*"
    },
    "Hunter": {
      "1": "+1 Str",
      "2": "+1 Dex",
      "3": "+1 End",
      "4": "+1 Int",
      "5": "Athletics",
      "6": "Gun Combat*"
    },
    "Marine": {
      "1": "+1 Str",
      "2": "+1 Dex",
      "3": "+1 End",
      "4": "+1 Int",
      "5": "+1 Edu",
      "6": "Melee Combat*"
    },
    "Maritime Defense": {
      "1": "+1 Str",
      "2": "+1 Dex",
      "3": "+1 End",
      "4": "Athletics",
      "5": "Melee Combat*",
      "6": "Vehicle*"
    },
    "Mercenary": {
      "1": "+1 Str",
      "2": "+1 Dex",
      "3": "+1 End",
      "4": "Zero-G",
      "5": "Melee Combat*",
      "6": "Gambling"
    },
    "Merchant": {
      "1": "+1 Str",
      "2": "+1 Dex",
      "3": "+1 End",
      "4": "Zero-G",
      "5": "Melee Combat*",
      "6": "Steward"
    },
    "Navy": {
      "1": "+1 Str",
      "2": "+1 Dex",
      "3": "+1 End",
      "4": "+1 Int",
      "5": "+1 Edu",
      "6": "Melee Combat*"
    },
    "Noble": {
      "1": "+1 Dex",
      "2": "+1 Int",
      "3": "+1 Edu",
      "4": "+1 Soc",
      "5": "Carousing",
      "6": "Melee Combat*"
    },
    "Physician": {
      "1": "+1 Str",
      "2": "+1 Dex",
      "3": "+1 End",
      "4": "+1 Int",
      "5": "+1 Edu",
      "6": "Gun Combat*"
    },
    "Pirate": {
      "1": "+1 Str",
      "2": "+1 Dex",
      "3": "+1 End",
      "4": "Melee Combat*",
      "5": "Bribery",
      "6": "Gambling"
    },
    "Rogue": {
      "1": "+1 Str",
      "2": "+1 Dex",
      "3": "+1 End",
      "4": "Melee Combat*",
      "5": "Bribery",
      "6": "Gambling"
    },
    "Scientist": {
      "1": "+1 Str",
      "2": "+1 Dex",
      "3": "+1 End",
      "4": "+1 Int",
      "5": "+1 Edu",
      "6": "Gun Combat*"
    },
    "Scout": {
      "1": "+1 Str",
      "2": "+1 Dex",
      "3": "+1 End",
      "4": "Jack o' Trades",
      "5": "+1 Edu",
      "6": "Melee Combat*"
    },
    "Surface Defense": {
      "1": "+1 Str",
      "2": "+1 Dex",
      "3": "+1 End",
      "4": "Athletics",
      "5": "Melee Combat*",
      "6": "Vehicle*"
    },
    "Technician": {
      "1": "+1 Str",
      "2": "+1 Dex",
      "3": "+1 End",
      "4": "+1 Int",
      "5": "+1 Edu",
      "6": "Gun Combat*"
    }
  },
  "advEducation": {
    "Athlete": {
      "1": "Advocate",
      "2": "Computer",
      "3": "Liaison",
      "4": "Linguistics",
      "5": "Medicine",
      "6": "Sciences*"
    },
    "Aerospace": {
      "1": "Advocate",
      "2": "Computer",
      "3": "Jack o' Trades",
      "4": "Medicine",
      "5": "Leadership",
      "6": "Tactics"
    },
    "Agent": {
      "1": "Advocate",
      "2": "Computer",
      "3": "Liaison",
      "4": "Linguistics",
      "5": "Medicine",
      "6": "Leadership"
    },
    "Barbarian": {
      "1": "Advocate",
      "2": "Linguistics",
      "3": "Medicine",
      "4": "Leadership",
      "5": "Tactics",
      "6": "Broker"
    },
    "Belter": {
      "1": "Advocate",
      "2": "Engineering",
      "3": "Medicine",
      "4": "Navigation",
      "5": "Comms",
      "6": "Tactics"
    },
    "Bureaucrat": {
      "1": "Advocate",
      "2": "Computer",
      "3": "Liaison",
      "4": "Linguistics",
      "5": "Medicine",
      "6": "Admin"
    },
    "Colonist": {
      "1": "Advocate",
      "2": "Linguistics",
      "3": "Medicine",
      "4": "Liaison",
      "5": "Admin",
      "6": "Animals*"
    },
    "Diplomat": {
      "1": "Advocate",
      "2": "Computer",
      "3": "Liaison",
      "4": "Linguistics",
      "5": "Medicine",
      "6": "Leadership"
    },
    "Drifter": {
      "1": "Computer",
      "2": "Engineering",
      "3": "Jack o' Trades",
      "4": "Medicine",
      "5": "Liaison",
      "6": "Tactics"
    },
    "Entertainer": {
      "1": "Advocate",
      "2": "Computer",
      "3": "Carousing",
      "4": "Linguistics",
      "5": "Medicine",
      "6": "Sciences*"
    },
    "Hunter": {
      "1": "Advocate",
      "2": "Linguistics",
      "3": "Medicine",
      "4": "Liaison",
      "5": "Tactics",
      "6": "Animals*"
    },
    "Marine": {
      "1": "Advocate",
      "2": "Computer",
      "3": "Gravitics",
      "4": "Medicine",
      "5": "Navigation",
      "6": "Tactics"
    },
    "Maritime Defense": {
      "1": "Advocate",
      "2": "Computer",
      "3": "Jack o' Trades",
      "4": "Medicine",
      "5": "Leadership",
      "6": "Tactics"
    },
    "Mercenary": {
      "1": "Advocate",
      "2": "Engineering",
      "3": "Medicine",
      "4": "Navigation",
      "5": "Sciences*",
      "6": "Tactics"
    },
    "Merchant": {
      "1": "Advocate",
      "2": "Engineering",
      "3": "Medicine",
      "4": "Navigation",
      "5": "Sciences*",
      "6": "Tactics"
    },
    "Navy": {
      "1": "Advocate",
      "2": "Computer",
      "3": "Engineering",
      "4": "Medicine",
      "5": "Navigation",
      "6": "Tactics"
    },
    "Noble": {
      "1": "Advocate",
      "2": "Computer",
      "3": "Liaison",
      "4": "Linguistics",
      "5": "Medicine",
      "6": "Sciences*"
    },
    "Physician": {
      "1": "Advocate",
      "2": "Computer",
      "3": "Jack o' Trades",
      "4": "Linguistics",
      "5": "Medicine",
      "6": "Sciences*"
    },
    "Pirate": {
      "1": "Computer",
      "2": "Gravitics",
      "3": "Jack o' Trades",
      "4": "Medicine",
      "5": "Advocate",
      "6": "Tactics"
    },
    "Rogue": {
      "1": "Computer",
      "2": "Gravitics",
      "3": "Jack o' Trades",
      "4": "Medicine",
      "5": "Advocate",
      "6": "Tactics"
    },
    "Scientist": {
      "1": "Advocate",
      "2": "Computer",
      "3": "Jack o' Trades",
      "4": "Linguistics",
      "5": "Medicine",
      "6": "Sciences*"
    },
    "Scout": {
      "1": "Advocate",
      "2": "Computer",
      "3": "Linguistics",
      "4": "Medicine",
      "5": "Navigation",
      "6": "Tactics"
    },
    "Surface Defense": {
      "1": "Advocate",
      "2": "Computer",
      "3": "Jack o' Trades",
      "4": "Medicine",
      "5": "Leadership",
      "6": "Tactics"
    },
    "Technician": {
      "1": "Advocate",
      "2": "Computer",
      "3": "Jack o' Trades",
      "4": "Linguistics",
      "5": "Medicine",
      "6": "Sciences*"
    }
  },
  "ranksAndSkills": {
    "Athlete": {
      "0": "[Athletics]",
      "1": "-",
      "2": "-",
      "3": "-",
      "4": "-",
      "5": "-",
      "6": "-"
    },
    "Aerospace": {
      "0": "Airman [Aircraft*]",
      "1": "Flight Officer",
      "2": "Flight Lieutenant",
      "3": "Squadron Leader [Leadership]",
      "4": "Wing Commander",
      "5": "Group Captain",
      "6": "Air Commodore"
    },
    "Agent": {
      "0": "Agent [Streetwise]",
      "1": "Special Agent",
      "2": "Sp Agent in Charge",
      "3": "Unit Chief",
      "4": "Section Chief [Admin]",
      "5": "Assistant Directory",
      "6": "Director"
    },
    "Barbarian": {
      "0": "[Melee Combat*]",
      "1": "-",
      "2": "-",
      "3": "-",
      "4": "-",
      "5": "-",
      "6": "-"
    },
    "Belter": {
      "0": "[Zero-G]",
      "1": "-",
      "2": "-",
      "3": "-",
      "4": "-",
      "5": "-",
      "6": "-"
    },
    "Bureaucrat": {
      "0": "Assistant [Admin]",
      "1": "Clerk",
      "2": "Supervisor",
      "3": "Manager",
      "4": "Chief [Advocate]",
      "5": "Director",
      "6": "Minister"
    },
    "Colonist": {
      "0": "Citizen [Survival]",
      "1": "District Leader",
      "2": "District Delegate",
      "3": "Council Advisor [Liaison]",
      "4": "Councilor",
      "5": "Lieutenant Governor",
      "6": "Governor"
    },
    "Diplomat": {
      "0": "Attaché [Liaison]",
      "1": "Third Secretary",
      "2": "Second Secretary",
      "3": "First Secretary [Admin]",
      "4": "Counselor",
      "5": "Minister",
      "6": "Ambassador"
    },
    "Drifter": {
      "0": "-",
      "1": "-",
      "2": "-",
      "3": "-",
      "4": "-",
      "5": "-",
      "6": "-"
    },
    "Entertainer": {
      "0": "[Carousing]",
      "1": "-",
      "2": "-",
      "3": "-",
      "4": "-",
      "5": "-",
      "6": "-"
    },
    "Hunter": {
      "0": "[Survival]",
      "1": "-",
      "2": "-",
      "3": "-",
      "4": "-",
      "5": "-",
      "6": "-"
    },
    "Marine": {
      "0": "Trooper [Zero-G]",
      "1": "Lieutenant",
      "2": "Captain",
      "3": "Major [Tactics]",
      "4": "Lt Colonel",
      "5": "Colonel",
      "6": "Brigadier"
    },
    "Maritime Defense": {
      "0": "Seaman [Watercraft*]",
      "1": "Ensign",
      "2": "Lieutenant",
      "3": "Lt Commander [Leadership]",
      "4": "Commander",
      "5": "Captain",
      "6": "Admiral"
    },
    "Mercenary": {
      "0": "Private [Gun Combat*]",
      "1": "Lieutenant",
      "2": "Captain",
      "3": "Major [Tactics]",
      "4": "Lt Colonel",
      "5": "Colonel",
      "6": "Brigadier"
    },
    "Merchant": {
      "0": "Crewman [Steward]",
      "1": "Deck Cadet",
      "2": "Fourth Officer",
      "3": "Third Officer [Piloting]",
      "4": "Second Officer",
      "5": "First Officer",
      "6": "Captain"
    },
    "Navy": {
      "0": "Starman [Zero-G]",
      "1": "Midshipman",
      "2": "Lieutenant",
      "3": "Lt Commander [Tactics]",
      "4": "Commander",
      "5": "Captain",
      "6": "Commodore"
    },
    "Noble": {
      "0": "Courtier [Carousing]",
      "1": "Knight",
      "2": "Baron",
      "3": "Marquis",
      "4": "Count [Advocate]",
      "5": "Duke",
      "6": "Archduke"
    },
    "Physician": {
      "0": "Intern [Medicine]",
      "1": "Resident",
      "2": "Senior Resident",
      "3": "Chief Resident",
      "4": "Attending Phys. [Admin]",
      "5": "Service Chief",
      "6": "Hospital Admin."
    },
    "Pirate": {
      "0": "Crewman [Gunnery*]",
      "1": "Corporal",
      "2": "Lieutenant [Piloting]",
      "3": "Lt Commander",
      "4": "Commander",
      "5": "Captain",
      "6": "Commodore"
    },
    "Rogue": {
      "0": "Independent [Streetwise]",
      "1": "Associate",
      "2": "Soldier [Gun Combat*]",
      "3": "Lieutenant",
      "4": "Underboss",
      "5": "Consigliere",
      "6": "Boss"
    },
    "Scientist": {
      "0": "Instructor [Sciences*]",
      "1": "Adjunct Professor",
      "2": "Research Professor",
      "3": "Assistant Professor [Computer]",
      "4": "Associate Professor",
      "5": "Professor",
      "6": "Distinguished Professor"
    },
    "Scout": {
      "0": "[Piloting]",
      "1": "-",
      "2": "-",
      "3": "-",
      "4": "-",
      "5": "-",
      "6": "-"
    },
    "Surface Defense": {
      "0": "Private [Gun Combat*]",
      "1": "Lieutenant",
      "2": "Captain",
      "3": "Major [Leadership]",
      "4": "Lt Colonel",
      "5": "Colonel",
      "6": "General"
    },
    "Technician": {
      "0": "Technician [Computer]",
      "1": "Team Lead",
      "2": "Supervisor",
      "3": "Manager",
      "4": "Director [Admin]",
      "5": "Vice-President",
      "6": "Executive Officer"
    }
  },
  "cashBenefits": {
    "Athlete": {
      "1": 2000,
      "2": 10000,
      "3": 20000,
      "4": 20000,
      "5": 50000,
      "6": 100000,
      "7": 100000
    },
    "Aerospace": {
      "1": 1000,
      "2": 5000,
      "3": 10000,
      "4": 10000,
      "5": 20000,
      "6": 50000,
      "7": 50000
    },
    "Agent": {
      "1": 1000,
      "2": 5000,
      "3": 10000,
      "4": 10000,
      "5": 20000,
      "6": 50000,
      "7": 50000
    },
    "Barbarian": {
      "1": 0,
      "2": 1000,
      "3": 2000,
      "4": 5000,
      "5": 5000,
      "6": 10000,
      "7": 10000
    },
    "Belter": {
      "1": 1000,
      "2": 5000,
      "3": 5000,
      "4": 5000,
      "5": 10000,
      "6": 20000,
      "7": 50000
    },
    "Bureaucrat": {
      "1": 1000,
      "2": 5000,
      "3": 10000,
      "4": 10000,
      "5": 20000,
      "6": 50000,
      "7": 50000
    },
    "Colonist": {
      "1": 1000,
      "2": 5000,
      "3": 5000,
      "4": 5000,
      "5": 10000,
      "6": 20000,
      "7": 50000
    },
    "Diplomat": {
      "1": 1000,
      "2": 5000,
      "3": 10000,
      "4": 20000,
      "5": 20000,
      "6": 50000,
      "7": 100000
    },
    "Drifter": {
      "1": 0,
      "2": 1000,
      "3": 2000,
      "4": 5000,
      "5": 5000,
      "6": 10000,
      "7": 10000
    },
    "Entertainer": {
      "1": 2000,
      "2": 10000,
      "3": 20000,
      "4": 20000,
      "5": 50000,
      "6": 100000,
      "7": 100000
    },
    "Hunter": {
      "1": 1000,
      "2": 5000,
      "3": 10000,
      "4": 20000,
      "5": 20000,
      "6": 50000,
      "7": 100000
    },
    "Marine": {
      "1": 1000,
      "2": 5000,
      "3": 10000,
      "4": 10000,
      "5": 20000,
      "6": 50000,
      "7": 50000
    },
    "Maritime Defense": {
      "1": 1000,
      "2": 5000,
      "3": 10000,
      "4": 10000,
      "5": 20000,
      "6": 50000,
      "7": 50000
    },
    "Mercenary": {
      "1": 1000,
      "2": 5000,
      "3": 10000,
      "4": 20000,
      "5": 20000,
      "6": 50000,
      "7": 100000
    },
    "Merchant": {
      "1": 1000,
      "2": 5000,
      "3": 10000,
      "4": 20000,
      "5": 20000,
      "6": 50000,
      "7": 100000
    },
    "Navy": {
      "1": 1000,
      "2": 5000,
      "3": 10000,
      "4": 10000,
      "5": 20000,
      "6": 50000,
      "7": 50000
    },
    "Noble": {
      "1": 2000,
      "2": 10000,
      "3": 20000,
      "4": 20000,
      "5": 50000,
      "6": 100000,
      "7": 100000
    },
    "Physician": {
      "1": 2000,
      "2": 10000,
      "3": 20000,
      "4": 20000,
      "5": 50000,
      "6": 100000,
      "7": 100000
    },
    "Pirate": {
      "1": 1000,
      "2": 5000,
      "3": 10000,
      "4": 20000,
      "5": 20000,
      "6": 50000,
      "7": 100000
    },
    "Rogue": {
      "1": 1000,
      "2": 5000,
      "3": 5000,
      "4": 5000,
      "5": 10000,
      "6": 20000,
      "7": 50000
    },
    "Scientist": {
      "1": 1000,
      "2": 5000,
      "3": 10000,
      "4": 10000,
      "5": 20000,
      "6": 50000,
      "7": 50000
    },
    "Scout": {
      "1": 1000,
      "2": 5000,
      "3": 10000,
      "4": 10000,
      "5": 20000,
      "6": 50000,
      "7": 50000
    },
    "Surface Defense": {
      "1": 1000,
      "2": 5000,
      "3": 10000,
      "4": 10000,
      "5": 20000,
      "6": 50000,
      "7": 50000
    },
    "Technician": {
      "1": 1000,
      "2": 5000,
      "3": 10000,
      "4": 10000,
      "5": 20000,
      "6": 50000,
      "7": 50000
    }
  },
  "materialBenefits": {
    "Athlete": {
      "1": "Low Passage",
      "2": "+1 Int",
      "3": "Weapon",
      "4": "High Passage",
      "5": "Explorers' Society",
      "6": "High Passage",
      "7": "-"
    },
    "Aerospace": {
      "1": "Low Passage",
      "2": "+1 Edu",
      "3": "Weapon",
      "4": "Mid Passage",
      "5": "Weapon",
      "6": "High Passage",
      "7": "+1 Soc"
    },
    "Agent": {
      "1": "Low Passage",
      "2": "+1 Int",
      "3": "Weapon",
      "4": "Mid Passage",
      "5": "+1 Soc",
      "6": "High Passage",
      "7": "Explorers' Society"
    },
    "Barbarian": {
      "1": "Low Passage",
      "2": "+1 Int",
      "3": "Weapon",
      "4": "Weapon",
      "5": "+1 End",
      "6": "Mid Passage",
      "7": "-"
    },
    "Belter": {
      "1": "Low Passage",
      "2": "+1 Int",
      "3": "Weapon",
      "4": "Mid Passage",
      "5": "1D6  Ship Shares",
      "6": "High Passage",
      "7": "-"
    },
    "Bureaucrat": {
      "1": "Low Passage",
      "2": "+1 Edu",
      "3": "+1 Int",
      "4": "Mid Passage",
      "5": "Mid  Passage",
      "6": "High Passage",
      "7": "+1 Soc"
    },
    "Colonist": {
      "1": "Low Passage",
      "2": "+1 Int",
      "3": "Weapon",
      "4": "Mid Passage",
      "5": "Mid  Passage",
      "6": "High Passage",
      "7": "+1 Soc"
    },
    "Diplomat": {
      "1": "Low Passage",
      "2": "+1 Edu",
      "3": "Mid  Passage",
      "4": "High Passage",
      "5": "+1 Soc",
      "6": "High Passage",
      "7": "Explorers' Society"
    },
    "Drifter": {
      "1": "Low Passage",
      "2": "+1 Int",
      "3": "Weapon",
      "4": "Weapon",
      "5": "Mid Passage",
      "6": "Mid Passage",
      "7": "-"
    },
    "Entertainer": {
      "1": "Low Passage",
      "2": "+1 Edu",
      "3": "+1 Soc",
      "4": "High Passage",
      "5": "Explorers' Society",
      "6": "High Passage",
      "7": "-"
    },
    "Hunter": {
      "1": "Low Passage",
      "2": "+1 Int",
      "3": "Weapon",
      "4": "High Passage",
      "5": "1D6  Ship Shares",
      "6": "High Passage",
      "7": "-"
    },
    "Marine": {
      "1": "Low Passage",
      "2": "+1 Edu",
      "3": "Weapon",
      "4": "Mid Passage",
      "5": "+1 Soc",
      "6": "High Passage",
      "7": "Explorers' Society"
    },
    "Maritime Defense": {
      "1": "Low Passage",
      "2": "+1 Edu",
      "3": "Weapon",
      "4": "Mid  Passage",
      "5": "Weapon",
      "6": "High Passage",
      "7": "+1 Soc"
    },
    "Mercenary": {
      "1": "Low Passage",
      "2": "+1 Int",
      "3": "Weapon",
      "4": "High  Passage",
      "5": "+1 Soc",
      "6": "High Passage",
      "7": "1D6  Ship Shares"
    },
    "Merchant": {
      "1": "Low Passage",
      "2": "+1 Edu",
      "3": "Weapon",
      "4": "High  Passage",
      "5": "1D6  Ship Shares",
      "6": "High Passage",
      "7": "Explorers' Society"
    },
    "Navy": {
      "1": "Low Passage",
      "2": "+1 Edu",
      "3": "Weapon",
      "4": "Mid  Passage",
      "5": "+1 Soc",
      "6": "High Passage",
      "7": "Explorers' Society"
    },
    "Noble": {
      "1": "High Passage",
      "2": "+1 Edu",
      "3": "+1 Int",
      "4": "High  Passage",
      "5": "Explorers' Society",
      "6": "High Passage",
      "7": "1D6 Ship Shares"
    },
    "Physician": {
      "1": "Low Passage",
      "2": "+1 Edu",
      "3": "+1 Int",
      "4": "High  Passage",
      "5": "Explorers' Society",
      "6": "High Passage",
      "7": "+1 Soc"
    },
    "Pirate": {
      "1": "Low Passage",
      "2": "+1 Int",
      "3": "Weapon",
      "4": "High  Passage",
      "5": "+1 Soc",
      "6": "High Passage",
      "7": "1D6  Ship Shares"
    },
    "Rogue": {
      "1": "Low Passage",
      "2": "+1 Int",
      "3": "Weapon",
      "4": "Mid  Passage",
      "5": "Weapon",
      "6": "High Passage",
      "7": "+1 Soc"
    },
    "Scientist": {
      "1": "Low Passage",
      "2": "+1 Edu",
      "3": "+1 Int",
      "4": "Mid  Passage",
      "5": "+1 Soc",
      "6": "High Passage",
      "7": "Research Vessel"
    },
    "Scout": {
      "1": "Low Passage",
      "2": "+1 Edu",
      "3": "Weapon",
      "4": "Mid  Passage",
      "5": "Explorers' Society",
      "6": "Courier Vessel",
      "7": "-"
    },
    "Surface Defense": {
      "1": "Low Passage",
      "2": "+1 Int",
      "3": "Weapon",
      "4": "Mid  Passage",
      "5": "Weapon",
      "6": "High Passage",
      "7": "+1 Soc"
    },
    "Technician": {
      "1": "Low Passage",
      "2": "+1 Edu",
      "3": "+1 Int",
      "4": "Mid  Passage",
      "5": "Mid  Passage",
      "6": "High Passage",
      "7": "+1 Soc"
    }
  },
  "primaryEducationSkillsData": [
    "Admin",
    "Advocate",
    "Animals*",
    "Carousing",
    "Comms",
    "Computer",
    "Electronics",
    "Engineering",
    "Life Sciences",
    "Linguistics",
    "Mechanics",
    "Medicine",
    "Physical Sciences",
    "Social Sciences",
    "Space Sciences"
  ],
  "homeWorldSkillsByLawLevel": {
    "No Law": "Gun Combat*",
    "Low Law": "Gun Combat*",
    "Medium Law": "Gun Combat*",
    "High Law": "Melee Combat*"
  },
  "homeWorldSkillsByTradeCode": {
    "Agricultural": "Animals*",
    "Asteroid": "Zero-G",
    "Desert": "Survival",
    "Fluid Oceans": "Watercraft*",
    "Garden": "Animals*",
    "High Technology": "Computer",
    "High Population": "Streetwise",
    "Ice-Capped": "Zero-G",
    "Industrial": "Broker",
    "Low Technology": "Survival",
    "Poor": "Animals*",
    "Rich": "Carousing",
    "Water World": "Watercraft*",
    "Vacuum": "Zero-G"
  },
  "cascadeSkills": {
    "Aircraft": [
      "Grav Vehicle",
      "Rotor Aircraft",
      "Winged Aircraft"
    ],
    "Animals": [
      "Farming",
      "Riding",
      "Survival",
      "Veterinary Medicine"
    ],
    "Gun Combat": [
      "Archery",
      "Energy Pistol",
      "Energy Rifle",
      "Shotgun",
      "Slug Pistol",
      "Slug Rifle"
    ],
    "Gunnery": [
      "Bay Weapons",
      "Heavy Weapons",
      "Screens",
      "Spinal Mounts",
      "Turret Weapons"
    ],
    "Melee Combat": [
      "Natural Weapons",
      "Bludgeoning Weapons",
      "Piercing Weapons",
      "Slashing Weapons"
    ],
    "Sciences": [
      "Life Sciences",
      "Physical Sciences",
      "Social Sciences",
      "Space Sciences"
    ],
    "Vehicle": [
      "Aircraft*",
      "Mole",
      "Tracked Vehicle",
      "Watercraft*",
      "Wheeled Vehicle"
    ],
    "Watercraft": [
      "Motorboats",
      "Ocean Ships",
      "Sailing Ships",
      "Submarine"
    ],
    "Weapon": [
      "Gun Combat*",
      "Melee Combat*"
    ]
  },
  "theDraft": [
    "Aerospace",
    "Marine",
    "Maritime Defense",
    "Navy",
    "Scout",
    "Surface Defense"
  ],
  "aging": [
    {
      "Roll": "-6",
      "Effects": "Reduce three physical characteristics by 2, reduce one mental characteristic by 1",
      "Changes": [
        {
          "type": "PHYSICAL",
          "modifier": -2
        },
        {
          "type": "PHYSICAL",
          "modifier": -2
        },
        {
          "type": "PHYSICAL",
          "modifier": -2
        },
        {
          "type": "MENTAL",
          "modifier": -1
        }
      ]
    },
    {
      "Roll": "-5",
      "Effects": "Reduce three physical characteristics by 2.",
      "Changes": [
        {
          "type": "PHYSICAL",
          "modifier": -2
        },
        {
          "type": "PHYSICAL",
          "modifier": -2
        },
        {
          "type": "PHYSICAL",
          "modifier": -2
        }
      ]
    },
    {
      "Roll": "-4",
      "Effects": "Reduce two physical characteristics by 2, reduce one physical characteristic by 1",
      "Changes": [
        {
          "type": "PHYSICAL",
          "modifier": -2
        },
        {
          "type": "PHYSICAL",
          "modifier": -2
        },
        {
          "type": "PHYSICAL",
          "modifier": -1
        }
      ]
    },
    {
      "Roll": "-3",
      "Effects": "Reduce one physical characteristic by 2, reduce two physical characteristic by 1",
      "Changes": [
        {
          "type": "PHYSICAL",
          "modifier": -2
        },
        {
          "type": "PHYSICAL",
          "modifier": -1
        },
        {
          "type": "PHYSICAL",
          "modifier": -1
        }
      ]
    },
    {
      "Roll": "-2",
      "Effects": "Reduce three physical characteristics by 1",
      "Changes": [
        {
          "type": "PHYSICAL",
          "modifier": -1
        },
        {
          "type": "PHYSICAL",
          "modifier": -1
        },
        {
          "type": "PHYSICAL",
          "modifier": -1
        }
      ]
    },
    {
      "Roll": "-1",
      "Effects": "Reduce two physical characteristics by 1",
      "Changes": [
        {
          "type": "PHYSICAL",
          "modifier": -1
        },
        {
          "type": "PHYSICAL",
          "modifier": -1
        }
      ]
    },
    {
      "Roll": "0",
      "Effects": "Reduce one physical characteristic by 1",
      "Changes": [
        {
          "type": "PHYSICAL",
          "modifier": -1
        }
      ]
    },
    {
      "Roll": "1",
      "Effects": "No effect",
      "Changes": []
    }
  ]
} as const

const tableValues = (table: Record<string, string>): string[] =>
  ROLL_TABLE_KEYS.map((key) => table[key])

export const CEPHEUS_SRD_RULESET =
  RAW_CEPHEUS_SRD_RULESET as unknown as CepheusSrdRuleset

const PREFERRED_CAREER_ORDER = [
  'Scout',
  'Merchant',
  'Marine',
  'Navy',
  'Belter',
  'Agent',
  'Aerospace',
  'Mercenary',
  'Physician',
  'Rogue',
  'Technician',
  'Drifter'
] as const

const careerNames = [
  ...PREFERRED_CAREER_ORDER,
  ...Object.keys(CEPHEUS_SRD_RULESET.careerBasics).filter(
    (name) => !(PREFERRED_CAREER_ORDER as readonly string[]).includes(name)
  )
]

export const CEPHEUS_SRD_CAREERS: CepheusCareerDefinition[] = careerNames.map((name) => {
  const basics = CEPHEUS_SRD_RULESET.careerBasics[name]

  return {
    name,
    qualification: basics.Qualifications,
    survival: basics.Survival,
    commission: basics.Commission,
    advancement: basics.Advancement,
    serviceSkills: tableValues(CEPHEUS_SRD_RULESET.serviceSkills[name]),
    specialistSkills: tableValues(CEPHEUS_SRD_RULESET.specialistSkills[name]),
    personalDevelopment: tableValues(
      CEPHEUS_SRD_RULESET.personalDevelopment[name]
    ),
    advancedEducation: tableValues(CEPHEUS_SRD_RULESET.advEducation[name])
  }
})
