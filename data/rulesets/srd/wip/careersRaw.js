const careerBasicsRaw = Object.freeze([
  {
    Career: 'Qualifications',
    Athlete: 'End 8+',
    Aerospace: 'End 5+',
    Agent: 'Soc 6+',
    Barbarian: 'End 5+',
    Belter: 'Int 4+',
    Bureaucrat: 'Soc 6+'
  },
  {
    Career: 'Survival',
    Athlete: 'Dex 5+',
    Aerospace: 'Dex 5+',
    Agent: 'Int 6+',
    Barbarian: 'Str 6+',
    Belter: 'Dex 7+',
    Bureaucrat: 'Edu 4+'
  },
  {
    Career: 'Commission',
    Athlete: '-',
    Aerospace: 'Edu 6+',
    Agent: 'Edu 7+',
    Barbarian: '-',
    Belter: '-',
    Bureaucrat: 'Soc 5+'
  },
  {
    Career: 'Advancement',
    Athlete: '-',
    Aerospace: 'Edu 7+',
    Agent: 'Edu 6+',
    Barbarian: '-',
    Belter: '-',
    Bureaucrat: 'Int 8+'
  },
  {
    Career: 'ReEnlistment',
    Athlete: '6+',
    Aerospace: '5+',
    Agent: '6+',
    Barbarian: '5+',
    Belter: '5+',
    Bureaucrat: '5+'
  },
  {
    Career: 'Qualifications',
    Colonist: 'End 5+',
    Diplomat: 'Soc 6+',
    Drifter: 'Dex 5+',
    Entertainer: 'Soc 8+',
    Hunter: 'End 5+',
    Marine: 'Int 6+'
  },
  {
    Career: 'Survival',
    Colonist: 'End 6+',
    Diplomat: 'Edu 5+',
    Drifter: 'End 5+',
    Entertainer: 'Int 4+',
    Hunter: 'Str 8+',
    Marine: 'End 6+'
  },
  {
    Career: 'Commission',
    Colonist: 'Int 7+',
    Diplomat: 'Int 7+',
    Drifter: '-',
    Entertainer: '-',
    Hunter: '-',
    Marine: 'Edu 6+'
  },
  {
    Career: 'Advancement',
    Colonist: 'Edu 6+',
    Diplomat: 'Soc 7+',
    Drifter: '-',
    Entertainer: '-',
    Hunter: '-',
    Marine: 'Soc 7+'
  },
  {
    Career: 'ReEnlistment',
    Colonist: '5+',
    Diplomat: '5+',
    Drifter: '5+',
    Entertainer: '6+',
    Hunter: '6+',
    Marine: '6+'
  },
  {
    Career: 'Qualifications',
    'Maritime Defense': 'End 5+',
    Mercenary: 'Int 4+',
    Merchant: 'Int 4+',
    Navy: 'Int 6+',
    Noble: 'Soc 8+',
    Physician: 'Edu 6+'
  },
  {
    Career: 'Survival',
    'Maritime Defense': 'End 5+',
    Mercenary: 'End 6+',
    Merchant: 'Int 5+',
    Navy: 'Int 5+',
    Noble: 'Soc 4+',
    Physician: 'Int 4+'
  },
  {
    Career: 'Commission',
    'Maritime Defense': 'Int 6+',
    Mercenary: 'Int 7+',
    Merchant: 'Int 5+',
    Navy: 'Soc 7+',
    Noble: 'Edu 5+',
    Physician: 'Int 5+'
  },
  {
    Career: 'Advancement',
    'Maritime Defense': 'Edu 7+',
    Mercenary: 'Int 6+',
    Merchant: 'Edu 8+',
    Navy: 'Edu 6+',
    Noble: 'Int 8+',
    Physician: 'Edu 8+'
  },
  {
    Career: 'ReEnlistment',
    'Maritime Defense': '5+',
    Mercenary: '5+',
    Merchant: '4+',
    Navy: '5+',
    Noble: '6+',
    Physician: '5+'
  },
  {
    Career: 'Qualifications',
    Pirate: 'Dex 5+',
    Rogue: 'Dex 5+',
    Scientist: 'Edu 6+',
    Scout: 'Int 6+',
    'Surface Defense': 'End 5+',
    Technician: 'Edu 6+'
  },
  {
    Career: 'Survival',
    Pirate: 'Dex 6+',
    Rogue: 'Dex 4+',
    Scientist: 'Edu 5+',
    Scout: 'End 7+',
    'Surface Defense': 'Edu 5+',
    Technician: 'Dex 4+'
  },
  {
    Career: 'Commission',
    Pirate: 'Str 7+',
    Rogue: 'Str 6+',
    Scientist: 'Int 7+',
    Scout: '-',
    'Surface Defense': 'End 6+',
    Technician: 'Edu 5+'
  },
  {
    Career: 'Advancement',
    Pirate: 'Int 6+',
    Rogue: 'Int 7+',
    Scientist: 'Int 6+',
    Scout: '-',
    'Surface Defense': 'Edu 7+',
    Technician: 'Int 8+'
  },
  {
    Career: 'ReEnlistment',
    Pirate: '5+',
    Rogue: '4+',
    Scientist: '5+',
    Scout: '6+',
    'Surface Defense': '5+',
    Technician: '5+'
  }
])

