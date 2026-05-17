const cat = Object.freeze({
  ARMOR: 'Armor',
  COMMUNICATOR: 'Communicator',
  COMPUTER: 'Computer',
  SOFTWARE: 'Software',
  DRUG: 'Drug',
  EXPLOSIVE: 'Explosive',
  PERSONAL_DEVICE: 'Personal Device',
  SENSORY_AID: 'Sensory Aid',
  SHELTER: 'Shelter',
  SURVIVAL_EQUIPMENT: 'Survival Equipment',
  TOOL_KIT: 'Tool Kit',
  MELEE_WEAPON: 'Melee Weapon',
  RANGED_WEAPON: 'Ranged Weapon',
  AMMO: 'Ammunition',
  ACCESSORY: 'Accessory',
  GRENADE: 'Grenade',
  HEAVY_WEAPON: 'Heavy Weapon'
})

const armor = Object.freeze([
  {
    Name: 'Ablat',
    Category: cat.ARMOR,
    TL: 9,
    AR: 3,
    LaserAR: 8,
    Cost: 75,
    Wgt: 2,
    Description:
      'A cheap alternative to Reflec, ablat armor is made from a material that ablates (vaporizes) when hit by laser fire. Each laser hit on ablat reduces its armor value (versus lasers) by one, but the armor is cheap and easily replaceable.'
  },
  {
    Name: 'Battle Dress',
    Category: cat.ARMOR,
    TL: 13,
    AR: 18,
    Cost: 200000,
    Wgt: 60,
    Skill: 'Battle Dress',
    Description:
      "The ultimate personal armor, battle dress is a powered form of combat armor. The servomotors vastly increase the user's speed and strength, boosting his Strength and Dexterity by +4 while wearing the armor. Damage to the wearer's characteristics is calculated as normal, but the values from the armor are used for all other purposes such as hand to hand damage or skill checks. The suit has a built-in Model 2 computer running an Expert Tactics-2 program to give tactical advice and updates and is commonly outfitted with numerous upgrades. The suit is fully enclosed, with a six-hour air supply and gives full protection against environmental hazards – including NBC shielding – as if it was an HEV suit."
  },
  {
    Name: 'Cloth',
    Category: cat.ARMOR,
    TL: 6,
    AR: 9,
    Cost: 250,
    Wgt: 2,
    Description:
      'A heavy duty body suit tailored from ballistic cloth. The fabric absorbs impact energy and spreads it over the body, which can result in bruising. However, cloth armor is highly useful and versatile – it can be effectively concealed under normal clothing although observers making an Investigate or Recon check at 8+ will notice something unusual.'
  },
  {
    Name: 'Combat Armor',
    Category: cat.ARMOR,
    TL: 11,
    AR: 11,
    Cost: 20000,
    Wgt: 18,
    Skill: 'Zero-G',
    Description:
      'This full-body suit is used by the military and not generally available on the open market, although those with military or criminal contacts can obtain it without much difficulty. It is issued to troop units and mercenary battalions. Combat armor protects from hard vacuum in the same way as a vacc suit and provides life support for six hours.'
  },
  {
    Name: 'Hostile Env Vacc Suit',
    Category: cat.ARMOR,
    TL: 12,
    AR: 8,
    Cost: 18000,
    Wgt: 40,
    Skill: 'Zero-G',
    Description:
      'Hostile environment suits are designed for conditions where a normal vacc suit would be insufficient, such as deep underwater, worlds shrouded in toxic or corrosive gases, extremes of radiation or temperature, or other locales that offer serious physical danger as well as the lack of a breathable atmosphere. HEV suits provide all the life support offered by a normal vacc suit (for six hours) but are also impervious to flames, intense radiation such as that found at nuclear blast sites (decreasing radiation exposure by 180 rads), and high pressure environments like undersea trenches.'
  },
  {
    Name: 'Jack',
    Category: cat.ARMOR,
    TL: 1,
    AR: 3,
    Cost: 50,
    Wgt: 1,
    Description:
      'A natural or synthetic leather jacket or body suit covering the torso and upper arms and legs.'
  },
  {
    Name: 'Mesh',
    Category: cat.ARMOR,
    TL: 7,
    AR: 5,
    Cost: 150,
    Wgt: 2,
    Description:
      'A jacket or body suit lined with a flexible metal or plastic mesh that gives it added protection against bullets.'
  },
  {
    Name: 'Reflec',
    Category: cat.ARMOR,
    TL: 10,
    AR: 0,
    LaserAR: 14,
    Cost: 1500,
    Wgt: 1,
    Description:
      'Reflec armor is a flexible plastic suit with layers of reflective material and heat-dispersing gel. It is highly effective against lasers, but provides no protection against other attacks. Reflec can be worn with other armor.'
  },
  {
    Name: 'Vacc Suit',
    Category: cat.ARMOR,
    TL: 9,
    AR: 6,
    Cost: 9000,
    Wgt: 8,
    Skill: 'Zero-G',
    Description:
      "The vacc suit or space suit is the spacer's best friend, providing life support and protection when in space. A vacc suit provides a breathable atmosphere and protection from the extremes of temperature, low pressure and radiation typically found in a hard vacuum (decreasing exposure by up to 40 rads), for six hours."
  }
])

const communicators = Object.freeze([
  {
    Name: 'Long Range Communicator',
    Category: cat.COMMUNICATOR,
    TL: 6,
    Cost: 500,
    Wgt: 15,
    Range: '500km',
    Description:
      'Back-pack mounted radio capable of ranges up to 500 km and contact with ships in orbit. Ten separate channels. At tech level 7 reduce the weight to 1.5 kg and it becomes belt or sling mounted.'
  },
  {
    Name: 'Medium Range Communicator',
    Category: cat.COMMUNICATOR,
    TL: 5,
    Cost: 200,
    Wgt: 10,
    Range: '30km',
    Description:
      'Belt-mounted or sling carried radio set capable of up to 30 km range, and contact with official radio channels. Five separate channels. At tech level 7, reduce the weight to 500 grams.'
  },
  {
    Name: 'Short Range Communicator',
    Category: cat.COMMUNICATOR,
    TL: 5,
    Cost: 100,
    Wgt: 5,
    Range: '10km',
    Description:
      'Belt-mounted radio capable of 10 km range (much shorter underground or underwater). Three separate channels. At tech level 7 reduce the weight to 300 grams and it becomes hand-held.'
  },
  {
    Name: 'Personal Communicator',
    Category: cat.COMMUNICATOR,
    TL: 8,
    Cost: 250,
    Wgt: 0.3,
    Range: 'Special',
    Description:
      "A hand-held, single channel communication device. On world with a tech level of 8 or higher a personal communicator is able to tap into the world's satellite communication network and with the proper address, contact any other communicator in the world (for a fee). The channel is private, but not secure and may be monitored on some worlds. Usually network access can be arranged at the local starport for a small fee. On worlds with a tech level of 7 or less, personal communicators will not work."
  }
])

