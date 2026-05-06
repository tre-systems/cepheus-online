import type { Command } from '../../shared/commands'
import type { CharacterId, PieceId } from '../../shared/ids'
import type {
  BoardState,
  CharacterCharacteristics,
  CharacterEquipmentItem,
  CharacterType,
  GameState
} from '../../shared/state'
import {
  characteristicModifier,
  evaluateCareerCheck,
  parseCareerCheck
} from '../../shared/character-creation/career-rules.js'
import {
  CEPHEUS_SRD_CAREERS,
  type CepheusCareerDefinition
} from '../../shared/character-creation/cepheus-srd-ruleset.js'
import {
  normalizeCareerSkill,
  parseCareerSkill,
  resolveCascadeCareerSkill,
  tallyCareerSkills
} from '../../shared/character-creation/skills.js'
import type { ClientIdentity } from '../game-commands.js'
import { uniqueCharacterId, uniquePieceId } from './bootstrap-flow.js'
import {
  createCharacterCreationFlow,
  selectCharacterCreationCareerPlan,
  validateCurrentCharacterCreationStep
} from './character-creation-flow.js'

export interface CreateCharacterCommandPlanInput {
  identity: ClientIdentity
  state: GameState | null
  board: BoardState | null
  name: string
  characterType: CharacterType
  age: number | null
  characteristics: CharacterCharacteristics
  skills: string[]
  equipment: CharacterEquipmentItem[]
  credits: number
  notes: string
  createLinkedPiece: boolean
  existingPieceCount: number
  career?: string
  drafted?: boolean
  creationOutcome?: PlayableCreationOutcome
}

export interface GenerateCharacterInput {
  identity: ClientIdentity
  state: GameState | null
  board: BoardState | null
  name?: string
  generated?: GeneratedCharacterSummary
  createLinkedPiece: boolean
  existingPieceCount: number
  rng?: () => number
}

export type CreateCharacterCommandPlan =
  | {
      ok: true
      commands: Command[]
      characterId: CharacterId
      pieceId: PieceId | null
    }
  | {
      ok: false
      error: string
      focus: 'name' | 'skills' | null
    }

export interface GeneratedCharacterSummary {
  name: string
  career: string
  age: number
  characteristics: CharacterCharacteristics
  skills: string[]
  credits: number
  notes: string
  qualificationRoll: number
  survivalRoll: number
  survivalPassed: boolean
  commissionRoll: number | null
  commissionPassed: boolean | null
  advancementRoll: number | null
  advancementPassed: boolean | null
  drafted: boolean
  creationOutcome: PlayableCreationOutcome
}

export interface GenerateCharacterPreviewInput {
  state: Pick<GameState, 'characters'> | null
  name?: string
  rng?: () => number
}

export type GenerateCharacterCommandPlan =
  | (Extract<CreateCharacterCommandPlan, { ok: true }> & {
      generated: GeneratedCharacterSummary
    })
  | Extract<CreateCharacterCommandPlan, { ok: false }>

export interface PlayableCreationOutcome {
  survivalPassed: boolean
  canCommission: boolean
  commissionPassed: boolean | null
  canAdvance: boolean
  advancementPassed: boolean | null
}

const GENERATED_NAMES = [
  'Mae',
  'Fred',
  'Zoop',
  'Erit',
  'Kade',
  'Nia',
  'Rook',
  'Vera',
  'Sable',
  'Tamsin',
  'Juno',
  'Mara'
] as const

const GENERATED_CASCADE_SKILLS: Record<string, readonly string[]> = {
  'Aircraft*': ['Rotor Aircraft', 'Fixed Wing Aircraft', 'Grav Vehicle'],
  'Animals*': ['Veterinary Medicine', 'Riding', 'Training'],
  'Gun Combat*': ['Laser Pistol', 'Slug Pistol', 'Laser Rifle', 'Slug Rifle'],
  'Gunnery*': ['Turret Weapons', 'Bay Weapons', 'Ortillery'],
  'Melee Combat*': ['Blade', 'Bludgeoning Weapons', 'Natural Weapons'],
  'Sciences*': ['Life Sciences', 'Physical Sciences', 'Social Sciences'],
  'Vehicle*': ['Grav Vehicle', 'Tracked Vehicle', 'Wheeled Vehicle']
}