const ranksAndSkillsRaw = Object.freeze([
  {
    'Ranks and Skills': 0,
    Athlete: '[Athletics-1]',
    Aerospace: 'Airman [Aircraft-1]',
    Agent: 'Agent [Streetwise-1]',
    Barbarian: '[Melee Combat-1]',
    Belter: '[Zero-G-1]',
    Bureaucrat: 'Assistant [Admin-1]'
  },
  {
    'Ranks and Skills': 1,
    Athlete: '-',
    Aerospace: 'Flight Officer',
    Agent: 'Special Agent',
    Barbarian: '-',
    Belter: '-',
    Bureaucrat: 'Clerk'
  },
  {
    'Ranks and Skills': 2,
    Athlete: '-',
    Aerospace: 'Flight Lieutenant',
    Agent: 'Sp Agent in Charge',
    Barbarian: '-',
    Belter: '-',
    Bureaucrat: 'Supervisor'
  },
  {
    'Ranks and Skills': 3,
    Athlete: '-',
    Aerospace: 'Squadron Leader [Leadership-1]',
    Agent: 'Unit Chief',
    Barbarian: '-',
    Belter: '-',
    Bureaucrat: 'Manager'
  },
  {
    'Ranks and Skills': 4,
    Athlete: '-',
    Aerospace: 'Wing Commander',
    Agent: 'Section Chief [Admin-1]',
    Barbarian: '-',
    Belter: '-',
    Bureaucrat: 'Chief [Advocate-1]'
  },
  {
    'Ranks and Skills': 5,
    Athlete: '-',
    Aerospace: 'Group Captain',
    Agent: 'Assistant Directory',
    Barbarian: '-',
    Belter: '-',
    Bureaucrat: 'Director'
  },
  {
    'Ranks and Skills': 6,
    Athlete: '-',
    Aerospace: 'Air Commodore',
    Agent: 'Director',
    Barbarian: '-',
    Belter: '-',
    Bureaucrat: 'Minister'
  },
  {
    'Ranks and Skills': 0,
    Colonist: 'Citizen [Survival-1]',
    Diplomat: 'Attaché [Liaison-1]',
    Drifter: '-',
    Entertainer: '[Carousing-1]',
    Hunter: '[Survival-1]',
    Marine: 'Trooper [Zero-G-1]'
  },
  {
    'Ranks and Skills': 1,
    Colonist: 'District Leader',
    Diplomat: 'Third Secretary',
    Drifter: '-',
    Entertainer: '-',
    Hunter: '-',
    Marine: 'Lieutenant'
  },
  {
    'Ranks and Skills': 2,
    Colonist: 'District Delegate',
    Diplomat: 'Second Secretary',
    Drifter: '-',
    Entertainer: '-',
    Hunter: '-',
    Marine: 'Captain'
  },
  {
    'Ranks and Skills': 3,
    Colonist: 'Council Advisor [Liaison-1]',
    Diplomat: 'First Secretary [Admin-1]',
    Drifter: '-',
    Entertainer: '-',
    Hunter: '-',
    Marine: 'Major [Tactics-1]'
  },
  {
    'Ranks and Skills': 4,
    Colonist: 'Councilor',
    Diplomat: 'Counselor',
    Drifter: '-',
    Entertainer: '-',
    Hunter: '-',
    Marine: 'Lt Colonel'
  },
  {
    'Ranks and Skills': 5,
    Colonist: 'Lieutenant Governor',
    Diplomat: 'Minister',
    Drifter: '-',
    Entertainer: '-',
    Hunter: '-',
    Marine: 'Colonel'
  },
  {
    'Ranks and Skills': 6,
    Colonist: 'Governor',
    Diplomat: 'Ambassador',
    Drifter: '-',
    Entertainer: '-',
    Hunter: '-',
    Marine: 'Brigadier'
  },
  {
    'Ranks and Skills': 0,
    'Maritime Defense': 'Seaman [Watercraft-1]',
    Mercenary: 'Private [Gun Combat-1]',
    Merchant: 'Crewman [Steward-1]',
    Navy: 'Starman [Zero-G-1]',
    Noble: 'Courtier [Carousing-1]',
    Physician: 'Intern [Medicine-1]'
  },
  {
    'Ranks and Skills': 1,
    'Maritime Defense': 'Ensign',
    Mercenary: 'Lieutenant',
    Merchant: 'Deck Cadet',
    Navy: 'Midshipman',
    Noble: 'Knight',
    Physician: 'Resident'
  },
  {
    'Ranks and Skills': 2,
    'Maritime Defense': 'Lieutenant',
    Mercenary: 'Captain',
    Merchant: 'Fourth Officer',
    Navy: 'Lieutenant',
    Noble: 'Baron',
    Physician: 'Senior Resident'
  },
  {
    'Ranks and Skills': 3,
    'Maritime Defense': 'Lt Commander [Leadership-1]',
    Mercenary: 'Major [Tactics-1]',
    Merchant: 'Third Officer [Piloting-1]',
    Navy: 'Lt Commander [Tactics-1]',
    Noble: 'Marquis',
    Physician: 'Chief Resident'
  },
  {
    'Ranks and Skills': 4,
    'Maritime Defense': 'Commander',
    Mercenary: 'Lt Colonel',
    Merchant: 'Second Officer',
    Navy: 'Commander',
    Noble: 'Count [Advocate-1]',
    Physician: 'Attending Phys. [Admin-1]'
  },
  {
    'Ranks and Skills': 5,
    'Maritime Defense': 'Captain',
    Mercenary: 'Colonel',
    Merchant: 'First Officer',
    Navy: 'Captain',
    Noble: 'Duke',
    Physician: 'Service Chief'
  },
  {
    'Ranks and Skills': 6,
    'Maritime Defense': 'Admiral',
    Mercenary: 'Brigadier',
    Merchant: 'Captain',
    Navy: 'Commodore',
    Noble: 'Archduke',
    Physician: 'Hospital Admin.'
  },
  {
    'Ranks and Skills': 0,
    Pirate: 'Crewman [Gunnery-1]',
    Rogue: 'Independent [Streetwise-1]',
    Scientist: 'Instructor [Sciences-1]',
    Scout: '[Piloting-1]',
    'Surface Defense': 'Private [Gun Combat-1]',
    Technician: 'Technician [Computer-1]'
  },
  {
    'Ranks and Skills': 1,
    Pirate: 'Corporal',
    Rogue: 'Associate',
    Scientist: 'Adjunct Professor',
    Scout: '-',
    'Surface Defense': 'Lieutenant',
    Technician: 'Team Lead'
  },
  {
    'Ranks and Skills': 2,
    Pirate: 'Lieutenant [Piloting-1]',
    Rogue: 'Soldier [Gun Combat-1]',
    Scientist: 'Research Professor',
    Scout: '-',
    'Surface Defense': 'Captain',
    Technician: 'Supervisor'
  },
  {
    'Ranks and Skills': 3,
    Pirate: 'Lt Commander',
    Rogue: 'Lieutenant',
    Scientist: 'Assistant Professor [Computer-1]',
    Scout: '-',
    'Surface Defense': 'Major [Leadership-1]',
    Technician: 'Manager'
  },
  {
    'Ranks and Skills': 4,
    Pirate: 'Commander',
    Rogue: 'Underboss',
    Scientist: 'Associate Professor',
    Scout: '-',
    'Surface Defense': 'Lt Colonel',
    Technician: 'Director [Admin-1]'
  },
  {
    'Ranks and Skills': 5,
    Pirate: 'Captain',
    Rogue: 'Consigliere',
    Scientist: 'Professor',
    Scout: '-',
    'Surface Defense': 'Colonel',
    Technician: 'Vice-President'
  },
  {
    'Ranks and Skills': 6,
    Pirate: 'Commodore',
    Rogue: 'Boss',
    Scientist: 'Distinguished Professor',
    Scout: '-',
    'Surface Defense': 'General',
    Technician: 'Executive Officer'
  }
])