const computers = Object.freeze([
  {
    TL: 7,
    Name: 'Model 0',
    Category: cat.COMPUTER,
    Wgt: 10,
    Cost: 50
  },
  {
    TL: 8,
    Name: 'Model 1',
    Category: cat.COMPUTER,
    Wgt: 5,
    Cost: 100
  },
  {
    TL: 9,
    Name: 'Model 1',
    Category: cat.COMPUTER,
    Wgt: 5,
    Cost: 250
  },
  {
    TL: 10,
    Name: 'Model 2',
    Category: cat.COMPUTER,
    Wgt: 1,
    Cost: 350
  },
  {
    TL: 11,
    Name: 'Model 2',
    Category: cat.COMPUTER,
    Wgt: 1,
    Cost: 500
  },
  {
    TL: 12,
    Name: 'Model 3',
    Category: cat.COMPUTER,
    Wgt: 0.5,
    Cost: 1000
  },
  {
    TL: 13,
    Name: 'Model 4',
    Category: cat.COMPUTER,
    Wgt: 0.5,
    Cost: 1500
  },
  {
    TL: 14,
    Name: 'Model 5',
    Category: cat.COMPUTER,
    Wgt: 0.5,
    Cost: 5000
  }
])

const software = Object.freeze([
  {
    Name: 'Database',
    Category: cat.SOFTWARE,
    Rating: 0,
    TL: 7,
    Cost: 50,
    Description:
      'A database is a large store of information on a topic that can be searched with a Computer check or using an Agent.'
  },
  {
    Name: 'Interface',
    Category: cat.SOFTWARE,
    Rating: 0,
    TL: 7,
    Cost: 0,
    Description:
      'Displays data. Using a computer without an interface is a Formidable (–6 DM) task.'
  },
  {
    Name: 'Security-0',
    Category: cat.SOFTWARE,
    Rating: 0,
    TL: 7,
    Cost: 0,
    Description:
      'Security programs defend against intrusion. Rating 0 is Average (+0 DM).'
  },
  {
    Name: 'Security-1',
    Category: cat.SOFTWARE,
    Rating: 1,
    TL: 9,
    Cost: 200,
    Description: 'Difficult (–2 DM) difficulty'
  },
  {
    Name: 'Security-2',
    Category: cat.SOFTWARE,
    Rating: 2,
    TL: 11,
    Cost: 1000,
    Description: 'Very Difficult (–4 DM) difficulty'
  },
  {
    Name: 'Security-3',
    Category: cat.SOFTWARE,
    Rating: 3,
    TL: 12,
    Cost: 20000,
    Description: 'Formidable (–6 DM) difficulty'
  },
  {
    Name: 'Translator-0',
    Category: cat.SOFTWARE,
    Rating: 0,
    TL: 9,
    Cost: 50,
    Description:
      'Translators are specialized Expert systems that only have Language skills. Provides a near-real-time translation.'
  },
  {
    Name: 'Translator-1',
    Category: cat.SOFTWARE,
    Rating: 1,
    TL: 10,
    Cost: 500,
    Description:
      'Works in real-time and has a much better understanding of the nuances of language.'
  },
  {
    Name: 'Intrusion-1',
    Category: cat.SOFTWARE,
    Rating: 1,
    TL: 10,
    Cost: 1000,
    Description:
      'Intrusion programs aid hacking attempts, giving a bonus equal to their Rating. Intrusion software is often illegal.'
  },
  {
    Name: 'Intrusion-2',
    Category: cat.SOFTWARE,
    Rating: 2,
    TL: 11,
    Cost: 10000,
    Description: ''
  },
  {
    Name: 'Intrusion-3',
    Category: cat.SOFTWARE,
    Rating: 3,
    TL: 13,
    Cost: 100000,
    Description: ''
  },
  {
    Name: 'Intrusion-4',
    Category: cat.SOFTWARE,
    Rating: 4,
    TL: 15,
    Cost: 10000000,
    Description: ''
  },
  {
    Name: 'Intelligent Interface-1',
    Category: cat.SOFTWARE,
    Rating: 1,
    TL: 11,
    Cost: 100,
    Description:
      '"Low autonomous" artificial intelligence allows voice control and displays data intelligently. Required for using Expert programs.'
  },
  {
    Name: 'Intelligent Interface-2',
    Category: cat.SOFTWARE,
    Rating: 2,
    TL: 13,
    Cost: 1000,
    Description:
      '"High autonomous" artificial intelligence allows a primitive artificial intelligence to self-initiate and learn on its own.'
  },
  {
    Name: 'Intelligent Interface-3',
    Category: cat.SOFTWARE,
    Rating: 3,
    TL: 17,
    Cost: 10000,
    Description:
      'True artificial intelligence capable of independent creative thought.'
  },
  {
    Name: 'Expert-1',
    Category: cat.SOFTWARE,
    Rating: 1,
    TL: 11,
    Cost: 1000,
    Description:
      "Expert programs mimic skills. A character using an expert system may make a skill check as if he had the skill at the program's Rating -1. Only Intelligence and Education-based checks can be attempted. If the character already has the skill at a higher level, then an Expert program grants a +1 DM instead."
  },
  {
    Name: 'Expert-2',
    Category: cat.SOFTWARE,
    Rating: 2,
    TL: 12,
    Cost: 10000,
    Description: ''
  },
  {
    Name: 'Expert-3',
    Category: cat.SOFTWARE,
    Rating: 3,
    TL: 13,
    Cost: 100000,
    Description: ''
  },
  {
    Name: 'Agent-0',
    Category: cat.SOFTWARE,
    Rating: 0,
    TL: 11,
    Cost: 500,
    Description:
      'Agent programs have a Computer skill equal to their Rating, and can carry out tasks assigned to them with a modicum of intelligence. For example, an agent program might be commanded to hack into an enemy computer system and steal a particular data file. They are effectively specialized combinations of Computer Expert and Intellect programs.'
  },
  {
    Name: 'Agent-1',
    Category: cat.SOFTWARE,
    Rating: 1,
    TL: 12,
    Cost: 2000,
    Description: ''
  },
  {
    Name: 'Agent-2',
    Category: cat.SOFTWARE,
    Rating: 2,
    TL: 13,
    Cost: 100000,
    Description: ''
  },
  {
    Name: 'Agent-3',
    Category: cat.SOFTWARE,
    Rating: 3,
    TL: 14,
    Cost: 250000,
    Description: ''
  },
  {
    Name: 'Intellect-1',
    Category: cat.SOFTWARE,
    Rating: 1,
    TL: 12,
    Cost: 2000,
    Description:
      'Intellects are improved agents, who can use Expert systems. For example, a robot doctor might be running Intellect/1 and Expert Medic/3, giving it a Medic skill of 2. An Intellect program can use a number of skills simultaneously equal to its Rating.'
  },
  {
    Name: 'Intellect-2',
    Category: cat.SOFTWARE,
    Rating: 2,
    TL: 13,
    Cost: 50000,
    Description: ''
  },
  {
    Name: 'Intellect-3',
    Category: cat.SOFTWARE,
    Rating: 3,
    TL: 14,
    Cost: 5000000,
    Description: ''
  }
])