const defaultCreationHomeworld = () => ({
  name: null,
  lawLevel: 'Low Law',
  tradeCodes: ['Industrial']
})

const DEFAULT_CREATION_CASCADE_SKILL = 'Gun Combat-0'
const DEFAULT_CREATION_CASCADE_SELECTION = 'Slug Pistol'
const DEFAULT_CREATION_BACKGROUND_POOL = [
  'Admin-0',
  'Computer-0',
  'Mechanics-0',
  'Medicine-0',
  'Electronics-0'
] as const

const defaultBackgroundSkillsFor = (
  characteristics: CharacterCharacteristics
): string[] => {
  const allowance = 3 + characteristicModifier(characteristics.edu)
  const additionalSelections = Math.max(0, allowance - 2)
  return [
    'Broker-0',
    'Slug Pistol-0',
    ...DEFAULT_CREATION_BACKGROUND_POOL.slice(0, additionalSelections)
  ]
}

const sequenceCommandAt = <T extends Command>(
  command: T,
  state: Pick<GameState, 'eventSeq'>,
  offset: number
): T => {
  if (command.expectedSeq !== undefined || command.type === 'CreateGame') {
    return command
  }

  return {
    ...command,
    expectedSeq: state.eventSeq + offset
  }
}

const playableCreationCommands = (
  identity: ClientIdentity,
  characterId: CharacterId,
  outcome: PlayableCreationOutcome = {
    survivalPassed: true,
    canCommission: false,
    commissionPassed: null,
    canAdvance: true,
    advancementPassed: true
  }
): Command[] => {
  const advance = (
    creationEvent: Extract<
      Command,
      { type: 'AdvanceCharacterCreation' }
    >['creationEvent']
  ): Command => ({
    type: 'AdvanceCharacterCreation',
    gameId: identity.gameId,
    actorId: identity.actorId,
    characterId,
    creationEvent
  })

  const commands = [advance({ type: 'COMPLETE_BASIC_TRAINING' })]

  if (!outcome.survivalPassed) {
    return [...commands, advance({ type: 'SURVIVAL_FAILED' })]
  }

  commands.push(
    advance({
      type: 'SURVIVAL_PASSED',
      canCommission: outcome.canCommission,
      canAdvance: outcome.canAdvance
    })
  )

  if (outcome.canCommission) {
    commands.push(
      advance({
        type: outcome.commissionPassed
          ? 'COMPLETE_COMMISSION'
          : 'SKIP_COMMISSION'
      })
    )
  } else if (outcome.canAdvance) {
    commands.push(
      advance({
        type: outcome.advancementPassed
          ? 'COMPLETE_ADVANCEMENT'
          : 'SKIP_ADVANCEMENT'
      })
    )
  }

  commands.push(
    advance({ type: 'COMPLETE_SKILLS' }),
    advance({ type: 'COMPLETE_AGING' }),
    advance({ type: 'LEAVE_CAREER' }),
    advance({ type: 'FINISH_MUSTERING' }),
    advance({ type: 'CREATION_COMPLETE' })
  )

  return commands
}

const playableCareerPlan = ({
  career,
  drafted,
  outcome = {
    survivalPassed: true,
    canCommission: false,
    commissionPassed: null,
    canAdvance: true,
    advancementPassed: true
  }
}: {
  career: string
  drafted: boolean
  outcome?: PlayableCreationOutcome
}) =>
  selectCharacterCreationCareerPlan(career, {
    drafted,
    qualificationRoll: drafted ? null : 8,
    survivalRoll: outcome.survivalPassed ? 8 : 2,
    commissionRoll: outcome.canCommission
      ? outcome.commissionPassed
        ? 8
        : 2
      : null,
    advancementRoll: outcome.canAdvance
      ? outcome.advancementPassed
        ? 8
        : 2
      : null
  })