const materialBenefitsRaw = Object.freeze([
  {
    'Material Benefits': 1,
    Athlete: 'Low Passage',
    Aerospace: 'Low Passage',
    Agent: 'Low Passage',
    Barbarian: 'Low Passage',
    Belter: 'Low Passage',
    Bureaucrat: 'Low Passage'
  },
  {
    'Material Benefits': 2,
    Athlete: '+1 Int',
    Aerospace: '+1 Edu',
    Agent: '+1 Int',
    Barbarian: '+1 Int',
    Belter: '+1 Int',
    Bureaucrat: '+1 Edu'
  },
  {
    'Material Benefits': 3,
    Athlete: 'Weapon',
    Aerospace: 'Weapon',
    Agent: 'Weapon',
    Barbarian: 'Weapon',
    Belter: 'Weapon',
    Bureaucrat: '+1 Int'
  },
  {
    'Material Benefits': 4,
    Athlete: 'High Passage',
    Aerospace: 'Mid Passage',
    Agent: 'Mid Passage',
    Barbarian: 'Weapon',
    Belter: 'Mid Passage',
    Bureaucrat: 'Mid Passage'
  },
  {
    'Material Benefits': 5,
    Athlete: "Explorers' Society",
    Aerospace: 'Weapon',
    Agent: '+1 Soc',
    Barbarian: '+1 End',
    Belter: '1D6  Ship Shares',
    Bureaucrat: 'Mid  Passage'
  },
  {
    'Material Benefits': 6,
    Athlete: 'High Passage',
    Aerospace: 'High Passage',
    Agent: 'High Passage',
    Barbarian: 'Mid Passage',
    Belter: 'High Passage',
    Bureaucrat: 'High Passage'
  },
  {
    'Material Benefits': 7,
    Athlete: '-',
    Aerospace: '+1 Soc',
    Agent: "Explorers' Society",
    Barbarian: '-',
    Belter: '-',
    Bureaucrat: '+1 Soc'
  },
  {
    'Material Benefits': 1,
    Colonist: 'Low Passage',
    Diplomat: 'Low Passage',
    Drifter: 'Low Passage',
    Entertainer: 'Low Passage',
    Hunter: 'Low Passage',
    Marine: 'Low Passage'
  },
  {
    'Material Benefits': 2,
    Colonist: '+1 Int',
    Diplomat: '+1 Edu',
    Drifter: '+1 Int',
    Entertainer: '+1 Edu',
    Hunter: '+1 Int',
    Marine: '+1 Edu'
  },
  {
    'Material Benefits': 3,
    Colonist: 'Weapon',
    Diplomat: 'Mid  Passage',
    Drifter: 'Weapon',
    Entertainer: '+1 Soc',
    Hunter: 'Weapon',
    Marine: 'Weapon'
  },
  {
    'Material Benefits': 4,
    Colonist: 'Mid Passage',
    Diplomat: 'High Passage',
    Drifter: 'Weapon',
    Entertainer: 'High Passage',
    Hunter: 'High Passage',
    Marine: 'Mid Passage'
  },
  {
    'Material Benefits': 5,
    Colonist: 'Mid  Passage',
    Diplomat: '+1 Soc',
    Drifter: 'Mid Passage',
    Entertainer: "Explorers' Society",
    Hunter: '1D6  Ship Shares',
    Marine: '+1 Soc'
  },
  {
    'Material Benefits': 6,
    Colonist: 'High Passage',
    Diplomat: 'High Passage',
    Drifter: 'Mid Passage',
    Entertainer: 'High Passage',
    Hunter: 'High Passage',
    Marine: 'High Passage'
  },
  {
    'Material Benefits': 7,
    Colonist: '+1 Soc',
    Diplomat: "Explorers' Society",
    Drifter: '-',
    Entertainer: '-',
    Hunter: '-',
    Marine: "Explorers' Society"
  },
  {
    'Material Benefits': 1,
    'Maritime Defense': 'Low Passage',
    Mercenary: 'Low Passage',
    Merchant: 'Low Passage',
    Navy: 'Low Passage',
    Noble: 'High Passage',
    Physician: 'Low Passage'
  },
  {
    'Material Benefits': 2,
    'Maritime Defense': '+1 Edu',
    Mercenary: '+1 Int',
    Merchant: '+1 Edu',
    Navy: '+1 Edu',
    Noble: '+1 Edu',
    Physician: '+1 Edu'
  },
  {
    'Material Benefits': 3,
    'Maritime Defense': 'Weapon',
    Mercenary: 'Weapon',
    Merchant: 'Weapon',
    Navy: 'Weapon',
    Noble: '+1 Int',
    Physician: '+1 Int'
  },
  {
    'Material Benefits': 4,
    'Maritime Defense': 'Mid  Passage',
    Mercenary: 'High  Passage',
    Merchant: 'High  Passage',
    Navy: 'Mid  Passage',
    Noble: 'High  Passage',
    Physician: 'High  Passage'
  },
  {
    'Material Benefits': 5,
    'Maritime Defense': 'Weapon',
    Mercenary: '+1 Soc',
    Merchant: '1D6  Ship Shares',
    Navy: '+1 Soc',
    Noble: "Explorers' Society",
    Physician: "Explorers' Society"
  },
  {
    'Material Benefits': 6,
    'Maritime Defense': 'High Passage',
    Mercenary: 'High Passage',
    Merchant: 'High Passage',
    Navy: 'High Passage',
    Noble: 'High Passage',
    Physician: 'High Passage'
  },
  {
    'Material Benefits': 7,
    'Maritime Defense': '+1 Soc',
    Mercenary: '1D6  Ship Shares',
    Merchant: "Explorers' Society",
    Navy: "Explorers' Society",
    Noble: '1D6 Ship Shares',
    Physician: '+1 Soc'
  },
  {
    'Material Benefits': 1,
    Pirate: 'Low Passage',
    Rogue: 'Low Passage',
    Scientist: 'Low Passage',
    Scout: 'Low Passage',
    'Surface Defense': 'Low Passage',
    Technician: 'Low Passage'
  },
  {
    'Material Benefits': 2,
    Pirate: '+1 Int',
    Rogue: '+1 Int',
    Scientist: '+1 Edu',
    Scout: '+1 Edu',
    'Surface Defense': '+1 Int',
    Technician: '+1 Edu'
  },
  {
    'Material Benefits': 3,
    Pirate: 'Weapon',
    Rogue: 'Weapon',
    Scientist: '+1 Int',
    Scout: 'Weapon',
    'Surface Defense': 'Weapon',
    Technician: '+1 Int'
  },
  {
    'Material Benefits': 4,
    Pirate: 'High  Passage',
    Rogue: 'Mid  Passage',
    Scientist: 'Mid  Passage',
    Scout: 'Mid  Passage',
    'Surface Defense': 'Mid  Passage',
    Technician: 'Mid  Passage'
  },
  {
    'Material Benefits': 5,
    Pirate: '+1 Soc',
    Rogue: 'Weapon',
    Scientist: '+1 Soc',
    Scout: "Explorers' Society",
    'Surface Defense': 'Weapon',
    Technician: 'Mid  Passage'
  },
  {
    'Material Benefits': 6,
    Pirate: 'High Passage',
    Rogue: 'High Passage',
    Scientist: 'High Passage',
    Scout: 'Courier Vessel',
    'Surface Defense': 'High Passage',
    Technician: 'High Passage'
  },
  {
    'Material Benefits': 7,
    Pirate: '1D6  Ship Shares',
    Rogue: '+1 Soc',
    Scientist: 'Research Vessel',
    Scout: '-',
    'Surface Defense': '+1 Soc',
    Technician: '+1 Soc'
  }
])