const drugs = Object.freeze([
  {
    Name: 'Medicinal Drugs',
    Category: cat.DRUG,
    TL: 5,
    Cost: 5,
    Description:
      'These medications include vaccines, antitoxins and antibiotics. They range in cost from Cr5 to 1D6x1,000 Credits, depending on the rarity and complexity of the drug. Medicinal drugs require the Medic skill to use properly – using the wrong drug can be worse than doing nothing. With a successful Medic check the correct drug can counteract most poisons or diseases, or at the very least give a positive DM towards resisting them. If the wrong drug is administered, treat it as a Difficult (–2 DM) poison with a damage of 1D6.'
  },
  {
    Name: 'Anti-Radiation Drugs',
    Category: cat.DRUG,
    TL: 8,
    Cost: 1000,
    Description:
      'Must be administered before or immediately after (within ten minutes) radiation exposure. They absorb up to 100 rads per dose. A character may only use anti-rad drugs once per day – taking any more causes permanent Endurance damage of 1D6 per dose.'
  },
  {
    Name: 'Panaceas',
    Category: cat.DRUG,
    TL: 8,
    Cost: 200,
    Description:
      'Wide-spectrum medicinal drugs that are specifically designed not to interact harmfully. They can therefore be used on any wound or illness and are guaranteed not to make things worse. A character using panaceas may make a Medic check as if he had Medic 0 when treating an infection or disease.'
  },
  {
    Name: 'Stim Drugs',
    Category: cat.DRUG,
    TL: 8,
    Cost: 50,
    Description:
      'Removes fatigue, at a cost. A character who uses stim may remove the effects of fatigue but suffers one point of damage. If stims are used to remove fatigue again without an intervening period of sleep, the character suffers two points of damage the second time, three points the third time, and so on.'
  },
  {
    Name: 'Combat Drug',
    Category: cat.DRUG,
    TL: 10,
    Cost: 1000,
    Description:
      "This drug increases reaction time and improves the body's ability to cope with trauma, aiding the user in combat. A character using a combat drug adds +4 to his initiative total at the start of combat (or whenever the drug takes effect). He may also dodge once each round with no effect on his initiative score and reduces all damage suffered by two points. The drug kicks in twenty seconds (four rounds) after injection, and lasts around ten minutes. When the drug wears off, the user is fatigued."
  },
  {
    Name: 'Fast Drug',
    Category: cat.DRUG,
    TL: 10,
    Cost: 200,
    Description:
      "Also known as 'Hibernation', this drug puts the user into a state akin to suspended animation, slowing his metabolic rate down to a ratio of 60 to 1 – a subjective day for the user is actually two months. Fast drug is normally used to prolong life support reserves or as a cheap substitute for a cryoberth."
  },
  {
    Name: 'Metabolic Accelerator',
    Category: cat.DRUG,
    TL: 10,
    Cost: 500,
    Description:
      "Also known as 'Slow Drug', this drug boosts the user's reaction time to superhuman levels. A character using slow drug in combat adds +8 to his initiative total at the start of combat (or whenever the drug takes effect). He may also dodge up to twice each round with no effect on his initiative score. The drug kicks in 45 seconds (eight rounds) after ingestion or injection and lasts for around ten minutes. When the drug wears off, the user's system crashes. He suffers 2D6 points of damage and is exhausted."
  },
  {
    Name: 'Medicinal Slow',
    Category: cat.DRUG,
    TL: 11,
    Cost: 500,
    Description:
      'A variant of the slow drug. It can only be applied safely in a medical facility where life-support and cryo-technology is available as it increases the metabolism to around thirty times normal, allowing a patient to undergo a month of healing in a single day.'
  },
  {
    Name: 'Anagathics',
    Category: cat.DRUG,
    TL: 11,
    Cost: 2000,
    Description:
      "Slow the user's aging process. Synthetic anagathics become possible at TL 15, but there are natural spices and other rare compounds that have comparable effects at all Technology Levels. Anagathics are illegal or heavily controlled on many worlds. One dose must be taken each month to maintain the anti-aging effect – if the character taking anagathics misses a dose they must make an immediate roll on the aging table as their body reacts badly to the interrupted supply."
  }
])

const explosives = Object.freeze([
  {
    Name: 'Plastic',
    Category: cat.EXPLOSIVE,
    TL: 6,
    Dmg: '3D6',
    Radius: '2D6 meters',
    Cost: 200,
    Description:
      'This generic, multi-purpose plastic explosive is a favorite of military units, terrorists, demolition teams and adventurers across known space.'
  },
  {
    Name: 'Pocket Nuke',
    Category: cat.EXPLOSIVE,
    TL: 12,
    Dmg: '2D6 x 20',
    Radius: '15D6 meters',
    Cost: 20000,
    Description:
      'Hideously illegal on many worlds, the pocket nuke is actually the size of a briefcase and so is too large to fit into a grenade launcher.'
  },
  {
    Name: 'TDX',
    Category: cat.EXPLOSIVE,
    TL: 12,
    Dmg: '4D6',
    Radius: '4D6 meters',
    Cost: 1000,
    Description:
      'An advanced gravity-polarized explosive, TDX explodes only along the horizontal axis.'
  }
])

const personalDevices = Object.freeze([
  {
    Name: 'Magnetic Compass',
    Category: cat.PERSONAL_DEVICE,
    TL: 3,
    Cost: 10,
    Wgt: 0,
    Description: 'Indicates direction of magnetic north, if any exists.'
  },
  {
    Name: 'Wrist Watch',
    Category: cat.PERSONAL_DEVICE,
    TL: 4,
    Cost: 100,
    Wgt: 0,
    Description:
      'Allows the user to tell time. At teck level 9, can be configured to multiple worlds, as well as standard time, and allows the user to configure alarms based on specific times.'
  },
  {
    Name: 'Radiation Counter',
    Category: cat.PERSONAL_DEVICE,
    TL: 5,
    Cost: 250,
    Wgt: 1,
    Description:
      'Indicates presence and intensity of radioactivity within a 30-meter radius. The indicating signal will grow stronger as it gets closer to the source.'
  },
  {
    Name: 'Metal Detector',
    Category: cat.PERSONAL_DEVICE,
    TL: 6,
    Cost: 300,
    Wgt: 1,
    Description:
      'Indicates presence of metal within a 3 meter radius (including underground), with the indicating signal growing stronger as it gets closer to the source.'
  },
  {
    Name: 'Hand Calculator',
    Category: cat.PERSONAL_DEVICE,
    TL: 7,
    Cost: 10,
    Wgt: 0.1,
    Description: 'Allows the user to perform mathematical calculations quickly.'
  },
  {
    Name: 'Inertial Locator',
    Category: cat.PERSONAL_DEVICE,
    TL: 9,
    Cost: 1200,
    Wgt: 1.5,
    Description:
      'Indicates direction and distance traveled from the starting location.'
  },
  {
    Name: 'Electromagnetic Probe',
    Category: cat.PERSONAL_DEVICE,
    TL: 10,
    Cost: 1000,
    Wgt: 0,
    Description:
      "This handy device detects the electromagnetic emissions of technological devices, and can be used as a diagnostic tool when examining equipment (+1 DM to work out what's wrong with it) or when searching for hidden bugs or devices. The Comms skill can be used to sweep a room for bugs."
  },
  {
    Name: 'Hand Computer',
    Category: cat.PERSONAL_DEVICE,
    TL: 11,
    Cost: 1000,
    Wgt: 0.5,
    Description:
      "The 'handcomp' provides services of a small computer, plus serves as a computer terminal when linked (by its integral radio, network interface jack, or by other circuit) to a standard computer."
  },
  {
    Name: 'Holographic Projector',
    Category: cat.PERSONAL_DEVICE,
    TL: 11,
    Cost: 1000,
    Wgt: 1,
    Description:
      'A holographic projector is a toaster-sized box that, when activated, creates a three-dimensional image in the space around it or nearby – the range is approximately three meters in all directions. The image can be given pre-programmed animations within a limited range and the projector includes speakers for making sound. The projected holograms are obviously not real so this device is mostly used for communication. The TL 12 version can produce holograms real enough to fool anyone who fails an Intelligence check (made upon first seeing the hologram), at double the cost, and the TL 13 version can produce holograms that are true-to-life images, at ten times the cost.'
  },
  {
    Name: 'Densitometer',
    Category: cat.PERSONAL_DEVICE,
    TL: 14,
    Cost: 20000,
    Wgt: 5,
    Description:
      "The remote densitometer uses an object's natural gravity to measure its density, building up a three-dimensional image of the inside and outside of an object.\n"
  },
  {
    Name: 'Bioscanner',
    Category: cat.PERSONAL_DEVICE,
    TL: 15,
    Cost: 350000,
    Wgt: 3.5,
    Description:
      "The bioscanner 'sniffs' for organic molecules and tests chemical samples, analysing the make-up of whatever it is focussed on. It can be used to detect poisons or bacteria, analyse organic matter, search for life signs and classify unfamiliar organisms. The data from a bioscanner can be interpreted using the Comms or the Life Sciences skill."
  },
  {
    Name: 'Neural Activity Sensor',
    Category: cat.PERSONAL_DEVICE,
    TL: 15,
    Cost: 35000,
    Wgt: 10,
    Description:
      'This device consists of a backpack and detachable handheld unit, and can detect neural activity up to 500 meters away. The device can also give a rough estimation of the intelligence level of organisms based on brainwave patterns. The data from a neural activity scanner can be interpreted using the Comms, the Life Sciences or the Social Sciences skills.'
  }
])