const initialCreationCommands = ({
  identity,
  state,
  characterId,
  characterType,
  name,
  career,
  drafted,
  characteristics
}: {
  identity: ClientIdentity
  state: GameState
  characterId: CharacterId
  characterType: CharacterType
  name: string
  career: string
  drafted: boolean
  characteristics: CharacterCharacteristics
}): Command[] =>
  [
    {
      type: 'CreateCharacter',
      gameId: identity.gameId,
      actorId: identity.actorId,
      characterId,
      characterType,
      name
    },
    {
      type: 'StartCharacterCreation',
      gameId: identity.gameId,
      actorId: identity.actorId,
      characterId
    },
    {
      type: 'AdvanceCharacterCreation',
      gameId: identity.gameId,
      actorId: identity.actorId,
      characterId,
      creationEvent: { type: 'SET_CHARACTERISTICS' }
    },
    {
      type: 'SetCharacterCreationHomeworld',
      gameId: identity.gameId,
      actorId: identity.actorId,
      characterId,
      homeworld: defaultCreationHomeworld()
    },
    ...DEFAULT_CREATION_BACKGROUND_POOL.slice(
      0,
      Math.max(0, 3 + characteristicModifier(characteristics.edu) - 2)
    ).map(
      (skill): Command => ({
        type: 'SelectCharacterCreationBackgroundSkill',
        gameId: identity.gameId,
        actorId: identity.actorId,
        characterId,
        skill
      })
    ),
    {
      type: 'ResolveCharacterCreationCascadeSkill',
      gameId: identity.gameId,
      actorId: identity.actorId,
      characterId,
      cascadeSkill: DEFAULT_CREATION_CASCADE_SKILL,
      selection: DEFAULT_CREATION_CASCADE_SELECTION
    },
    {
      type: 'AdvanceCharacterCreation',
      gameId: identity.gameId,
      actorId: identity.actorId,
      characterId,
      creationEvent: { type: 'COMPLETE_HOMEWORLD' }
    },
    {
      type: 'StartCharacterCareerTerm',
      gameId: identity.gameId,
      actorId: identity.actorId,
      characterId,
      career,
      drafted
    },
    {
      type: 'AdvanceCharacterCreation',
      gameId: identity.gameId,
      actorId: identity.actorId,
      characterId,
      creationEvent: { type: 'SELECT_CAREER', isNewCareer: true, drafted }
    }
  ].map((command, index) => sequenceCommandAt(command as Command, state, index))

const randomInt = (rng: () => number, maxExclusive: number): number =>
  Math.floor(rng() * maxExclusive)

const rollDie = (rng: () => number): number => randomInt(rng, 6) + 1

const roll2d6 = (rng: () => number): number => rollDie(rng) + rollDie(rng)

const selectFrom = <T>(rng: () => number, values: readonly T[]): T =>
  values[randomInt(rng, values.length)]

const shuffledCareers = (rng: () => number): CepheusCareerDefinition[] => {
  const careers = [...CEPHEUS_SRD_CAREERS]
  for (let index = careers.length - 1; index > 0; index--) {
    const swapIndex = randomInt(rng, index + 1)
    const current = careers[index]
    careers[index] = careers[swapIndex]
    careers[swapIndex] = current
  }
  return careers
}