const cashBenefitsRaw = Object.freeze([
  {
    'Cash Benefits': 1,
    Athlete: 2000,
    Aerospace: 1000,
    Agent: 1000,
    Barbarian: 0,
    Belter: 1000,
    Bureaucrat: 1000
  },
  {
    'Cash Benefits': 2,
    Athlete: 10000,
    Aerospace: 5000,
    Agent: 5000,
    Barbarian: 1000,
    Belter: 5000,
    Bureaucrat: 5000
  },
  {
    'Cash Benefits': 3,
    Athlete: 20000,
    Aerospace: 10000,
    Agent: 10000,
    Barbarian: 2000,
    Belter: 5000,
    Bureaucrat: 10000
  },
  {
    'Cash Benefits': 4,
    Athlete: 20000,
    Aerospace: 10000,
    Agent: 10000,
    Barbarian: 5000,
    Belter: 5000,
    Bureaucrat: 10000
  },
  {
    'Cash Benefits': 5,
    Athlete: 50000,
    Aerospace: 20000,
    Agent: 20000,
    Barbarian: 5000,
    Belter: 10000,
    Bureaucrat: 20000
  },
  {
    'Cash Benefits': 6,
    Athlete: 100000,
    Aerospace: 50000,
    Agent: 50000,
    Barbarian: 10000,
    Belter: 20000,
    Bureaucrat: 50000
  },
  {
    'Cash Benefits': 7,
    Athlete: 100000,
    Aerospace: 50000,
    Agent: 50000,
    Barbarian: 10000,
    Belter: 50000,
    Bureaucrat: 50000
  },
  {
    'Cash Benefits': 1,
    Colonist: 1000,
    Diplomat: 1000,
    Drifter: 0,
    Entertainer: 2000,
    Hunter: 1000,
    Marine: 1000
  },
  {
    'Cash Benefits': 2,
    Colonist: 5000,
    Diplomat: 5000,
    Drifter: 1000,
    Entertainer: 10000,
    Hunter: 5000,
    Marine: 5000
  },
  {
    'Cash Benefits': 3,
    Colonist: 5000,
    Diplomat: 10000,
    Drifter: 2000,
    Entertainer: 20000,
    Hunter: 10000,
    Marine: 10000
  },
  {
    'Cash Benefits': 4,
    Colonist: 5000,
    Diplomat: 20000,
    Drifter: 5000,
    Entertainer: 20000,
    Hunter: 20000,
    Marine: 10000
  },
  {
    'Cash Benefits': 5,
    Colonist: 10000,
    Diplomat: 20000,
    Drifter: 5000,
    Entertainer: 50000,
    Hunter: 20000,
    Marine: 20000
  },
  {
    'Cash Benefits': 6,
    Colonist: 20000,
    Diplomat: 50000,
    Drifter: 10000,
    Entertainer: 100000,
    Hunter: 50000,
    Marine: 50000
  },
  {
    'Cash Benefits': 7,
    Colonist: 50000,
    Diplomat: 100000,
    Drifter: 10000,
    Entertainer: 100000,
    Hunter: 100000,
    Marine: 50000
  },
  {
    'Cash Benefits': 1,
    'Maritime Defense': 1000,
    Mercenary: 1000,
    Merchant: 1000,
    Navy: 1000,
    Noble: 2000,
    Physician: 2000
  },
  {
    'Cash Benefits': 2,
    'Maritime Defense': 5000,
    Mercenary: 5000,
    Merchant: 5000,
    Navy: 5000,
    Noble: 10000,
    Physician: 10000
  },
  {
    'Cash Benefits': 3,
    'Maritime Defense': 10000,
    Mercenary: 10000,
    Merchant: 10000,
    Navy: 10000,
    Noble: 20000,
    Physician: 20000
  },
  {
    'Cash Benefits': 4,
    'Maritime Defense': 10000,
    Mercenary: 20000,
    Merchant: 20000,
    Navy: 10000,
    Noble: 20000,
    Physician: 20000
  },
  {
    'Cash Benefits': 5,
    'Maritime Defense': 20000,
    Mercenary: 20000,
    Merchant: 20000,
    Navy: 20000,
    Noble: 50000,
    Physician: 50000
  },
  {
    'Cash Benefits': 6,
    'Maritime Defense': 50000,
    Mercenary: 50000,
    Merchant: 50000,
    Navy: 50000,
    Noble: 100000,
    Physician: 100000
  },
  {
    'Cash Benefits': 7,
    'Maritime Defense': 50000,
    Mercenary: 100000,
    Merchant: 100000,
    Navy: 50000,
    Noble: 100000,
    Physician: 100000
  },
  {
    'Cash Benefits': 1,
    Pirate: 1000,
    Rogue: 1000,
    Scientist: 1000,
    Scout: 1000,
    'Surface Defense': 1000,
    Technician: 1000
  },
  {
    'Cash Benefits': 2,
    Pirate: 5000,
    Rogue: 5000,
    Scientist: 5000,
    Scout: 5000,
    'Surface Defense': 5000,
    Technician: 5000
  },
  {
    'Cash Benefits': 3,
    Pirate: 10000,
    Rogue: 5000,
    Scientist: 10000,
    Scout: 10000,
    'Surface Defense': 10000,
    Technician: 10000
  },
  {
    'Cash Benefits': 4,
    Pirate: 20000,
    Rogue: 5000,
    Scientist: 10000,
    Scout: 10000,
    'Surface Defense': 10000,
    Technician: 10000
  },
  {
    'Cash Benefits': 5,
    Pirate: 20000,
    Rogue: 10000,
    Scientist: 20000,
    Scout: 20000,
    'Surface Defense': 20000,
    Technician: 20000
  },
  {
    'Cash Benefits': 6,
    Pirate: 50000,
    Rogue: 20000,
    Scientist: 50000,
    Scout: 50000,
    'Surface Defense': 50000,
    Technician: 50000
  },
  {
    'Cash Benefits': 7,
    Pirate: 100000,
    Rogue: 50000,
    Scientist: 50000,
    Scout: 50000,
    'Surface Defense': 50000,
    Technician: 50000
  }
])