const sensoryAids = Object.freeze([
  {
    Name: 'Torch',
    Category: cat.SENSORY_AID,
    TL: 1,
    Cost: 1,
    Wgt: 0.25,
    Description:
      'A torch burns for 1 hour, clearly illuminating a 6 meter radius and providing shadowy illumination out to a 12 meter radius.\n'
  },
  {
    Name: 'Lamp Oil',
    Category: cat.SENSORY_AID,
    TL: 2,
    Cost: 2,
    Wgt: 0
  },
  {
    Name: 'Oil Lamp',
    Category: cat.SENSORY_AID,
    TL: 2,
    Cost: 10,
    Wgt: 0.5,
    Description:
      'A lamp clearly illuminates a 4.5 meter radius, provides shadowy illumination out to a 9 meter radius, and burns for 6 hours on a pint of oil. You can carry a lamp in one hand.'
  },
  {
    Name: 'Binoculars',
    Category: cat.SENSORY_AID,
    TL: 3,
    Cost: 75,
    Wgt: 1,
    Description:
      'Allows the user to see further. At TL 8 electronic enhancement allows images to be captured; light-intensification allows them to be used in the dark. Cr750. At TL 12 PRIS (Portable Radiation Imaging System) allows the user to observe a large section of the EM-spectrum, from infrared to gamma rays. Cr3,500.'
  },
  {
    Name: 'Electric Torch',
    Category: cat.SENSORY_AID,
    TL: 5,
    Cost: 10,
    Wgt: 0.5,
    Description:
      'The common flashlight. It is battery powered and will last for about 6 hours of continuous use. A torch produces a wide cone of light up to 18 meters long with a radius of 6 meters at the end of the beam. Later TL models have adjustable beams allowing them to also produce a tight beam of light up to 36 meters long, with a 1 meter radius, or be used to illuminate a circle of 10 meter radius.'
  },
  {
    Name: 'Cold Light Lantern',
    Category: cat.SENSORY_AID,
    TL: 6,
    Cost: 20,
    Wgt: 0.25,
    Description:
      'A fuel cell powered version of the electric torch, but will last 3 days with continuous use. Produces a wide cone of light up to 18 meters away with a radius of 6 meters at the end of the beam. Also capable of producing a tight beam of light up to 36 meters away with a 1 meter radius or be used to illuminate a 10 meter radius.'
  },
  {
    Name: 'Infrared Goggles',
    Category: cat.SENSORY_AID,
    TL: 6,
    Cost: 500,
    Wgt: 0,
    Description:
      'Permits the user to see exothermic (heat-emitting) sources in the dark.'
  },
  {
    Name: 'Light Intensifier Goggles',
    Category: cat.SENSORY_AID,
    TL: 7,
    Cost: 500,
    Wgt: 0,
    Description:
      'Permits the user to see normally in anything less than total darkness by electronically intensifying any available light.'
  }
])

const shelters = Object.freeze([
  {
    Name: 'Tarpaulin',
    Category: cat.SHELTER,
    TL: 1,
    Cost: 10,
    Wgt: 2,
    Description:
      'A heavy hard-wearing waterproof fabric made of canvas or similar, for outdoor use as a temporary shelter or protective covering against moisture. Measures 4 meters long by 2 meters wide.'
  },
  {
    Name: 'Tent',
    Category: cat.SHELTER,
    TL: 2,
    Cost: 200,
    Wgt: 3,
    Description:
      'Basic shelter for two persons offering protection from precipitation, storms, and temperatures down to 0º Celsius, and withstanding light to moderate winds. Larger, more elaborate tents capable of sheltering more people, higher winds or colder temperatures weigh and cost more.'
  },
  {
    Name: 'Pre-Fabricated Cabin',
    Category: cat.SHELTER,
    TL: 6,
    Cost: 10000,
    Wgt: 4000,
    Description:
      'Modular unpressurized quarters for 6 persons and capable of withstanding light to severe winds. Offers excellent shelter from precipitation, storms, and temperatures down to -10º Celsius. Requires 8 man-hours to erect or dismantle. There are 16 modules, each, 1.5m wide by 1.5m long by 2m high that can be organized into any layout required. Dismantled and ready for shipment, the cabin weighs 4 tons.'
  },
  {
    Name: 'Basic Life Support Supplies',
    Category: cat.SHELTER,
    TL: 7,
    Cost: 100,
    Wgt: 2,
    Description:
      'Basic life support supplies (waste reclamation chemicals, oxygen supply, CO2 scrubbers, etc.) necessary to support one person for one day in an enclosed, pressurized environment, such as a pressure tent or an advanced base.'
  },
  {
    Name: 'Pressure Tent',
    Category: cat.SHELTER,
    TL: 7,
    Cost: 2000,
    Wgt: 25,
    Description:
      'Basic pressurized shelter for two persons, providing standard atmosphere and conditions, along with protection from precipitation, storms, and up to strong winds. There is no airlock: the tent must be depressurized to enter or leave it.'
  },
  {
    Name: 'Advanced Base',
    Category: cat.SHELTER,
    TL: 8,
    Cost: 50000,
    Wgt: 6000,
    Description:
      'Modular pressurized quarters for 6 persons and capable of withstanding anything less than hurricane force winds. Offers excellent shelter from precipitation and all but the most extreme of temperature ranges. Requires 12 man-hours to erect or dismantle. There are 16 modules, each, 1.5m wide by 1.5m long by 2m high that can be organized into any layout required. Dismantled and ready for shipment, the advanced base weighs 6 tons. The cost includes life-support for six people for 7 days.'
  }
])