const resolveGeneratedCascadeSkill = (
  rng: () => number,
  skill: string,
  level: number
): string | null => {
  const cascade = skill.trim()
  const options = GENERATED_CASCADE_SKILLS[cascade]
  if (!options || options.length === 0)
    return normalizeCareerSkill(skill, level)

  const pendingSkill = normalizeCareerSkill(cascade, level)
  if (!pendingSkill) return null

  const parsed = parseCareerSkill(pendingSkill)
  const selection = selectFrom(rng, options)
  const resolved = resolveCascadeCareerSkill({
    pendingCascadeSkills: [pendingSkill],
    cascadeSkill: pendingSkill,
    selection
  })

  return (
    resolved.termSkills[0] ??
    normalizeCareerSkill(selection, parsed?.level ?? level)
  )
}

const normalizeGeneratedSkill = (
  rng: () => number,
  skill: string,
  level = 0
): string | null =>
  skill.includes('*')
    ? resolveGeneratedCascadeSkill(rng, skill, level)
    : normalizeCareerSkill(skill, level)

const addSkill = (
  rng: () => number,
  skills: string[],
  skill: string,
  level = 0
) => {
  const normalized = normalizeGeneratedSkill(rng, skill, level)
  if (normalized) skills.push(normalized)
}

const applyPersonalDevelopment = (
  characteristics: CharacterCharacteristics,
  entry: string
): string | null => {
  const characteristic = /^\+1 (Str|Dex|End|Int|Edu|Soc)$/i.exec(entry)
  if (!characteristic) return null

  const key = characteristic[1].toLowerCase() as keyof CharacterCharacteristics
  characteristics[key] = (characteristics[key] ?? 0) + 1
  return `${characteristic[1]} +1`
}

const chooseQualifiedCareer = ({
  rng,
  characteristics,
  notes
}: {
  rng: () => number
  characteristics: CharacterCharacteristics
  notes: string[]
}): {
  career: CepheusCareerDefinition
  qualificationRoll: number
  drafted: boolean
} => {
  for (const career of shuffledCareers(rng)) {
    const qualificationRoll = roll2d6(rng)
    const outcome = evaluateCareerCheck({
      check: career.qualification,
      characteristics,
      roll: qualificationRoll
    })
    if (!outcome) continue
    notes.push(
      `${career.name} qualification: ${qualificationRoll} + ${outcome.modifier} = ${outcome.total} vs ${career.qualification} (${outcome.success ? 'passed' : 'failed'})`
    )
    if (outcome.success) {
      return { career, qualificationRoll, drafted: false }
    }
  }

  const drifter =
    CEPHEUS_SRD_CAREERS.find((career) => career.name === 'Drifter') ??
    CEPHEUS_SRD_CAREERS[0]
  const qualificationRoll = roll2d6(rng)
  notes.push(
    'No preferred career qualification succeeded; drafted into Drifter.'
  )
  return { career: drifter, qualificationRoll, drafted: true }
}

const resolveCareerRoll = ({
  check,
  characteristics,
  roll
}: {
  check: string
  characteristics: CharacterCharacteristics
  roll: number
}) =>
  evaluateCareerCheck({
    check,
    characteristics,
    roll
  })