const personalDevelopmentRaw = Object.freeze([
  {
    'Personal Development': 1,
    Athlete: '+1 Dex',
    Aerospace: '+1 Str',
    Agent: '+1 Dex',
    Barbarian: '+1 Str',
    Belter: '+1 Str',
    Bureaucrat: '+1 Dex'
  },
  {
    'Personal Development': 2,
    Athlete: '+1 Int',
    Aerospace: '+1 Dex',
    Agent: '+1 End',
    Barbarian: '+1 Dex',
    Belter: '+1 Dex',
    Bureaucrat: '+1 End'
  },
  {
    'Personal Development': 3,
    Athlete: '+1 Edu',
    Aerospace: '+1 End',
    Agent: '+1 Int',
    Barbarian: '+1 End',
    Belter: '+1 End',
    Bureaucrat: '+1 Int'
  },
  {
    'Personal Development': 4,
    Athlete: '+1 Soc',
    Aerospace: 'Athletics',
    Agent: '+1 Edu',
    Barbarian: '+1 Int',
    Belter: 'Zero-G',
    Bureaucrat: '+1 Edu'
  },
  {
    'Personal Development': 5,
    Athlete: 'Carousing',
    Aerospace: 'Melee Combat',
    Agent: 'Athletics',
    Barbarian: 'Athletics',
    Belter: 'Melee Combat',
    Bureaucrat: 'Athletics'
  },
  {
    'Personal Development': 6,
    Athlete: 'Melee Combat',
    Aerospace: 'Vehicle',
    Agent: 'Carousing',
    Barbarian: 'Gun Combat',
    Belter: 'Gambling',
    Bureaucrat: 'Carousing'
  },
  {
    'Personal Development': 1,
    Colonist: '+1 Str',
    Diplomat: '+1 Dex',
    Drifter: '+1 Str',
    Entertainer: '+1 Dex',
    Hunter: '+1 Str',
    Marine: '+1 Str'
  },
  {
    'Personal Development': 2,
    Colonist: '+1 Dex',
    Diplomat: '+1 End',
    Drifter: '+1 Dex',
    Entertainer: '+1 Int',
    Hunter: '+1 Dex',
    Marine: '+1 Dex'
  },
  {
    'Personal Development': 3,
    Colonist: '+1 End',
    Diplomat: '+1 Int',
    Drifter: '+1 End',
    Entertainer: '+1 Edu',
    Hunter: '+1 End',
    Marine: '+1 End'
  },
  {
    'Personal Development': 4,
    Colonist: '+1 Int',
    Diplomat: '+1 Edu',
    Drifter: 'Melee Combat',
    Entertainer: '+1 Soc',
    Hunter: '+1 Int',
    Marine: '+1 Int'
  },
  {
    'Personal Development': 5,
    Colonist: 'Athletics',
    Diplomat: 'Athletics',
    Drifter: 'Bribery',
    Entertainer: 'Carousing',
    Hunter: 'Athletics',
    Marine: '+1 Edu'
  },
  {
    'Personal Development': 6,
    Colonist: 'Gun Combat',
    Diplomat: 'Carousing',
    Drifter: 'Gambling',
    Entertainer: 'Melee Combat',
    Hunter: 'Gun Combat',
    Marine: 'Melee Combat'
  },
  {
    'Personal Development': 1,
    'Maritime Defense': '+1 Str',
    Mercenary: '+1 Str',
    Merchant: '+1 Str',
    Navy: '+1 Str',
    Noble: '+1 Dex',
    Physician: '+1 Str'
  },
  {
    'Personal Development': 2,
    'Maritime Defense': '+1 Dex',
    Mercenary: '+1 Dex',
    Merchant: '+1 Dex',
    Navy: '+1 Dex',
    Noble: '+1 Int',
    Physician: '+1 Dex'
  },
  {
    'Personal Development': 3,
    'Maritime Defense': '+1 End',
    Mercenary: '+1 End',
    Merchant: '+1 End',
    Navy: '+1 End',
    Noble: '+1 Edu',
    Physician: '+1 End'
  },
  {
    'Personal Development': 4,
    'Maritime Defense': 'Athletics',
    Mercenary: 'Zero-G',
    Merchant: 'Zero-G',
    Navy: '+1 Int',
    Noble: '+1 Soc',
    Physician: '+1 Int'
  },
  {
    'Personal Development': 5,
    'Maritime Defense': 'Melee Combat',
    Mercenary: 'Melee Combat',
    Merchant: 'Melee Combat',
    Navy: '+1 Edu',
    Noble: 'Carousing',
    Physician: '+1 Edu'
  },
  {
    'Personal Development': 6,
    'Maritime Defense': 'Vehicle',
    Mercenary: 'Gambling',
    Merchant: 'Steward',
    Navy: 'Melee Combat',
    Noble: 'Melee Combat',
    Physician: 'Gun Combat'
  },
  {
    'Personal Development': 1,
    Pirate: '+1 Str',
    Rogue: '+1 Str',
    Scientist: '+1 Str',
    Scout: '+1 Str',
    'Surface Defense': '+1 Str',
    Technician: '+1 Str'
  },
  {
    'Personal Development': 2,
    Pirate: '+1 Dex',
    Rogue: '+1 Dex',
    Scientist: '+1 Dex',
    Scout: '+1 Dex',
    'Surface Defense': '+1 Dex',
    Technician: '+1 Dex'
  },
  {
    'Personal Development': 3,
    Pirate: '+1 End',
    Rogue: '+1 End',
    Scientist: '+1 End',
    Scout: '+1 End',
    'Surface Defense': '+1 End',
    Technician: '+1 End'
  },
  {
    'Personal Development': 4,
    Pirate: 'Melee Combat',
    Rogue: 'Melee Combat',
    Scientist: '+1 Int',
    Scout: "Jack o' Trades",
    'Surface Defense': 'Athletics',
    Technician: '+1 Int'
  },
  {
    'Personal Development': 5,
    Pirate: 'Bribery',
    Rogue: 'Bribery',
    Scientist: '+1 Edu',
    Scout: '+1 Edu',
    'Surface Defense': 'Melee Combat',
    Technician: '+1 Edu'
  },
  {
    'Personal Development': 6,
    Pirate: 'Gambling',
    Rogue: 'Gambling',
    Scientist: 'Gun Combat',
    Scout: 'Melee Combat',
    'Surface Defense': 'Vehicle',
    Technician: 'Gun Combat'
  }
])