const survivalEquipment = Object.freeze([
  {
    Name: 'Cold Weather Clothing',
    Category: cat.SURVIVAL_EQUIPMENT,
    TL: 1,
    Cost: 200,
    Wgt: 2,
    Description:
      'Protects against frigid weather (-20º Celsius or below). Adds a DM+2 to all Endurance checks made to resist the effects of cold weather exposure. Reduce the weight by 1kg for every 5 TL.'
  },
  {
    Name: 'Filter Mask',
    Category: cat.SURVIVAL_EQUIPMENT,
    TL: 3,
    Cost: 10,
    Wgt: 0,
    Description:
      'A filter set that allows an individual to breathe tainted atmospheres (types 4, 7, and 9). Also protects against the inhalation of heavy smoke or dust.'
  },
  {
    Name: 'Swimming Equipment',
    Category: cat.SURVIVAL_EQUIPMENT,
    TL: 3,
    Cost: 200,
    Wgt: 1,
    Description:
      'Includes swim fins, wet suit, face mask. Protects against the effects of cold (5º Celsius or below), along with improving speed and maneuverability underwater; add DM +1 to all Athletics skill checks in these situations when wearing proper swimming equipment.'
  },
  {
    Name: 'Combination Mask',
    Category: cat.SURVIVAL_EQUIPMENT,
    TL: 5,
    Cost: 150,
    Wgt: 0,
    Description:
      'A combination of both filter mask and respirator, which allows breathing of very thin, tainted atmospheres (type 2), plus all atmospheres listed under filter and respirator masks.'
  },
  {
    Name: 'Oxygen Tanks',
    Category: cat.SURVIVAL_EQUIPMENT,
    TL: 5,
    Cost: 500,
    Wgt: 5,
    Description:
      'A complete set of compressed oxygen tanks, which allow independent breathing in smoke, dust, gas, or exotic (type A) atmosphere. Two tanks last 6 hours. Refill of proper atmospheric mixture for race cost Cr20.'
  },
  {
    Name: 'Respirator',
    Category: cat.SURVIVAL_EQUIPMENT,
    TL: 5,
    Cost: 100,
    Wgt: 0,
    Description:
      'A small compressor that allows an individual to breathe in very thin atmospheres (type 3).'
  },
  {
    Name: 'Underwater Air Tanks',
    Category: cat.SURVIVAL_EQUIPMENT,
    TL: 5,
    Cost: 800,
    Wgt: 5,
    Description:
      'Equivalent to oxygen tanks but designed for use underwater. Two tanks last 6 hours. Refill of proper atmospheric mixture for race and expected depth cost Cr20.\n'
  },
  {
    Name: 'Artificial Gill',
    Category: cat.SURVIVAL_EQUIPMENT,
    TL: 8,
    Cost: 4000,
    Wgt: 4,
    Description:
      'Extracts oxygen from water to allowing the wearer to breathe for an unlimited time while submerged under water. Functions only on worlds with thin, standard, or dense (type 4 through 9) atmospheres.'
  },
  {
    Name: 'Environment Suit',
    Category: cat.SURVIVAL_EQUIPMENT,
    TL: 8,
    Cost: 500,
    Wgt: 0,
    Description:
      'Designed to protect the wearer from extreme cold or heat, the environment suit has a hood, gloves and boots but leaves the face exposed in normal operations.'
  },
  {
    Name: 'Rescue Bubble',
    Category: cat.SURVIVAL_EQUIPMENT,
    TL: 9,
    Cost: 600,
    Wgt: 3,
    Description:
      "A large (2m diameter) pressurized plastic bubble. Piezoelectric layers in the bubble wall translate the user's movements into electricity to recharge the bubble's batteries and power its distress beacon, and a small oxygen tank both inflates the bubble and provides two person/hours of life support. A self-repairing plastic seal serves as an emergency airlock. Rescue bubbles are found on both space vessels and water craft as emergency lifeboats."
  },
  {
    Name: 'Thruster Pack',
    Category: cat.SURVIVAL_EQUIPMENT,
    TL: 9,
    Cost: 2000,
    Wgt: 5,
    Description:
      'A simple thruster pack gives the user the ability to maneuver in zero-gravity. A Zero-G check is required to use a thruster pack accurately. Thruster packs can only be used in microgravity environments and are only practical for journeys between spacecraft at Adjacent range.'
  },
  {
    Name: 'Portable Generator',
    Category: cat.SURVIVAL_EQUIPMENT,
    TL: 10,
    Cost: 500000,
    Wgt: 15,
    Description:
      'This is a heavy-duty portable fusion generator, capable of recharging weapons and other equipment for up to one month of use.'
  }
])

const toolKits = Object.freeze([
  {
    Name: 'Mechanical Toolkit',
    Category: cat.TOOL_KIT,
    TL: 4,
    Cost: 1000,
    Wgt: 12,
    Description:
      'Required for repairs and construction. This kit contains diagnostic sensors, hand tools, computer analysis programs (at appropriate tech levels) and spare parts.'
  },
  {
    Name: 'Electronics Toolkit',
    Category: cat.TOOL_KIT,
    TL: 5,
    Cost: 1000,
    Wgt: 12,
    Description:
      'Required for electrical repairs and installations. This kit contains diagnostic sensors, hand tools, computer analysis programs (at appropriate tech levels) and spare parts.'
  },
  {
    Name: 'Lock Pick Set',
    Category: cat.TOOL_KIT,
    TL: 5,
    Cost: 10,
    Wgt: 0,
    Description:
      'Allows picking of ordinary mechanical locks. Lock pick sets are illegal on worlds of law level 8+; on such worlds the cost rises to Cr100 or more.'
  },
  {
    Name: 'Medical Kit',
    Category: cat.TOOL_KIT,
    TL: 7,
    Cost: 1000,
    Wgt: 10,
    Description:
      'This medical kit contains diagnostic devices and scanners, surgical tools and a plethora of drugs and antibiotics, allowing a medic to practice his art in the field.'
  },
  {
    Name: 'Forensics Toolkit',
    Category: cat.TOOL_KIT,
    TL: 8,
    Cost: 1000,
    Wgt: 12,
    Description:
      'Required for investigating crime scenes and testing samples. This kit contains diagnostic sensors, hand tools, computer analysis programs (at appropriate tech levels) and spare parts.'
  },
  {
    Name: 'Engineering Toolkit',
    Category: cat.TOOL_KIT,
    TL: 9,
    Cost: 1000,
    Wgt: 12,
    Description:
      'Required for performing repairs and installing new equipment. This kit contains diagnostic sensors, hand tools, computer analysis programs (at appropriate tech levels) and spare parts.'
  },
  {
    Name: 'Scientific Toolkit',
    Category: cat.TOOL_KIT,
    TL: 9,
    Cost: 1000,
    Wgt: 12,
    Description:
      'Required for scientific testing and analysis. This kit contains diagnostic sensors, hand tools, computer analysis programs (at appropriate tech levels) and spare parts.'
  },
  {
    Name: 'Surveying Toolkit',
    Category: cat.TOOL_KIT,
    TL: 9,
    Cost: 1000,
    Wgt: 12,
    Description:
      'Required for planetary surveys or mapping. This kit contains diagnostic sensors, hand tools, computer analysis programs (at appropriate tech levels) and spare parts.'
  }
])