export const generateCharacterPreview = ({
  state,
  name,
  rng = Math.random
}: GenerateCharacterPreviewInput): GeneratedCharacterSummary => {
  const notes: string[] = [
    'Generated by the Cepheus Online character generator.'
  ]
  const characteristics: CharacterCharacteristics = {
    str: roll2d6(rng),
    dex: roll2d6(rng),
    end: roll2d6(rng),
    int: roll2d6(rng),
    edu: roll2d6(rng),
    soc: roll2d6(rng)
  }
  notes.push(
    `Characteristics: Str ${characteristics.str}, Dex ${characteristics.dex}, End ${characteristics.end}, Int ${characteristics.int}, Edu ${characteristics.edu}, Soc ${characteristics.soc}.`
  )

  const { career, qualificationRoll, drafted } = chooseQualifiedCareer({
    rng,
    characteristics,
    notes
  })
  const skills: string[] = []
  for (const skill of career.serviceSkills) addSkill(rng, skills, skill, 0)

  const trainingTables = [
    career.personalDevelopment,
    career.serviceSkills,
    career.specialistSkills,
    career.advancedEducation
  ]
  const trainingNotes: string[] = []
  for (let pick = 0; pick < 2; pick++) {
    const trainingTable = selectFrom(rng, trainingTables)
    const trainingEntry = selectFrom(rng, trainingTable)
    const characteristicGain = applyPersonalDevelopment(
      characteristics,
      trainingEntry
    )
    if (characteristicGain) {
      trainingNotes.push(characteristicGain)
    } else {
      const before = skills.length
      addSkill(rng, skills, trainingEntry, 1)
      trainingNotes.push(
        skills[before] ?? trainingEntry.replace('*', '').trim()
      )
    }
  }
  notes.push(`Training: ${trainingNotes.join(', ')}.`)

  const survivalRoll = roll2d6(rng)
  const survival = resolveCareerRoll({
    check: career.survival,
    characteristics,
    roll: survivalRoll
  })
  const survivalPassed = survival?.success ?? true
  notes.push(
    `${career.name} survival: ${survivalRoll} + ${survival?.modifier ?? 0} = ${survival?.total ?? survivalRoll} vs ${career.survival} (${survivalPassed ? 'passed' : 'mishap'}).`
  )

  const canCommission =
    survivalPassed && parseCareerCheck(career.commission) !== null
  const commissionRoll = canCommission ? roll2d6(rng) : null
  const commission =
    commissionRoll === null
      ? null
      : resolveCareerRoll({
          check: career.commission,
          characteristics,
          roll: commissionRoll
        })
  const commissionPassed = commission?.success ?? null
  if (commissionRoll !== null && commission) {
    notes.push(
      `${career.name} commission: ${commissionRoll} + ${commission.modifier} = ${commission.total} vs ${career.commission} (${commissionPassed ? 'passed' : 'not commissioned'}).`
    )
  }

  const canAdvance =
    survivalPassed &&
    !canCommission &&
    parseCareerCheck(career.advancement) !== null
  const advancementRoll = canAdvance ? roll2d6(rng) : null
  const advancement =
    advancementRoll === null
      ? null
      : resolveCareerRoll({
          check: career.advancement,
          characteristics,
          roll: advancementRoll
        })
  const advancementPassed = advancement?.success ?? null
  if (advancementRoll !== null && advancement) {
    notes.push(
      `${career.name} advancement: ${advancementRoll} + ${advancement.modifier} = ${advancement.total} vs ${career.advancement} (${advancementPassed ? 'advanced' : 'held rank'}).`
    )
  }

  const cashRoll = rollDie(rng)
  const credits = cashRoll * 1000
  notes.push(`Mustering out cash: ${cashRoll}000 credits.`)

  return {
    name:
      (name ?? '').trim() ||
      `${selectFrom(rng, GENERATED_NAMES)} ${Object.keys(state?.characters ?? {}).length + 1}`,
    career: career.name,
    age: 22,
    characteristics,
    skills: tallyCareerSkills(skills),
    credits,
    notes: notes.join('\n'),
    qualificationRoll,
    survivalRoll,
    survivalPassed,
    commissionRoll,
    commissionPassed,
    advancementRoll,
    advancementPassed,
    creationOutcome: {
      survivalPassed,
      canCommission,
      commissionPassed,
      canAdvance,
      advancementPassed
    },
    drafted
  }
}