const serviceSkillsRaw = Object.freeze([
  {
    'Service Skills': 1,
    Athlete: 'Athletics',
    Aerospace: 'Electronics',
    Agent: 'Admin',
    Barbarian: 'Mechanics',
    Belter: 'Comms',
    Bureaucrat: 'Admin'
  },
  {
    'Service Skills': 2,
    Athlete: 'Admin',
    Aerospace: 'Gun Combat',
    Agent: 'Computer',
    Barbarian: 'Gun Combat',
    Belter: 'Demolitions',
    Bureaucrat: 'Computer'
  },
  {
    'Service Skills': 3,
    Athlete: 'Carousing',
    Aerospace: 'Gunnery',
    Agent: 'Streetwise',
    Barbarian: 'Melee Combat',
    Belter: 'Gun Combat',
    Bureaucrat: 'Carousing'
  },
  {
    'Service Skills': 4,
    Athlete: 'Computer',
    Aerospace: 'Melee Combat',
    Agent: 'Bribery',
    Barbarian: 'Recon',
    Belter: 'Gunnery',
    Bureaucrat: 'Bribery'
  },
  {
    'Service Skills': 5,
    Athlete: 'Gambling',
    Aerospace: 'Survival',
    Agent: 'Leadership',
    Barbarian: 'Survival',
    Belter: 'Prospecting',
    Bureaucrat: 'Leadership'
  },
  {
    'Service Skills': 6,
    Athlete: 'Vehicle',
    Aerospace: 'Aircraft',
    Agent: 'Vehicle',
    Barbarian: 'Animals',
    Belter: 'Piloting',
    Bureaucrat: 'Vehicle'
  },
  {
    'Service Skills': 1,
    Colonist: 'Mechanics',
    Diplomat: 'Admin',
    Drifter: 'Streetwise',
    Entertainer: 'Athletics',
    Hunter: 'Mechanics',
    Marine: 'Comms'
  },
  {
    'Service Skills': 2,
    Colonist: 'Gun Combat',
    Diplomat: 'Computer',
    Drifter: 'Mechanics',
    Entertainer: 'Admin',
    Hunter: 'Gun Combat',
    Marine: 'Demolitions'
  },
  {
    'Service Skills': 3,
    Colonist: 'Animals',
    Diplomat: 'Carousing',
    Drifter: 'Gun Combat',
    Entertainer: 'Carousing',
    Hunter: 'Melee Combat',
    Marine: 'Gun Combat'
  },
  {
    'Service Skills': 4,
    Colonist: 'Electronics',
    Diplomat: 'Bribery',
    Drifter: 'Melee Combat',
    Entertainer: 'Bribery',
    Hunter: 'Recon',
    Marine: 'Gunnery'
  },
  {
    'Service Skills': 5,
    Colonist: 'Survival',
    Diplomat: 'Liaison',
    Drifter: 'Recon',
    Entertainer: 'Gambling',
    Hunter: 'Survival',
    Marine: 'Melee Combat'
  },
  {
    'Service Skills': 6,
    Colonist: 'Vehicle',
    Diplomat: 'Vehicle',
    Drifter: 'Vehicle',
    Entertainer: 'Vehicle',
    Hunter: 'Vehicle',
    Marine: 'Battle Dress'
  },
  {
    'Service Skills': 1,
    'Maritime Defense': 'Mechanics',
    Mercenary: 'Comms',
    Merchant: 'Comms',
    Navy: 'Comms',
    Noble: 'Athletics',
    Physician: 'Admin'
  },
  {
    'Service Skills': 2,
    'Maritime Defense': 'Gun Combat',
    Mercenary: 'Mechanics',
    Merchant: 'Engineering',
    Navy: 'Engineering',
    Noble: 'Admin',
    Physician: 'Computer'
  },
  {
    'Service Skills': 3,
    'Maritime Defense': 'Gunnery',
    Mercenary: 'Gun Combat',
    Merchant: 'Gun Combat',
    Navy: 'Gun Combat',
    Noble: 'Carousing',
    Physician: 'Mechanics'
  },
  {
    'Service Skills': 4,
    'Maritime Defense': 'Melee Combat',
    Mercenary: 'Melee Combat',
    Merchant: 'Melee Combat',
    Navy: 'Gunnery',
    Noble: 'Leadership',
    Physician: 'Medicine'
  },
  {
    'Service Skills': 5,
    'Maritime Defense': 'Survival',
    Mercenary: 'Gambling',
    Merchant: 'Broker',
    Navy: 'Melee Combat',
    Noble: 'Gambling',
    Physician: 'Leadership'
  },
  {
    'Service Skills': 6,
    'Maritime Defense': 'Watercraft',
    Mercenary: 'Battle Dress',
    Merchant: 'Vehicle',
    Navy: 'Vehicle',
    Noble: 'Vehicle',
    Physician: 'Sciences'
  },
  {
    'Service Skills': 1,
    Pirate: 'Streetwise',
    Rogue: 'Streetwise',
    Scientist: 'Admin',
    Scout: 'Comms',
    'Surface Defense': 'Mechanics',
    Technician: 'Admin'
  },
  {
    'Service Skills': 2,
    Pirate: 'Electronics',
    Rogue: 'Mechanics',
    Scientist: 'Computer',
    Scout: 'Electronics',
    'Surface Defense': 'Gun Combat',
    Technician: 'Computer'
  },
  {
    'Service Skills': 3,
    Pirate: 'Gun Combat',
    Rogue: 'Gun Combat',
    Scientist: 'Electronics',
    Scout: 'Gun Combat',
    'Surface Defense': 'Gunnery',
    Technician: 'Mechanics'
  },
  {
    'Service Skills': 4,
    Pirate: 'Melee Combat',
    Rogue: 'Melee Combat',
    Scientist: 'Medicine',
    Scout: 'Gunnery',
    'Surface Defense': 'Melee Combat',
    Technician: 'Medicine'
  },
  {
    'Service Skills': 5,
    Pirate: 'Recon',
    Rogue: 'Recon',
    Scientist: 'Bribery',
    Scout: 'Recon',
    'Surface Defense': 'Recon',
    Technician: 'Electronics'
  },
  {
    'Service Skills': 6,
    Pirate: 'Vehicle',
    Rogue: 'Vehicle',
    Scientist: 'Sciences',
    Scout: 'Piloting',
    'Surface Defense': 'Battle Dress',
    Technician: 'Sciences'
  }
])