const meleeWeapons = Object.freeze([
  {
    Name: 'Unarmed Strike',
    Category: cat.MELEE_WEAPON,
    TL: 0,
    Cost: 0,
    Wgt: 0,
    Range: 'melee (close quarters)',
    Dmg: '1D6',
    Type: 'B',
    LL: 0,
    Description: ''
  },
  {
    Name: 'Cudgel',
    Category: cat.MELEE_WEAPON,
    TL: 0,
    Cost: 10,
    Wgt: 1,
    Range: 'melee (close quarters)',
    Dmg: '3D6',
    Type: 'B',
    LL: 9,
    Description:
      'A basic stick used as a weapon. Easily obtained from standing trees or through the use of an unloaded long gun such as a rifle or carbine (laser weapons are too delicate to be used as cudgels). Length: 1000 to 2000mm.'
  },
  {
    Name: 'Dagger',
    Category: cat.MELEE_WEAPON,
    TL: 0,
    Cost: 10,
    Wgt: 0.25,
    Range: 'melee (close quarters) or ranged (thrown)',
    Dmg: '1D6',
    Type: 'P',
    LL: 5,
    Description:
      'A small knife weapon with a flat, two-edged blade approximately 200mm in length. Daggers are usually carried in a belt sheath, or less frequently concealed in a boot sheath or strapped to the forearm. Daggers are usually as much a tool as a last-resort weapon of defense, and worn constantly. Each weighs 250 grams; that weight, however, does not count against the weight load of the character as the weapon is worn constantly and comfortably.'
  },
  {
    Name: 'Spear',
    Category: cat.MELEE_WEAPON,
    TL: 0,
    Cost: 10,
    Wgt: 1.5,
    Range: 'melee (extended reach) or ranged (thrown)',
    Dmg: '3D6',
    Type: 'P',
    LL: 8,
    Description:
      'A weapon with a long shaft and a pointed tip, typically of metal, used for thrusting or throwing. Length: 3000mm.'
  },
  {
    Name: 'Pike',
    Category: cat.MELEE_WEAPON,
    TL: 1,
    Cost: 40,
    Wgt: 8,
    Range: 'melee (extended reach)',
    Dmg: '4D6',
    Type: 'P',
    LL: 8,
    Description:
      'A two-handed weapon with a pointed steel or iron head on a long wooden shaft. Length: 3000 to 4000mm.'
  },
  {
    Name: 'Sword',
    Category: cat.MELEE_WEAPON,
    TL: 1,
    Cost: 150,
    Wgt: 1,
    Range: 'melee (extended reach)',
    Dmg: '3D6',
    Type: 'P/S',
    LL: 8,
    Description:
      'The standard long-edged weapon, featuring a flat, two-edged blade. It may or may not have a basket hilt or hand protector. A scabbard to carry the sword may be attached to the belt, or to straps (or a sash) over the shoulder. Blade length may vary from 700 to 950mm.'
  },
  {
    Name: 'Broadsword',
    Category: cat.MELEE_WEAPON,
    TL: 2,
    Cost: 300,
    Wgt: 3,
    Range: 'melee (extended reach)',
    Dmg: '4D6',
    Type: 'S',
    LL: 8,
    Description:
      'The largest of the sword weapons, also called the two-handed sword because it requires both hands to swing. The blade is extremely heavy, two-edged, and about 1000 to 1200mm in length. The hilt is relatively simple, generally a cross-piece only, with little basketwork or protection. When carried, the broadsword is worn in a metal scabbard attached to the belt; less frequently, the scabbard is worn on the back, and the broadsword is drawn over the shoulder.'
  },
  {
    Name: 'Halberd',
    Category: cat.MELEE_WEAPON,
    TL: 2,
    Cost: 75,
    Wgt: 3,
    Range: 'melee (extended reach)',
    Dmg: '4D6',
    Type: 'S',
    LL: 8,
    Description:
      'A two-handed pole weapon having an axe-like blade and a steel spike mounted on the end of a long shaft. Length: 2500mm.'
  },
  {
    Name: 'Bayonet',
    Category: cat.MELEE_WEAPON,
    TL: 3,
    Cost: 10,
    Wgt: 0.25,
    Range: 'melee (close quarters)',
    Dmg: '1D6',
    Type: 'P',
    LL: 5,
    Description:
      'A small knife-like weapon similar to a dagger, frequently attached to a rifle. When not attached to a rifle, the bayonet performs as a dagger.'
  },
  {
    Name: 'Blade',
    Category: cat.MELEE_WEAPON,
    TL: 3,
    Cost: 50,
    Wgt: 0.35,
    Range: 'melee (extended reach)',
    Dmg: '2D6',
    Type: 'P',
    LL: 8,
    Description:
      'A hybrid knife weapon with a heavy, flat two-edged blade nearly 300mm in length, and (often, but not always) a semi-basket handguard. Because of the bulk of the handguard, it is generally carried in a belt scabbard. Blades are as much survival tools as weapons, and are often found in emergency kits, lifeboats etc.'
  },
  {
    Name: 'Cutlass',
    Category: cat.MELEE_WEAPON,
    TL: 3,
    Cost: 100,
    Wgt: 1.25,
    Range: 'melee (extended reach)',
    Dmg: '3D6',
    Type: 'S',
    LL: 8,
    Description:
      'A heavy, flat-bladed, single-edged weapon featuring a full basket hilt to protect the hand. The cutlass is the standard shipboard blade weapon and sometimes kept in lockers on the bulkhead near important locations; when worn, a belt scabbard is used. Blade length varies from 600 to 900mm.'
  },
  {
    Name: 'Foil',
    Category: cat.MELEE_WEAPON,
    TL: 3,
    Cost: 100,
    Wgt: 0.5,
    Range: 'melee (extended reach)',
    Dmg: '3D6',
    Type: 'P',
    LL: 8,
    Description:
      'Also known as the rapier, this weapon is a light, sword-like weapon with a pointed, edged blade 800mm in length, and a basket or cup hilt to protect the hand. Foils are worn in scabbards attached to the belt.'
  }
])