export const planCreatePlayableCharacterCommands = ({
  identity,
  state,
  board,
  name,
  characterType,
  age,
  characteristics,
  skills,
  equipment,
  credits,
  notes,
  createLinkedPiece,
  existingPieceCount,
  career,
  drafted = false,
  creationOutcome
}: CreateCharacterCommandPlanInput): CreateCharacterCommandPlan => {
  if (!state) {
    return {
      ok: false,
      error: 'Open or create a room before creating a character',
      focus: null
    }
  }

  const trimmedName = name.trim()
  if (!trimmedName) {
    return {
      ok: false,
      error: 'Character name is required',
      focus: 'name'
    }
  }
  if (skills.length === 0) {
    return {
      ok: false,
      error: 'At least one skill is required',
      focus: 'skills'
    }
  }

  const characterId = uniqueCharacterId(state, trimmedName)
  const validation = validateCurrentCharacterCreationStep({
    ...createCharacterCreationFlow(characterId, {
      name: trimmedName,
      characterType,
      age,
      homeworld: defaultCreationHomeworld(),
      backgroundSkills: defaultBackgroundSkillsFor(characteristics),
      pendingCascadeSkills: [],
      careerPlan: playableCareerPlan({
        career: career ?? 'Scout',
        drafted,
        outcome: creationOutcome
      }),
      characteristics,
      skills,
      equipment,
      credits,
      notes
    }),
    step: 'review'
  })
  if (!validation.ok) {
    return {
      ok: false,
      error: validation.errors.join(', ') || 'Character details are incomplete',
      focus: null
    }
  }

  const initialCommands = initialCreationCommands({
    identity,
    state,
    characterId,
    characterType,
    name: trimmedName,
    career: career ?? 'Scout',
    drafted,
    characteristics
  })

  const finishCommands = playableCreationCommands(
    identity,
    characterId,
    creationOutcome
  ).map((command, index) =>
    sequenceCommandAt(command, state, initialCommands.length + index)
  )

  const finalizeCommand = sequenceCommandAt(
    {
      type: 'FinalizeCharacterCreation',
      gameId: identity.gameId,
      actorId: identity.actorId,
      characterId,
      age,
      characteristics: { ...characteristics },
      skills: [...skills],
      equipment: equipment.map((item) => ({ ...item })),
      credits,
      notes
    },
    state,
    initialCommands.length + finishCommands.length
  )

  const pieceId =
    createLinkedPiece && board ? uniquePieceId(state, trimmedName) : null
  const pieceCommand =
    pieceId && board
      ? [
          sequenceCommandAt(
            {
              type: 'CreatePiece',
              gameId: identity.gameId,
              actorId: identity.actorId,
              pieceId,
              boardId: board.id,
              characterId,
              name: trimmedName,
              imageAssetId: null,
              x: Math.max(
                0,
                Math.min(board.width - 50, 160 + (existingPieceCount % 8) * 58)
              ),
              y: Math.max(
                0,
                Math.min(
                  board.height - 50,
                  140 + Math.floor(existingPieceCount / 8) * 58
                )
              ),
              width: 50,
              height: 50,
              scale: 1
            },
            state,
            initialCommands.length + finishCommands.length + 1
          )
        ]
      : []

  return {
    ok: true,
    commands: [
      ...initialCommands,
      ...finishCommands,
      finalizeCommand,
      ...pieceCommand
    ],
    characterId,
    pieceId
  }
}

export const planGeneratePlayableCharacterCommands = ({
  identity,
  state,
  board,
  name,
  generated,
  createLinkedPiece,
  existingPieceCount,
  rng = Math.random
}: GenerateCharacterInput): GenerateCharacterCommandPlan => {
  if (!state) {
    return {
      ok: false,
      error: 'Open or create a room before generating a character',
      focus: null
    }
  }

  const preview = generated ?? generateCharacterPreview({ state, name, rng })
  const plan = planCreatePlayableCharacterCommands({
    identity,
    state,
    board,
    name: preview.name,
    characterType: 'PLAYER',
    age: preview.age,
    characteristics: preview.characteristics,
    skills: preview.skills,
    equipment: [],
    credits: preview.credits,
    notes: preview.notes,
    createLinkedPiece,
    existingPieceCount,
    career: preview.career,
    drafted: preview.drafted,
    creationOutcome: preview.creationOutcome
  })

  if (!plan.ok) return plan

  return {
    ...plan,
    generated: preview
  }
}