const specialistSkillsRaw = Object.freeze([
  {
    Specialist: 1,
    Athlete: 'Zero-G',
    Aerospace: 'Comms',
    Agent: 'Gun Combat',
    Barbarian: 'Gun Combat',
    Belter: 'Zero-G',
    Bureaucrat: 'Admin'
  },
  {
    Specialist: 2,
    Athlete: 'Athletics',
    Aerospace: 'Gravitics',
    Agent: 'Melee Combat',
    Barbarian: "Jack o' Trades",
    Belter: 'Computer',
    Bureaucrat: 'Computer'
  },
  {
    Specialist: 3,
    Athlete: 'Athletics',
    Aerospace: 'Gun Combat',
    Agent: 'Bribery',
    Barbarian: 'Melee Combat',
    Belter: 'Electronics',
    Bureaucrat: 'Perception'
  },
  {
    Specialist: 4,
    Athlete: 'Computer',
    Aerospace: 'Gunnery',
    Agent: 'Leadership',
    Barbarian: 'Recon',
    Belter: 'Prospecting',
    Bureaucrat: 'Leadership'
  },
  {
    Specialist: 5,
    Athlete: 'Leadership',
    Aerospace: 'Recon',
    Agent: 'Recon',
    Barbarian: 'Animals',
    Belter: 'Sciences',
    Bureaucrat: 'Steward'
  },
  {
    Specialist: 6,
    Athlete: 'Gambling',
    Aerospace: 'Piloting',
    Agent: 'Survival',
    Barbarian: 'Tactics',
    Belter: 'Vehicle',
    Bureaucrat: 'Vehicle'
  },
  {
    Specialist: 1,
    Colonist: 'Athletics',
    Diplomat: 'Carousing',
    Drifter: 'Electronics',
    Entertainer: 'Computer',
    Hunter: 'Admin',
    Marine: 'Electronics'
  },
  {
    Specialist: 2,
    Colonist: 'Carousing',
    Diplomat: 'Linguistics',
    Drifter: 'Melee Combat',
    Entertainer: 'Carousing',
    Hunter: 'Comms',
    Marine: 'Gun Combat'
  },
  {
    Specialist: 3,
    Colonist: "Jack o' Trades",
    Diplomat: 'Bribery',
    Drifter: 'Bribery',
    Entertainer: 'Bribery',
    Hunter: 'Electronics',
    Marine: 'Melee Combat'
  },
  {
    Specialist: 4,
    Colonist: 'Engineering',
    Diplomat: 'Liaison',
    Drifter: 'Streetwise',
    Entertainer: 'Liaison',
    Hunter: 'Recon',
    Marine: 'Survival'
  },
  {
    Specialist: 5,
    Colonist: 'Animals',
    Diplomat: 'Steward',
    Drifter: 'Gambling',
    Entertainer: 'Gambling',
    Hunter: 'Animals',
    Marine: 'Recon'
  },
  {
    Specialist: 6,
    Colonist: 'Vehicle',
    Diplomat: 'Vehicle',
    Drifter: 'Recon',
    Entertainer: 'Recon',
    Hunter: 'Vehicle',
    Marine: 'Vehicle'
  },
  {
    Specialist: 1,
    'Maritime Defense': 'Comms',
    Mercenary: 'Gravitics',
    Merchant: 'Carousing',
    Navy: 'Gravitics',
    Noble: 'Computer',
    Physician: 'Computer'
  },
  {
    Specialist: 2,
    'Maritime Defense': 'Electronics',
    Mercenary: 'Gun Combat',
    Merchant: 'Gunnery',
    Navy: "Jack o' Trades",
    Noble: 'Carousing',
    Physician: 'Carousing'
  },
  {
    Specialist: 3,
    'Maritime Defense': 'Gun Combat',
    Mercenary: 'Gunnery',
    Merchant: "Jack o' Trades",
    Navy: 'Melee Combat',
    Noble: 'Gun Combat',
    Physician: 'Electronics'
  },
  {
    Specialist: 4,
    'Maritime Defense': 'Demolitions',
    Mercenary: 'Melee Combat',
    Merchant: 'Medicine',
    Navy: 'Navigation',
    Noble: 'Melee Combat',
    Physician: 'Medicine'
  },
  {
    Specialist: 5,
    'Maritime Defense': 'Recon',
    Mercenary: 'Recon',
    Merchant: 'Navigation',
    Navy: 'Leadership',
    Noble: 'Liaison',
    Physician: 'Medicine'
  },
  {
    Specialist: 6,
    'Maritime Defense': 'Watercraft',
    Mercenary: 'Vehicle',
    Merchant: 'Piloting',
    Navy: 'Piloting',
    Noble: 'Animals',
    Physician: 'Sciences'
  },
  {
    Specialist: 1,
    Pirate: 'Zero-G',
    Rogue: 'Computer',
    Scientist: 'Navigation',
    Scout: 'Engineering',
    'Surface Defense': 'Comms',
    Technician: 'Computer'
  },
  {
    Specialist: 2,
    Pirate: 'Comms',
    Rogue: 'Electronics',
    Scientist: 'Admin',
    Scout: 'Gunnery',
    'Surface Defense': 'Demolitions',
    Technician: 'Electronics'
  },
  {
    Specialist: 3,
    Pirate: 'Engineering',
    Rogue: 'Bribery',
    Scientist: 'Sciences',
    Scout: 'Demolitions',
    'Surface Defense': 'Gun Combat',
    Technician: 'Gravitics'
  },
  {
    Specialist: 4,
    Pirate: 'Gunnery',
    Rogue: 'Broker',
    Scientist: 'Sciences',
    Scout: 'Navigation',
    'Surface Defense': 'Melee Combat',
    Technician: 'Linguistics'
  },
  {
    Specialist: 5,
    Pirate: 'Navigation',
    Rogue: 'Recon',
    Scientist: 'Animals',
    Scout: 'Medicine',
    'Surface Defense': 'Survival',
    Technician: 'Engineering'
  },
  {
    Specialist: 6,
    Pirate: 'Piloting',
    Rogue: 'Vehicle',
    Scientist: 'Vehicle',
    Scout: 'Vehicle',
    'Surface Defense': 'Vehicle',
    Technician: 'Animals'
  }
])