const rangedWeapons = Object.freeze([
  {
    Name: 'Bow',
    Category: cat.RANGED_WEAPON,
    TL: 1,
    Cost: 60,
    Wgt: 1,
    RoF: '1',
    Range: 'ranged (assault weapon)',
    Dmg: '2D6',
    Type: 'P',
    Recoil: true,
    LL: 6
  },
  {
    Name: 'Crossbow',
    Category: cat.RANGED_WEAPON,
    TL: 2,
    Cost: 75,
    Wgt: 3,
    RoF: '1',
    Range: 'ranged (rifle)',
    Dmg: '2D6',
    Type: 'P',
    Recoil: true,
    LL: 6
  },
  {
    Name: 'Revolver',
    Category: cat.RANGED_WEAPON,
    TL: 4,
    Cost: 150,
    Wgt: 0.9,
    RoF: '1',
    Range: 'ranged (pistol)',
    Dmg: '2D6',
    Type: 'P',
    Recoil: true,
    LL: 6
  },
  {
    Name: 'Auto Pistol',
    Category: cat.RANGED_WEAPON,
    TL: 5,
    Cost: 200,
    Wgt: 0.75,
    RoF: '1',
    Range: 'ranged (pistol)',
    Dmg: '2D6',
    Type: 'P',
    Recoil: true,
    LL: 6
  },
  {
    Name: 'Carbine',
    Category: cat.RANGED_WEAPON,
    TL: 5,
    Cost: 200,
    Wgt: 3,
    RoF: '1',
    Range: 'ranged (shotgun)',
    Dmg: '2D6',
    Type: 'P',
    Recoil: true,
    LL: 6
  },
  {
    Name: 'Rifle',
    Category: cat.RANGED_WEAPON,
    TL: 5,
    Cost: 200,
    Wgt: 4,
    RoF: '1',
    Range: 'ranged (rifle)',
    Dmg: '3D6',
    Type: 'P',
    Recoil: true,
    LL: 6
  },
  {
    Name: 'Shotgun',
    Category: cat.RANGED_WEAPON,
    TL: 5,
    Cost: 1500,
    Wgt: 3.75,
    RoF: '1',
    Range: 'ranged (shotgun)',
    Dmg: '4D6',
    Type: 'P',
    Recoil: true,
    LL: 7
  },
  {
    Name: 'Submachinegun',
    Category: cat.RANGED_WEAPON,
    TL: 5,
    Cost: 500,
    Wgt: 2.5,
    RoF: '0/4',
    Range: 'ranged (assault weapon)',
    Dmg: '2D6',
    Type: 'P',
    Recoil: true,
    LL: 4
  },
  {
    Name: 'Auto Rifle',
    Category: cat.RANGED_WEAPON,
    TL: 6,
    Cost: 1000,
    Wgt: 5,
    RoF: '1/4',
    Range: 'ranged (rifle)',
    Dmg: '3D6',
    Type: 'P',
    Recoil: true,
    LL: 6
  },
  {
    Name: 'Assault Rifle',
    Category: cat.RANGED_WEAPON,
    TL: 7,
    Cost: 300,
    Wgt: 3,
    RoF: '1/4',
    Range: 'ranged (rifle)',
    Dmg: '3D6',
    Type: 'P',
    Recoil: true,
    LL: 4
  },
  {
    Name: 'Body Pistol',
    Category: cat.RANGED_WEAPON,
    TL: 7,
    Cost: 500,
    Wgt: 0.25,
    RoF: '1',
    Range: 'ranged (pistol)',
    Dmg: '2D6',
    Type: 'P',
    Recoil: true,
    LL: 1
  },
  {
    Name: 'Laser Carbine',
    Category: cat.RANGED_WEAPON,
    TL: 8,
    Cost: 2500,
    Wgt: 5,
    RoF: '1',
    Range: 'ranged (pistol)',
    Dmg: '4D6',
    Type: 'E',
    Recoil: false,
    LL: 2
  },
  {
    Name: 'Snub Pistol',
    Category: cat.RANGED_WEAPON,
    TL: 8,
    Cost: 150,
    Wgt: 0.25,
    RoF: '1',
    Range: 'ranged (pistol)',
    Dmg: '2D6',
    Type: 'P',
    Recoil: true,
    LL: 6
  },
  {
    Name: 'Accelerator Rifle',
    Category: cat.RANGED_WEAPON,
    TL: 9,
    Cost: 900,
    Wgt: 2.5,
    RoF: '1/3',
    Range: 'ranged (rifle)',
    Dmg: '3D6',
    Type: 'P',
    Recoil: false,
    LL: 6
  },
  {
    Name: 'Laser Rifle',
    Category: cat.RANGED_WEAPON,
    TL: 9,
    Cost: 3500,
    Wgt: 6,
    RoF: '1',
    Range: 'ranged (rifle)',
    Dmg: '5D6',
    Type: 'E',
    Recoil: false,
    LL: 2
  },
  {
    Name: 'Advanced Combat Rifle',
    Category: cat.RANGED_WEAPON,
    TL: 10,
    Cost: 1000,
    Wgt: 3.5,
    RoF: '1/4',
    Range: 'ranged (rifle)',
    Dmg: '3D6',
    Type: 'P',
    Recoil: true,
    LL: 6
  },
  {
    Name: 'Gauss Rifle',
    Category: cat.RANGED_WEAPON,
    TL: 12,
    Cost: 1500,
    Wgt: 3.5,
    RoF: '1/4/10',
    Range: 'ranged (rifle)',
    Dmg: '4D6',
    Type: 'P',
    Recoil: false,
    LL: 6
  },
  {
    Name: 'Laser Pistol',
    Category: cat.RANGED_WEAPON,
    TL: 12,
    Cost: 1000,
    Wgt: 1.2,
    RoF: '1',
    Range: 'ranged (pistol)',
    Dmg: '4D6',
    Type: 'E',
    Recoil: false,
    LL: 2
  }
])

const ammo = Object.freeze([
  {
    Name: 'Bow',
    Category: cat.AMMO,
    TL: 1,
    Cost: 1,
    Wgt: 0.025,
    Rounds: 1
  },
  {
    Name: 'Crossbow',
    Category: cat.AMMO,
    TL: 2,
    Cost: 2,
    Wgt: 0.02,
    Rounds: 1
  },
  {
    Name: 'Revolver',
    Category: cat.AMMO,
    TL: 4,
    Cost: 5,
    Wgt: 0.1,
    Rounds: 6
  },
  {
    Name: 'Auto Pistol',
    Category: cat.AMMO,
    TL: 5,
    Cost: 10,
    Wgt: 0.25,
    Rounds: 15
  },
  {
    Name: 'Body Pistol',
    Category: cat.AMMO,
    TL: 7,
    Cost: 20,
    Wgt: 0.05,
    Rounds: 6
  },
  {
    Name: 'Snub Pistol',
    Category: cat.AMMO,
    TL: 8,
    Cost: 10,
    Wgt: 30,
    Rounds: 6
  },
  {
    Name: 'Shotgun',
    Category: cat.AMMO,
    TL: 5,
    Cost: 10,
    Wgt: 0.75,
    Rounds: 10
  },
  {
    Name: 'Rifle',
    Category: cat.AMMO,
    TL: 5,
    Cost: 20,
    Wgt: 0.5,
    Rounds: 10
  },
  {
    Name: 'Carbine',
    Category: cat.AMMO,
    TL: 5,
    Cost: 10,
    Wgt: 0.125,
    Rounds: 20
  },
  {
    Name: 'Auto Rifle',
    Category: cat.AMMO,
    TL: 6,
    Cost: 20,
    Wgt: 0.5,
    Rounds: 20
  },
  {
    Name: 'Assault Rifle',
    Category: cat.AMMO,
    TL: 7,
    Cost: 20,
    Wgt: 0.33,
    Rounds: 30
  },
  {
    Name: 'Accelerator Rifle',
    Category: cat.AMMO,
    TL: 9,
    Cost: 25,
    Wgt: 0.5,
    Rounds: 15
  },
  {
    Name: 'Advanced Combat Rifle',
    Category: cat.AMMO,
    TL: 10,
    Cost: 15,
    Wgt: 0.5,
    Rounds: 20
  },
  {
    Name: 'Gauss Rifle',
    Category: cat.AMMO,
    TL: 12,
    Cost: 30,
    Wgt: 0.4,
    Rounds: 40
  },
  {
    Name: 'Submachinegun',
    Category: cat.AMMO,
    TL: 5,
    Cost: 20,
    Wgt: 0.5,
    Rounds: 30
  },
  {
    Name: 'Laser Pistol',
    Category: cat.AMMO,
    TL: 12,
    Cost: 100,
    Wgt: 0.5,
    Rounds: 25
  },
  {
    Name: 'Laser Carbine',
    Category: cat.AMMO,
    TL: 8,
    Cost: 200,
    Wgt: 3,
    Rounds: 50
  },
  {
    Name: 'Laser Rifle',
    Category: cat.AMMO,
    TL: 9,
    Cost: 300,
    Wgt: 4,
    Rounds: 100
  },
  {
    Name: 'Grenade Launcher',
    Category: cat.AMMO,
    TL: 7,
    Cost: 180,
    Wgt: 0.5,
    Rounds: 6
  },
  {
    Name: 'Rocket Launcher',
    Category: cat.AMMO,
    TL: 7,
    Cost: 300,
    Wgt: 1,
    Rounds: 1
  },
  {
    Name: 'RAM Grenade Launcher',
    Category: cat.AMMO,
    TL: 8,
    Cost: 180,
    Wgt: 0.5,
    Rounds: 6
  },
  {
    Name: 'PGMP',
    Category: cat.AMMO,
    TL: 12,
    Cost: 2500,
    Wgt: 6,
    Rounds: 40
  },
  {
    Name: 'FGMP',
    Category: cat.AMMO,
    TL: 14,
    Cost: 65000,
    Wgt: 9,
    Rounds: 40
  }
])