const advEducationRaw = Object.freeze([
  {
    'Adv Education': 1,
    Athlete: 'Advocate',
    Aerospace: 'Advocate',
    Agent: 'Advocate',
    Barbarian: 'Advocate',
    Belter: 'Advocate',
    Bureaucrat: 'Advocate'
  },
  {
    'Adv Education': 2,
    Athlete: 'Computer',
    Aerospace: 'Computer',
    Agent: 'Computer',
    Barbarian: 'Linguistics',
    Belter: 'Engineering',
    Bureaucrat: 'Computer'
  },
  {
    'Adv Education': 3,
    Athlete: 'Liaison',
    Aerospace: "Jack o' Trades",
    Agent: 'Liaison',
    Barbarian: 'Medicine',
    Belter: 'Medicine',
    Bureaucrat: 'Liaison'
  },
  {
    'Adv Education': 4,
    Athlete: 'Linguistics',
    Aerospace: 'Medicine',
    Agent: 'Linguistics',
    Barbarian: 'Leadership',
    Belter: 'Navigation',
    Bureaucrat: 'Linguistics'
  },
  {
    'Adv Education': 5,
    Athlete: 'Medicine',
    Aerospace: 'Leadership',
    Agent: 'Medicine',
    Barbarian: 'Tactics',
    Belter: 'Comms',
    Bureaucrat: 'Medicine'
  },
  {
    'Adv Education': 6,
    Athlete: 'Sciences',
    Aerospace: 'Tactics',
    Agent: 'Leadership',
    Barbarian: 'Broker',
    Belter: 'Tactics',
    Bureaucrat: 'Admin'
  },
  {
    'Adv Education': 1,
    Colonist: 'Advocate',
    Diplomat: 'Advocate',
    Drifter: 'Computer',
    Entertainer: 'Advocate',
    Hunter: 'Advocate',
    Marine: 'Advocate'
  },
  {
    'Adv Education': 2,
    Colonist: 'Linguistics',
    Diplomat: 'Computer',
    Drifter: 'Engineering',
    Entertainer: 'Computer',
    Hunter: 'Linguistics',
    Marine: 'Computer'
  },
  {
    'Adv Education': 3,
    Colonist: 'Medicine',
    Diplomat: 'Liaison',
    Drifter: "Jack o' Trades",
    Entertainer: 'Carousing',
    Hunter: 'Medicine',
    Marine: 'Gravitics'
  },
  {
    'Adv Education': 4,
    Colonist: 'Liaison',
    Diplomat: 'Linguistics',
    Drifter: 'Medicine',
    Entertainer: 'Linguistics',
    Hunter: 'Liaison',
    Marine: 'Medicine'
  },
  {
    'Adv Education': 5,
    Colonist: 'Admin',
    Diplomat: 'Medicine',
    Drifter: 'Liaison',
    Entertainer: 'Medicine',
    Hunter: 'Tactics',
    Marine: 'Navigation'
  },
  {
    'Adv Education': 6,
    Colonist: 'Animals',
    Diplomat: 'Leadership',
    Drifter: 'Tactics',
    Entertainer: 'Sciences',
    Hunter: 'Animals',
    Marine: 'Tactics'
  },
  {
    'Adv Education': 1,
    'Maritime Defense': 'Advocate',
    Mercenary: 'Advocate',
    Merchant: 'Advocate',
    Navy: 'Advocate',
    Noble: 'Advocate',
    Physician: 'Advocate'
  },
  {
    'Adv Education': 2,
    'Maritime Defense': 'Computer',
    Mercenary: 'Engineering',
    Merchant: 'Engineering',
    Navy: 'Computer',
    Noble: 'Computer',
    Physician: 'Computer'
  },
  {
    'Adv Education': 3,
    'Maritime Defense': "Jack o' Trades",
    Mercenary: 'Medicine',
    Merchant: 'Medicine',
    Navy: 'Engineering',
    Noble: 'Liaison',
    Physician: "Jack o' Trades"
  },
  {
    'Adv Education': 4,
    'Maritime Defense': 'Medicine',
    Mercenary: 'Navigation',
    Merchant: 'Navigation',
    Navy: 'Medicine',
    Noble: 'Linguistics',
    Physician: 'Linguistics'
  },
  {
    'Adv Education': 5,
    'Maritime Defense': 'Leadership',
    Mercenary: 'Sciences',
    Merchant: 'Sciences',
    Navy: 'Navigation',
    Noble: 'Medicine',
    Physician: 'Medicine'
  },
  {
    'Adv Education': 6,
    'Maritime Defense': 'Tactics',
    Mercenary: 'Tactics',
    Merchant: 'Tactics',
    Navy: 'Tactics',
    Noble: 'Sciences',
    Physician: 'Sciences'
  },
  {
    'Adv Education': 1,
    Pirate: 'Computer',
    Rogue: 'Computer',
    Scientist: 'Advocate',
    Scout: 'Advocate',
    'Surface Defense': 'Advocate',
    Technician: 'Advocate'
  },
  {
    'Adv Education': 2,
    Pirate: 'Gravitics',
    Rogue: 'Gravitics',
    Scientist: 'Computer',
    Scout: 'Computer',
    'Surface Defense': 'Computer',
    Technician: 'Computer'
  },
  {
    'Adv Education': 3,
    Pirate: "Jack o' Trades",
    Rogue: "Jack o' Trades",
    Scientist: "Jack o' Trades",
    Scout: 'Linguistics',
    'Surface Defense': "Jack o' Trades",
    Technician: "Jack o' Trades"
  },
  {
    'Adv Education': 4,
    Pirate: 'Medicine',
    Rogue: 'Medicine',
    Scientist: 'Linguistics',
    Scout: 'Medicine',
    'Surface Defense': 'Medicine',
    Technician: 'Linguistics'
  },
  {
    'Adv Education': 5,
    Pirate: 'Advocate',
    Rogue: 'Advocate',
    Scientist: 'Medicine',
    Scout: 'Navigation',
    'Surface Defense': 'Leadership',
    Technician: 'Medicine'
  },
  {
    'Adv Education': 6,
    Pirate: 'Tactics',
    Rogue: 'Tactics',
    Scientist: 'Sciences',
    Scout: 'Tactics',
    'Surface Defense': 'Tactics',
    Technician: 'Sciences'
  }
])

module.exports = {
  careerBasicsRaw,
  ranksAndSkillsRaw,
  materialBenefitsRaw,
  cashBenefitsRaw,
  personalDevelopmentRaw,
  serviceSkillsRaw,
  specialistSkillsRaw,
  advEducationRaw
}