const accessories = Object.freeze([
  {
    Name: 'Shoulder Stocks',
    Category: cat.ACCESSORY,
    TL: 5,
    Cost: 75,
    Wgt: 1
  },
  {
    Name: 'Folding Stocks',
    Category: cat.ACCESSORY,
    TL: 6,
    Cost: 100,
    Wgt: 0.5
  },
  {
    Name: 'Telescopic Sights',
    Category: cat.ACCESSORY,
    TL: 6,
    Cost: 200,
    Wgt: 0.8
  },
  {
    Name: 'Grenade Launcher',
    Category: cat.ACCESSORY,
    TL: 8,
    Cost: 1000,
    Wgt: 0
  },
  {
    Name: 'Laser Sights',
    Category: cat.ACCESSORY,
    TL: 8,
    Cost: 100,
    Wgt: 1.5
  },
  {
    Name: 'Silencer',
    Category: cat.ACCESSORY,
    TL: 8,
    Cost: 250,
    Wgt: 0
  },
  {
    Name: 'Gyrostabilizer',
    Category: cat.ACCESSORY,
    TL: 9,
    Cost: 300,
    Wgt: 0
  },
  {
    Name: 'Laser Telescopic Sights',
    Category: cat.ACCESSORY,
    TL: 9,
    Cost: 3000,
    Wgt: 1.8
  },
  {
    Name: 'Secure Weapon',
    Category: cat.ACCESSORY,
    TL: 10,
    Cost: 100,
    Wgt: 0
  },
  {
    Name: 'Intelligent Weapon',
    Category: cat.ACCESSORY,
    TL: 11,
    Cost: 1000,
    Wgt: 0
  }
])

const grenades = Object.freeze([
  {
    Name: 'Frag',
    Category: cat.GRENADE,
    TL: 6,
    Cost: 180,
    Wgt: 0.5,
    Dmg: '5D6/3D6/1D6',
    LL: 1,
    Description:
      'The damage from fragmentation grenades decreases with distance from the blast: 3m 5D6, 6m 3D6, 9m 1D6'
  },
  {
    Name: 'Smoke',
    Category: cat.GRENADE,
    TL: 6,
    Cost: 90,
    Wgt: 0.5,
    Dmg: 'Special',
    LL: 1,
    Description:
      'Smoke grenades create a thick cloud of smoke six meters in radius, centered on the location of the grenade. This smoke imposes a –2 DM on all attacks within or through the cloud (doubled for laser weapons). Smoke dissipates in 1D6x3 rounds, although high winds and other extreme weather can sharply reduce this time.'
  },
  {
    Name: 'Aerosol',
    Category: cat.GRENADE,
    TL: 9,
    Cost: 90,
    Wgt: 0.5,
    Dmg: 'Special',
    LL: 1,
    Description:
      'Aerosol grenades create a fine mist six meters in radius that diffuses lasers but does not block normal vision. Any laser attack made through the mist has its damage reduced by 10. Laser communications through the mist are completely blocked. The mist dissipates in 1D6x3 rounds, although high winds and other extreme weather can sharply reduce this time.'
  },
  {
    Name: 'Stun',
    Category: cat.GRENADE,
    TL: 9,
    Cost: 180,
    Wgt: 0.5,
    Dmg: '3D6 stun',
    LL: 1,
    Description:
      'Stun weapons, such as stun grenades, are non-lethal and do not inflict normal damage. A character within six meters of a stun grenade detonation must make an Endurance check with a negative DM equal to the damage (after armor is subtracted). If this Endurance check is failed the character is knocked unconscious. If the Endurance check is successful, the character is unaffected by the weapon and the stun damage is ignored.'
  }
])

const heavyWeapons = Object.freeze([
  {
    Name: 'Grenade Launcher',
    Category: cat.HEAVY_WEAPON,
    TL: 7,
    Cost: 400,
    Wgt: 6,
    RoF: 1,
    Range: 'ranged (shotgun)',
    Dmg: 'By grenade',
    Recoil: true,
    LL: 3,
    Description:
      'Grenade launchers are used to fire grenades over long distances. Grenades for a grenade launcher are not interchangeable with handheld grenades.'
  },
  {
    Name: 'Rocket Launcher',
    Category: cat.HEAVY_WEAPON,
    TL: 7,
    Cost: 2000,
    Wgt: 6,
    RoF: 1,
    Range: 'ranged (rocket)',
    Dmg: '4D6',
    Recoil: false,
    LL: 3,
    Description:
      'To counteract the recoil of the weapon, a rocket launcher channels exhaust backwards in an explosive back blast. Anyone up to 1.5 meters behind a rocket launcher when it fires takes 3D6 damage from the burning gasses. Vehicle-mounted rocket launchers lose this side-effect as a vehicle is a more stable firing platform than a person. It takes three minor actions to reload a rocket launcher.\n' +
      '\n' +
      'The rockets presented are high-explosive models. Do not add the Effect of the attack roll to their damage but apply that damage to everything within six meters of the impact point. A rocket that misses has a 50% chance (4+ on 1D6) of detonating upon impact with the ground (6 – Effect meters away in a random direction). Otherwise it will miss completely and leave the battlefield without striking anything or detonating.'
  },
  {
    Name: 'RAM Grenade Launcher',
    Category: cat.HEAVY_WEAPON,
    TL: 8,
    Cost: 800,
    Wgt: 6,
    RoF: '1/3',
    Range: 'ranged (assault weapon)',
    Dmg: 'By grenade',
    Recoil: true,
    LL: 3,
    Description:
      'Rocket Assisted Multi-purpose grenade launchers have a longer range and are capable of firing up to three grenades with a single attack. This uses the rules for firing on full auto; unlike other automatic weapons, a RAM grenade launcher cannot fire in burst mode. It takes two minor actions to reload a RAM grenade launcher. Grenades for a RAM grenade launcher are not interchangeable with handheld grenades.'
  },
  {
    Name: 'PGMP',
    Category: cat.HEAVY_WEAPON,
    TL: 12,
    Cost: 20000,
    Wgt: 10,
    RoF: '1/4',
    Range: 'ranged (rifle)',
    Dmg: '10D6',
    Recoil: true,
    LL: 2,
    Description:
      "It is so heavy and bulky that it can only be used easily by a trooper with a Strength of 12 or more – usually attained by wearing battle dress. Every point by which a user's Strength falls short is a –1 DM on any attack rolls made with it."
  },
  {
    Name: 'FGMP',
    Category: cat.HEAVY_WEAPON,
    TL: 14,
    Cost: 100000,
    Wgt: 12,
    RoF: '1/4',
    Range: 'ranged (rifle)',
    Dmg: '16D6',
    Recoil: true,
    LL: 2,
    Description:
      'It includes a gravity suspension system to reduce its inertia, making it easier to use than the PGMP (minimum Strength 9) and fires what amounts to a directed nuclear explosion. Those without radiation protection who are nearby when a FGMP is fired will suffer a lethal dose of radiation – each firing of an FGMP emits 2D6 x 20 rads, which will affect everyone within the immediate vicinity.'
  }
])

module.exports = {
  armor,
  communicators,
  computers,
  software,
  drugs,
  explosives,
  personalDevices,
  sensoryAids,
  shelters,
  survivalEquipment,
  toolKits,
  meleeWeapons,
  rangedWeapons,
  ammo,
  accessories,
  grenades,
  heavyWeapons
}
