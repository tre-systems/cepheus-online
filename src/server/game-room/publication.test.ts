import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { CEPHEUS_SRD_RULESET } from '../../shared/character-creation/cepheus-srd-ruleset'
import type { Command, GameCommand } from '../../shared/commands'
import {
  asBoardId,
  asCharacterId,
  asEventId,
  asGameId,
  asPieceId,
  asUserId
} from '../../shared/ids'
import { LIVE_DICE_RESULT_REVEAL_DELAY_MS } from '../../shared/live-activity'
import { filterGameStateForViewer } from '../../shared/viewer'
import { getProjectedGameState } from './projection'
import { CommandPublicationError, runCommandPublication } from './publication'
import { buildRoomStateMessage } from './queries'
import {
  appendEvents,
  gameSeedKey,
  readCheckpoint,
  readEventStream,
  readEventStreamTail
} from './storage'
import { createMemoryStorage } from './test-support'

const gameId = asGameId('game-1')
const actorId = asUserId('user-1')

type AgingLossCommand = {
  type: 'ResolveCharacterCreationAgingLosses'
  gameId: typeof gameId
  actorId: typeof actorId
  expectedSeq?: number
  characterId: ReturnType<typeof asCharacterId>
  selectedLosses: Array<{
    type: 'PHYSICAL' | 'MENTAL'
    modifier: number
    characteristic: 'str' | 'dex' | 'end' | 'int' | 'edu' | 'soc'
  }>
}

const publish = (
  storage: ReturnType<typeof createMemoryStorage>,
  command: GameCommand | AgingLossCommand,
  requestId = `req-${command.type}`
) =>
  runCommandPublication(storage, gameId, {
    type: 'command',
    requestId,
    command: command as Command
  })

const createGameCommand = (): Command => ({
  type: 'CreateGame',
  gameId,
  actorId,
  slug: 'game-1',
  name: 'Spinward Test'
})

const createBoardCommand = (boardId = asBoardId('board-1')): Command => ({
  type: 'CreateBoard',
  gameId,
  actorId,
  boardId,
  name: 'Downport',
  width: 1000,
  height: 800,
  scale: 50
})

const characteristicKeys = ['str', 'dex', 'end', 'int', 'edu', 'soc'] as const

const publishCharacterCreationCharacteristics = async (
  storage: ReturnType<typeof createMemoryStorage>,
  characterId: ReturnType<typeof asCharacterId>
) => {
  let lastResult: Awaited<ReturnType<typeof publish>> | null = null

  for (const characteristic of characteristicKeys) {
    const result = await publish(storage, {
      type: 'RollCharacterCreationCharacteristic',
      gameId,
      actorId,
      characterId,
      characteristic
    })
    assert.equal(result.ok, true, result.ok ? undefined : result.error.message)
    if (!result.ok) return result
    lastResult = result
  }

  if (!lastResult) {
    throw new Error('No character creation characteristics were rolled')
  }
  return lastResult
}

const publishEducationCorrection = async (
  storage: ReturnType<typeof createMemoryStorage>,
  characterId: ReturnType<typeof asCharacterId>,
  edu = 8
) => {
  const result = await publish(storage, {
    type: 'UpdateCharacterSheet',
    gameId,
    actorId,
    characterId,
    characteristics: { edu }
  })

  assert.equal(result.ok, true, result.ok ? undefined : result.error.message)
  return result
}

const publishCareerQualification = async (
  storage: ReturnType<typeof createMemoryStorage>,
  characterId: ReturnType<typeof asCharacterId>,
  career = 'Scout'
) => {
  const result = await publish(storage, {
    type: 'ResolveCharacterCreationQualification',
    gameId,
    actorId,
    characterId,
    career
  })

  assert.equal(result.ok, true, result.ok ? undefined : result.error.message)
  if (!result.ok) return result
  assert.equal(
    result.value.state.characters[characterId]?.creation?.state.status,
    'BASIC_TRAINING'
  )
  return result
}

const publishBasicTrainingCompletion = (
  storage: ReturnType<typeof createMemoryStorage>,
  characterId: ReturnType<typeof asCharacterId>
) =>
  publish(storage, {
    type: 'CompleteCharacterCreationBasicTraining',
    gameId,
    actorId,
    characterId
  })

const publishSkillsCompletion = (
  storage: ReturnType<typeof createMemoryStorage>,
  characterId: ReturnType<typeof asCharacterId>
) =>
  publish(storage, {
    type: 'CompleteCharacterCreationSkills',
    gameId,
    actorId,
    characterId
  })

const publishAgingResolution = (
  storage: ReturnType<typeof createMemoryStorage>,
  characterId: ReturnType<typeof asCharacterId>
) =>
  publish(storage, {
    type: 'ResolveCharacterCreationAging',
    gameId,
    actorId,
    characterId
  })

const publishAnagathicsDecline = (
  storage: ReturnType<typeof createMemoryStorage>,
  characterId: ReturnType<typeof asCharacterId>
) =>
  publish(storage, {
    type: 'DecideCharacterCreationAnagathics',
    gameId,
    actorId,
    characterId,
    useAnagathics: false
  })

const publishSurvivalResolution = (
  storage: ReturnType<typeof createMemoryStorage>,
  characterId: ReturnType<typeof asCharacterId>
) =>
  publish(storage, {
    type: 'ResolveCharacterCreationSurvival',
    gameId,
    actorId,
    characterId
  })

const publishReenlistmentResolution = (
  storage: ReturnType<typeof createMemoryStorage>,
  characterId: ReturnType<typeof asCharacterId>
) =>
  publish(storage, {
    type: 'ResolveCharacterCreationReenlistment',
    gameId,
    actorId,
    characterId
  })

const publishCareerReenlistment = (
  storage: ReturnType<typeof createMemoryStorage>,
  characterId: ReturnType<typeof asCharacterId>
) =>
  publish(storage, {
    type: 'ReenlistCharacterCreationCareer',
    gameId,
    actorId,
    characterId
  })

const publishCareerLeave = (
  storage: ReturnType<typeof createMemoryStorage>,
  characterId: ReturnType<typeof asCharacterId>
) =>
  publish(storage, {
    type: 'LeaveCharacterCreationCareer',
    gameId,
    actorId,
    characterId
  })

const publishRequiredTermSkillCompletion = async (
  storage: ReturnType<typeof createMemoryStorage>,
  characterId: ReturnType<typeof asCharacterId>
) => {
  let lastResult: Awaited<ReturnType<typeof publish>> | null = null

  for (let rollCount = 0; rollCount < 4; rollCount += 1) {
    const rolled = await publish(storage, {
      type: 'RollCharacterCreationTermSkill',
      gameId,
      actorId,
      characterId,
      table: 'personalDevelopment'
    })
    assert.equal(rolled.ok, true, rolled.ok ? undefined : rolled.error.message)
    if (!rolled.ok) return rolled
    lastResult = rolled

    let pendingCascade =
      rolled.value.state.characters[
        characterId
      ]?.creation?.pendingCascadeSkills?.at(-1)
    while (pendingCascade) {
      const resolved = await publish(storage, {
        type: 'ResolveCharacterCreationTermCascadeSkill',
        gameId,
        actorId,
        characterId,
        cascadeSkill: pendingCascade,
        selection: firstCascadeSelection(pendingCascade)
      })
      assert.equal(
        resolved.ok,
        true,
        resolved.ok ? undefined : resolved.error.message
      )
      if (!resolved.ok) return resolved
      lastResult = resolved
      pendingCascade =
        resolved.value.state.characters[
          characterId
        ]?.creation?.pendingCascadeSkills?.at(-1)
    }

    if (
      lastResult.ok &&
      lastResult.value.state.characters[characterId]?.creation?.state.status !==
        'SKILLS_TRAINING'
    ) {
      return lastResult
    }

    const completed = await publishSkillsCompletion(storage, characterId)
    if (completed.ok) return completed

    assert.equal(
      completed.error.message,
      'COMPLETE_SKILLS is blocked until required term skills are rolled'
    )
  }

  assert.equal(
    true,
    false,
    'Required term skills were not completed after four rolls'
  )
  return lastResult ?? publishSkillsCompletion(storage, characterId)
}

const firstCascadeSelection = (cascadeSkill: string): string =>
  CEPHEUS_SRD_RULESET.cascadeSkills[
    cascadeSkill.replace(/\*$/, '')
  ]?.[0]?.replace(/\*$/, '') ?? cascadeSkill.replace(/\*$/, '')

const publishCreationCompletion = (
  storage: ReturnType<typeof createMemoryStorage>,
  characterId: ReturnType<typeof asCharacterId>
) =>
  publish(storage, {
    type: 'CompleteCharacterCreation',
    gameId,
    actorId,
    characterId
  })

const publishPlayableCharacterCreation = async (
  storage: ReturnType<typeof createMemoryStorage>,
  characterId = asCharacterId('char-1')
): Promise<void> => {
  await publish(storage, createGameCommand())
  await storage.put(gameSeedKey(gameId), 5)
  await publish(storage, {
    type: 'CreateCharacter',
    gameId,
    actorId,
    characterId,
    characterType: 'PLAYER',
    name: 'Scout'
  })
  await publish(storage, {
    type: 'StartCharacterCreation',
    gameId,
    actorId,
    characterId
  })

  await publishCharacterCreationCharacteristics(storage, characterId)
  const homeworldSet = await publish(storage, {
    type: 'SetCharacterCreationHomeworld',
    gameId,
    actorId,
    characterId,
    homeworld: {
      name: 'Regina',
      lawLevel: 'No Law',
      tradeCodes: ['Asteroid', 'Industrial']
    }
  })
  assert.equal(homeworldSet.ok, true)

  const cascadeResolved = await publish(storage, {
    type: 'ResolveCharacterCreationCascadeSkill',
    gameId,
    actorId,
    characterId,
    cascadeSkill: 'Gun Combat-0',
    selection: 'Slug Rifle'
  })
  assert.equal(cascadeResolved.ok, true)

  const homeworldCompleted = await publish(storage, {
    type: 'CompleteCharacterCreationHomeworld',
    gameId,
    actorId,
    characterId
  })
  assert.equal(homeworldCompleted.ok, true)
  await publishCareerQualification(storage, characterId)
  const basicTrainingCompleted = await publishBasicTrainingCompletion(
    storage,
    characterId
  )
  assert.equal(basicTrainingCompleted.ok, true)
  assert.equal((await publishSurvivalResolution(storage, characterId)).ok, true)
  assert.equal(
    (await publishRequiredTermSkillCompletion(storage, characterId)).ok,
    true
  )
  assert.equal((await publishAnagathicsDecline(storage, characterId)).ok, true)
  assert.equal((await publishAgingResolution(storage, characterId)).ok, true)
  assert.equal(
    (await publishReenlistmentResolution(storage, characterId)).ok,
    true
  )
  assert.equal((await publishCareerLeave(storage, characterId)).ok, true)
  assert.equal(
    (
      await publish(storage, {
        type: 'RollCharacterCreationMusteringBenefit',
        gameId,
        actorId,
        characterId,
        career: 'Scout',
        kind: 'material'
      })
    ).ok,
    true
  )
  assert.equal(
    (
      await publish(storage, {
        type: 'CompleteCharacterCreationMustering',
        gameId,
        actorId,
        characterId
      })
    ).ok,
    true
  )
  assert.equal((await publishCreationCompletion(storage, characterId)).ok, true)
}

describe('room publication flow', () => {
  it('returns one state-bearing publication for accepted commands', async () => {
    const storage = createMemoryStorage()

    const accepted = await publish(storage, createGameCommand())

    assert.equal(accepted.ok, true)
    if (!accepted.ok) return
    assert.deepEqual(Object.keys(accepted.value).sort(), [
      'eventSeq',
      'liveActivities',
      'requestId',
      'state'
    ])
    assert.equal(accepted.value.eventSeq, accepted.value.state.eventSeq)
    assert.deepEqual(accepted.value.liveActivities, [])
  })

  it('exposes derived dice activity for accepted dice commands', async () => {
    const storage = createMemoryStorage()
    await publish(storage, createGameCommand())

    const rolled = await publish(storage, {
      type: 'RollDice',
      gameId,
      actorId,
      expression: '2d6',
      reason: 'Table roll'
    })

    assert.equal(rolled.ok, true)
    if (!rolled.ok) return
    assert.equal(rolled.value.liveActivities.length, 1)
    assert.equal(rolled.value.liveActivities[0]?.type, 'diceRoll')
    assert.equal(rolled.value.liveActivities[0]?.seq, 2)
    assert.equal(rolled.value.liveActivities[0]?.actorId, actorId)
    if (rolled.value.liveActivities[0]?.type !== 'diceRoll') return
    assert.equal(rolled.value.liveActivities[0].expression, '2d6')
    assert.equal(rolled.value.liveActivities[0].reason, 'Table roll')
    assert.deepEqual(
      rolled.value.liveActivities[0].rolls,
      rolled.value.state.diceLog[0]?.rolls
    )
    assert.equal(
      rolled.value.liveActivities[0].total,
      rolled.value.state.diceLog[0]?.total
    )
  })

  it('publishes character creation dice with the same live reveal contract', async () => {
    const storage = createMemoryStorage()
    await publish(storage, createGameCommand())

    const rolled = await publish(storage, {
      type: 'RollDice',
      gameId,
      actorId,
      expression: '2d6',
      reason: 'Scout survival'
    })

    assert.equal(rolled.ok, true)
    if (!rolled.ok) return
    const persisted = await readEventStream(storage, gameId)
    assert.equal(persisted.at(-1)?.event.type, 'DiceRolled')
    assert.equal(rolled.value.liveActivities.length, 1)
    const activity = rolled.value.liveActivities[0]
    assert.equal(activity?.type, 'diceRoll')
    if (activity?.type !== 'diceRoll') return
    const stateRoll = rolled.value.state.diceLog.at(-1)
    assert.equal(activity.reason, 'Scout survival')
    assert.equal(activity.id, stateRoll?.id)
    assert.deepEqual(activity.rolls, stateRoll?.rolls)
    assert.equal(activity.total, stateRoll?.total)
    assert.equal(activity.reveal.revealAt, stateRoll?.revealAt)
    assert.equal(activity.reveal.delayMs, LIVE_DICE_RESULT_REVEAL_DELAY_MS)
  })

  it('publishes semantic characteristic completion after the sixth stat roll', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-characteristics')
    await publish(storage, createGameCommand())
    await publish(storage, {
      type: 'CreateCharacter',
      gameId,
      actorId,
      characterId,
      characterType: 'PLAYER',
      name: 'Scout'
    })
    await publish(storage, {
      type: 'StartCharacterCreation',
      gameId,
      actorId,
      characterId
    })

    let lastRoll: Awaited<ReturnType<typeof publish>> | null = null
    for (const characteristic of [
      'str',
      'dex',
      'end',
      'int',
      'edu',
      'soc'
    ] as const) {
      lastRoll = await publish(storage, {
        type: 'RollCharacterCreationCharacteristic',
        gameId,
        actorId,
        characterId,
        characteristic
      })
      assert.equal(lastRoll.ok, true)
    }

    assert.equal(lastRoll?.ok, true)
    if (!lastRoll?.ok) return
    const persisted = await readEventStream(storage, gameId)
    assert.equal(
      persisted.at(-1)?.event.type,
      'CharacterCreationCharacteristicsCompleted'
    )
    const finalEvent = persisted.at(-1)?.event
    assert.equal(finalEvent?.type, 'CharacterCreationCharacteristicsCompleted')
    if (finalEvent?.type !== 'CharacterCreationCharacteristicsCompleted') return
    assert.equal(finalEvent.rollEventId, asEventId(`${gameId}:14`))
    assert.equal(
      persisted.some(
        (envelope) =>
          envelope.event.type === 'CharacterCreationTransitioned' &&
          envelope.event.creationEvent.type === 'SET_CHARACTERISTICS'
      ),
      false
    )
    const creation = lastRoll.value.state.characters[characterId]?.creation
    assert.equal(creation?.state.status, 'HOMEWORLD')
    assert.deepEqual(creation?.history, [{ type: 'SET_CHARACTERISTICS' }])
    assert.deepEqual(
      lastRoll.value.liveActivities.map((activity) => activity.type),
      ['diceRoll', 'characterCreation', 'characterCreation']
    )
    const activity = lastRoll.value.liveActivities.at(-1)
    assert.equal(activity?.type, 'characterCreation')
    if (activity?.type !== 'characterCreation') return
    assert.equal(activity.transition, 'SET_CHARACTERISTICS')
    assert.equal(activity.details, 'Characteristics assigned')
    assert.equal(activity.reveal?.rollEventId, asEventId(`${gameId}:14`))
    assert.equal(activity.reveal?.delayMs, LIVE_DICE_RESULT_REVEAL_DELAY_MS)
    assert.equal(activity.status, 'HOMEWORLD')
    assert.equal(activity.creationComplete, false)
  })

  it('publishes semantic aging resolution with seeded dice and activity', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-aging')
    await storage.put(gameSeedKey(gameId), 5)
    await publish(storage, createGameCommand())
    await publish(storage, {
      type: 'CreateCharacter',
      gameId,
      actorId,
      characterId,
      characterType: 'PLAYER',
      name: 'Scout'
    })
    await publish(storage, {
      type: 'StartCharacterCreation',
      gameId,
      actorId,
      characterId
    })

    await publishCharacterCreationCharacteristics(storage, characterId)
    const homeworldSet = await publish(storage, {
      type: 'SetCharacterCreationHomeworld',
      gameId,
      actorId,
      characterId,
      homeworld: {
        name: 'Regina',
        lawLevel: 'No Law',
        tradeCodes: ['Asteroid', 'Industrial']
      }
    })
    assert.equal(
      homeworldSet.ok,
      true,
      homeworldSet.ok ? undefined : homeworldSet.error.message
    )
    const cascadeResolved = await publish(storage, {
      type: 'ResolveCharacterCreationCascadeSkill',
      gameId,
      actorId,
      characterId,
      cascadeSkill: 'Gun Combat-0',
      selection: 'Slug Rifle'
    })
    assert.equal(
      cascadeResolved.ok,
      true,
      cascadeResolved.ok ? undefined : cascadeResolved.error.message
    )
    const homeworldCompleted = await publish(storage, {
      type: 'CompleteCharacterCreationHomeworld',
      gameId,
      actorId,
      characterId
    })
    assert.equal(homeworldCompleted.ok, true)
    await publishCareerQualification(storage, characterId)
    const basicTrainingCompleted = await publishBasicTrainingCompletion(
      storage,
      characterId
    )
    assert.equal(basicTrainingCompleted.ok, true)
    const survival = await publish(storage, {
      type: 'ResolveCharacterCreationSurvival',
      gameId,
      actorId,
      characterId
    })
    assert.equal(
      survival.ok,
      true,
      survival.ok ? undefined : survival.error.message
    )
    const serviceSkill = await publish(storage, {
      type: 'RollCharacterCreationTermSkill',
      gameId,
      actorId,
      characterId,
      table: 'serviceSkills'
    })
    assert.equal(
      serviceSkill.ok,
      true,
      serviceSkill.ok ? undefined : serviceSkill.error.message
    )
    if (!serviceSkill.ok) return
    const pendingTermCascade =
      serviceSkill.value.state.characters[characterId]?.creation
        ?.pendingCascadeSkills?.[0]
    if (pendingTermCascade) {
      const resolvedCascade = await publish(storage, {
        type: 'ResolveCharacterCreationTermCascadeSkill',
        gameId,
        actorId,
        characterId,
        cascadeSkill: pendingTermCascade,
        selection: firstCascadeSelection(pendingTermCascade)
      })
      assert.equal(
        resolvedCascade.ok,
        true,
        resolvedCascade.ok ? undefined : resolvedCascade.error.message
      )
    }
    const specialistSkill = await publish(storage, {
      type: 'RollCharacterCreationTermSkill',
      gameId,
      actorId,
      characterId,
      table: 'specialistSkills'
    })
    assert.equal(
      specialistSkill.ok,
      true,
      specialistSkill.ok ? undefined : specialistSkill.error.message
    )
    if (
      specialistSkill.ok &&
      specialistSkill.value.state.characters[characterId]?.creation?.state
        .status === 'SKILLS_TRAINING'
    ) {
      const skillsCompleted = await publishSkillsCompletion(
        storage,
        characterId
      )
      assert.equal(
        skillsCompleted.ok,
        true,
        skillsCompleted.ok ? undefined : skillsCompleted.error.message
      )
    }
    const anagathics = await publish(storage, {
      type: 'DecideCharacterCreationAnagathics',
      gameId,
      actorId,
      characterId,
      useAnagathics: false
    })
    assert.equal(
      anagathics.ok,
      true,
      anagathics.ok ? undefined : anagathics.error.message
    )
    if (!anagathics.ok) return
    assert.equal(anagathics.value.liveActivities.length, 1)
    assert.equal(anagathics.value.liveActivities[0]?.type, 'characterCreation')
    assert.equal(
      anagathics.value.liveActivities[0]?.type === 'characterCreation'
        ? anagathics.value.liveActivities[0].transition
        : null,
      'DECIDE_ANAGATHICS'
    )

    const resolved = await publish(storage, {
      type: 'ResolveCharacterCreationAging',
      gameId,
      actorId,
      characterId
    })

    assert.equal(resolved.ok, true)
    if (!resolved.ok) return
    const events = (await readEventStream(storage, gameId)).map(
      (envelope) => envelope.event
    )
    assert.equal(
      events.some(
        (event) => event.type === 'CharacterCreationAnagathicsDecided'
      ),
      true
    )
    assert.deepEqual(
      events.slice(-2).map((event) => event.type),
      ['DiceRolled', 'CharacterCreationAgingResolved']
    )
    assert.equal(resolved.value.liveActivities.length, 2)
    assert.equal(resolved.value.liveActivities[0]?.type, 'diceRoll')
    assert.equal(resolved.value.liveActivities[1]?.type, 'characterCreation')
    const agingEvent = events.at(-1)
    assert.equal(agingEvent?.type, 'CharacterCreationAgingResolved')
    if (agingEvent?.type !== 'CharacterCreationAgingResolved') return
    assert.deepEqual(agingEvent.aging.roll.rolls, [5, 5])
    assert.equal(agingEvent.aging.roll.total, 10)
    assert.equal(
      resolved.value.state.characters[characterId]?.age,
      agingEvent.aging.age
    )
    assert.deepEqual(
      resolved.value.state.characters[characterId]?.creation?.history?.at(-1),
      {
        type: 'COMPLETE_AGING',
        aging: agingEvent.aging
      }
    )
  })

  it('publishes semantic reenlistment resolution with seeded dice and activity', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-reenlistment')
    await appendEvents(
      storage,
      gameId,
      actorId,
      [
        {
          type: 'GameCreated',
          slug: 'game-1',
          name: 'Spinward Test',
          ownerId: actorId
        },
        {
          type: 'CharacterCreated',
          characterId,
          ownerId: actorId,
          characterType: 'PLAYER',
          name: 'Scout'
        },
        {
          type: 'CharacterCreationStarted',
          characterId,
          creation: {
            state: {
              status: 'REENLISTMENT',
              context: {
                canCommission: false,
                canAdvance: false
              }
            },
            terms: [
              {
                career: 'Scout',
                skills: ['Vacc Suit-1'],
                skillsAndTraining: ['Vacc Suit-1'],
                benefits: [],
                complete: false,
                canReenlist: true,
                completedBasicTraining: true,
                musteringOut: false,
                anagathics: false,
                survival: 8
              }
            ],
            careers: [{ name: 'Scout', rank: 0 }],
            canEnterDraft: true,
            failedToQualify: false,
            characteristicChanges: [],
            creationComplete: false,
            homeworld: null,
            backgroundSkills: [],
            pendingCascadeSkills: [],
            history: []
          }
        }
      ],
      '2026-05-03T00:00:00.000Z'
    )

    const resolved = await publish(storage, {
      type: 'ResolveCharacterCreationReenlistment',
      gameId,
      actorId,
      characterId,
      expectedSeq: 3
    })

    assert.equal(resolved.ok, true)
    if (!resolved.ok) return
    assert.equal(typeof (await storage.get(gameSeedKey(gameId))), 'number')
    const storedEvents = await readEventStream(storage, gameId)
    const diceEnvelope = storedEvents.at(-2)
    const storedEnvelope = storedEvents.at(-1)
    const diceEvent = diceEnvelope?.event
    const storedEvent = storedEnvelope?.event
    assert.equal(diceEvent?.type, 'DiceRolled')
    assert.equal(storedEvent?.type, 'CharacterCreationReenlistmentResolved')
    if (
      diceEvent?.type !== 'DiceRolled' ||
      storedEvent?.type !== 'CharacterCreationReenlistmentResolved'
    ) {
      return
    }
    assert.equal(diceEvent.expression, '2d6')
    assert.equal(storedEvent.rollEventId, diceEnvelope?.id)
    assert.equal(diceEvent.reason, 'Scout reenlistment')
    assert.deepEqual(diceEvent.rolls, storedEvent.reenlistment.rolls)
    assert.equal(diceEvent.total, storedEvent.reenlistment.total)
    assert.equal(storedEvent.reenlistment.expression, '2d6')
    assert.equal(storedEvent.reenlistment.target, 6)
    assert.equal(storedEvent.reenlistment.outcome, storedEvent.outcome)

    const diceActivity = resolved.value.liveActivities.find(
      (candidate) => candidate.type === 'diceRoll'
    )
    const activity = resolved.value.liveActivities.find(
      (candidate) => candidate.type === 'characterCreation'
    )
    assert.equal(diceActivity?.type, 'diceRoll')
    assert.equal(activity?.type, 'characterCreation')
    if (
      diceActivity?.type !== 'diceRoll' ||
      activity?.type !== 'characterCreation'
    ) {
      return
    }
    assert.deepEqual(diceActivity.rolls, storedEvent.reenlistment.rolls)
    assert.equal(diceActivity.total, storedEvent.reenlistment.total)
    assert.equal(
      activity.transition,
      storedEvent.outcome === 'forced'
        ? 'REENLIST_FORCED'
        : storedEvent.outcome === 'allowed'
          ? 'REENLIST_ALLOWED'
          : 'REENLIST_BLOCKED'
    )

    const recovered = await getProjectedGameState(storage, gameId)
    const creation = recovered?.characters[characterId]?.creation
    if (storedEvent.outcome === 'blocked') {
      assert.equal(
        creation?.terms.at(-1)?.reEnlistment,
        storedEvent.reenlistment.total
      )
      assert.equal(creation?.terms.at(-1)?.musteringOut, false)
      assert.equal(creation?.terms.at(-1)?.canReenlist, false)
    } else {
      assert.equal(
        creation?.terms.at(-1)?.reEnlistment,
        storedEvent.reenlistment.total
      )
    }
    assert.deepEqual(creation?.history?.at(-1), {
      type: 'RESOLVE_REENLISTMENT',
      reenlistment: storedEvent.reenlistment
    })
  })

  it('publishes aging loss resolution and allows reenlistment afterward', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-aging-losses')
    await appendEvents(
      storage,
      gameId,
      actorId,
      [
        {
          type: 'GameCreated',
          slug: 'game-1',
          name: 'Spinward Test',
          ownerId: actorId
        },
        {
          type: 'CharacterCreated',
          characterId,
          ownerId: actorId,
          characterType: 'PLAYER',
          name: 'Scout'
        },
        {
          type: 'CharacterSheetUpdated',
          characterId,
          characteristics: {
            str: 7,
            dex: 8,
            end: 7,
            int: 9,
            edu: 8,
            soc: 6
          }
        },
        {
          type: 'CharacterCreationStarted',
          characterId,
          creation: {
            state: {
              status: 'REENLISTMENT',
              context: {
                canCommission: false,
                canAdvance: false
              }
            },
            terms: [
              {
                career: 'Scout',
                skills: ['Vacc Suit-1'],
                skillsAndTraining: ['Vacc Suit-1'],
                benefits: [],
                complete: false,
                canReenlist: true,
                completedBasicTraining: true,
                musteringOut: false,
                anagathics: false,
                survival: 8
              }
            ],
            careers: [{ name: 'Scout', rank: 0 }],
            canEnterDraft: true,
            failedToQualify: false,
            characteristicChanges: [
              { type: 'PHYSICAL', modifier: -1 },
              { type: 'PHYSICAL', modifier: -1 }
            ],
            creationComplete: false,
            homeworld: null,
            backgroundSkills: [],
            pendingCascadeSkills: [],
            history: []
          }
        }
      ],
      '2026-05-03T00:00:00.000Z'
    )

    const earlyReenlistment = await publish(storage, {
      type: 'ResolveCharacterCreationReenlistment',
      gameId,
      actorId,
      characterId,
      expectedSeq: 4
    })
    assert.equal(earlyReenlistment.ok, false)
    if (earlyReenlistment.ok) return
    assert.equal(earlyReenlistment.error.code, 'invalid_command')

    const losses = await publish(storage, {
      type: 'ResolveCharacterCreationAgingLosses',
      gameId,
      actorId,
      characterId,
      expectedSeq: 4,
      selectedLosses: [
        { type: 'PHYSICAL', modifier: -1, characteristic: 'str' },
        { type: 'PHYSICAL', modifier: -1, characteristic: 'dex' }
      ]
    })

    assert.equal(losses.ok, true)
    if (!losses.ok) return
    assert.equal(losses.value.liveActivities.length, 0)
    assert.deepEqual(
      losses.value.state.characters[characterId]?.creation
        ?.characteristicChanges,
      []
    )
    assert.deepEqual(
      losses.value.state.characters[characterId]?.characteristics,
      {
        str: 6,
        dex: 7,
        end: 7,
        int: 9,
        edu: 8,
        soc: 6
      }
    )

    const resolved = await publish(storage, {
      type: 'ResolveCharacterCreationReenlistment',
      gameId,
      actorId,
      characterId,
      expectedSeq: losses.value.eventSeq
    })

    assert.equal(resolved.ok, true)
    if (!resolved.ok) return
    const persistedEvents = (await readEventStream(storage, gameId)).map(
      (envelope) => envelope.event
    )
    assert.equal(
      persistedEvents.some(
        (event) =>
          (event as { type: string }).type ===
          'CharacterCreationAgingLossesResolved'
      ),
      true
    )
    assert.equal(
      persistedEvents.at(-1)?.type,
      'CharacterCreationReenlistmentResolved'
    )
  })

  it('publishes semantic mustering benefit and completion events', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-mustering')
    await appendEvents(
      storage,
      gameId,
      actorId,
      [
        {
          type: 'GameCreated',
          slug: 'game-1',
          name: 'Spinward Test',
          ownerId: actorId
        },
        {
          type: 'CharacterCreated',
          characterId,
          ownerId: actorId,
          characterType: 'PLAYER',
          name: 'Scout'
        },
        {
          type: 'CharacterCreationStarted',
          characterId,
          creation: {
            state: {
              status: 'MUSTERING_OUT',
              context: {
                canCommission: false,
                canAdvance: false
              }
            },
            terms: [
              {
                career: 'Scout',
                skills: ['Vacc Suit-1'],
                skillsAndTraining: ['Vacc Suit-1'],
                benefits: [],
                complete: true,
                canReenlist: false,
                completedBasicTraining: true,
                musteringOut: true,
                anagathics: false
              }
            ],
            careers: [{ name: 'Scout', rank: 0 }],
            canEnterDraft: true,
            failedToQualify: false,
            characteristicChanges: [],
            creationComplete: false,
            homeworld: null,
            backgroundSkills: [],
            pendingCascadeSkills: [],
            history: []
          }
        }
      ],
      '2026-05-03T00:00:00.000Z'
    )
    await storage.put(gameSeedKey(gameId), 1234)

    const rolled = await publish(storage, {
      type: 'RollCharacterCreationMusteringBenefit',
      gameId,
      actorId,
      characterId,
      expectedSeq: 3,
      career: 'Scout',
      kind: 'material'
    })

    assert.equal(rolled.ok, true)
    if (!rolled.ok) return
    const storedEvents = await readEventStream(storage, gameId)
    const diceEnvelope = storedEvents.at(-2)
    const benefitEnvelope = storedEvents.at(-1)
    const diceEvent = diceEnvelope?.event
    const benefitEvent = benefitEnvelope?.event
    assert.equal(diceEvent?.type, 'DiceRolled')
    assert.equal(benefitEvent?.type, 'CharacterCreationMusteringBenefitRolled')
    if (
      diceEvent?.type !== 'DiceRolled' ||
      benefitEvent?.type !== 'CharacterCreationMusteringBenefitRolled'
    ) {
      return
    }
    assert.equal(diceEvent.reason, 'Scout material mustering benefit')
    assert.equal(benefitEvent.rollEventId, diceEnvelope?.id)
    assert.deepEqual(diceEvent.rolls, benefitEvent.musteringBenefit.roll.rolls)
    assert.deepEqual(benefitEvent.musteringBenefit, {
      career: 'Scout',
      kind: 'material',
      roll: {
        expression: '2d6',
        rolls: [4, 3],
        total: 7
      },
      modifier: 0,
      tableRoll: 7,
      value: '-',
      credits: 0,
      materialItem: null
    })
    assert.equal(rolled.value.liveActivities.length, 2)
    assert.equal(rolled.value.liveActivities[1]?.type, 'characterCreation')
    if (rolled.value.liveActivities[1]?.type !== 'characterCreation') return
    assert.equal(
      rolled.value.liveActivities[1].details,
      'Mustering benefit; Scout; material; -; table roll 7'
    )
    assert.deepEqual(
      rolled.value.state.characters[characterId]?.creation?.terms[0]?.benefits,
      ['-']
    )

    const completed = await publish(storage, {
      type: 'CompleteCharacterCreationMustering',
      gameId,
      actorId,
      characterId,
      expectedSeq: 5
    })

    assert.equal(
      completed.ok,
      true,
      completed.ok ? undefined : completed.error.message
    )
    if (!completed.ok) return
    assert.equal(
      completed.value.state.characters[characterId]?.creation?.state.status,
      'ACTIVE'
    )
    assert.equal(completed.value.liveActivities[0]?.type, 'characterCreation')
    if (completed.value.liveActivities[0]?.type !== 'characterCreation') return
    assert.equal(
      completed.value.liveActivities[0].details,
      'Mustering out complete'
    )
  })

  it('rejects invalid commands without writing an event stream', async () => {
    const storage = createMemoryStorage()

    const rejected = await publish(storage, {
      type: 'CreateBoard',
      gameId,
      actorId,
      boardId: asBoardId('board-1'),
      name: 'Downport',
      width: 1000,
      height: 800,
      scale: 50
    })

    assert.equal(rejected.ok, false)
    assert.equal(storage.records.size, 0)
  })

  it('throws an internal publication error when checkpoint recovery fails after append', async () => {
    const storage = createMemoryStorage()
    const get = storage.get.bind(storage)

    storage.get = async <T = unknown>(key: string): Promise<T | undefined> => {
      const value = await get<T>(key)

      if (key === `checkpoint:${gameId}` && value) {
        const checkpoint = value as unknown as {
          state: {
            name: string
          }
        }

        return {
          ...checkpoint,
          state: {
            ...checkpoint.state,
            name: `${checkpoint.state.name} (corrupt)`
          }
        } as T
      }

      return value
    }

    let thrown: unknown = null
    try {
      await publish(storage, createGameCommand())
    } catch (error) {
      thrown = error
    }

    assert.equal(thrown instanceof CommandPublicationError, true)
    assert.equal(
      (thrown as CommandPublicationError).code,
      'projection_mismatch'
    )
    assert.equal(
      (thrown as CommandPublicationError).message,
      'Stored event stream does not match live projection'
    )
    assert.equal((await readEventStream(storage, gameId)).length, 1)
  })

  it('throws an internal publication error when stored event parity fails after append', async () => {
    const storage = createMemoryStorage()
    await publish(storage, createGameCommand())

    const get = storage.get.bind(storage)
    let chunkReads = 0
    storage.get = async <T = unknown>(key: string): Promise<T | undefined> => {
      if (key === `events:${gameId}:chunk:0`) {
        chunkReads += 1
        const chunk = await get<T>(key)

        if (chunkReads >= 3 && Array.isArray(chunk)) {
          return chunk.filter((envelope) => envelope.seq < 2) as T
        }

        return chunk
      }

      return get<T>(key)
    }

    let thrown: unknown = null
    try {
      await publish(storage, createBoardCommand())
    } catch (error) {
      thrown = error
    }

    assert.equal(thrown instanceof CommandPublicationError, true)
    assert.equal(
      (thrown as CommandPublicationError).code,
      'projection_mismatch'
    )
    assert.equal(
      (thrown as CommandPublicationError).message,
      'Stored event stream does not match live projection'
    )

    storage.get = get
    assert.equal((await readEventStream(storage, gameId)).length, 2)
  })

  it('creates a game, checkpoints it, and projects tail events from storage', async () => {
    const storage = createMemoryStorage()

    const created = await publish(storage, createGameCommand())

    assert.equal(created.ok, true)
    if (!created.ok) return
    assert.equal(created.value.state.eventSeq, 1)
    assert.equal((await readCheckpoint(storage, gameId))?.seq, 1)

    const board = await publish(storage, {
      type: 'CreateBoard',
      gameId,
      actorId,
      boardId: asBoardId('board-1'),
      name: 'Downport',
      imageAssetId: 'board-image-1',
      url: '/assets/boards/downport.png',
      width: 1000,
      height: 800,
      scale: 50
    })

    assert.equal(board.ok, true)
    const projected = await getProjectedGameState(storage, gameId)
    assert.equal(projected?.eventSeq, 2)
    assert.equal(projected?.boards[asBoardId('board-1')]?.name, 'Downport')
    assert.equal(
      projected?.boards[asBoardId('board-1')]?.imageAssetId,
      'board-image-1'
    )
    assert.equal(
      projected?.boards[asBoardId('board-1')]?.url,
      '/assets/boards/downport.png'
    )
  })

  it('rejects stale expected sequence numbers before mutating storage', async () => {
    const storage = createMemoryStorage()
    await publish(storage, createGameCommand())
    await publish(storage, createBoardCommand())
    await publish(storage, {
      type: 'CreatePiece',
      gameId,
      actorId,
      pieceId: asPieceId('piece-1'),
      boardId: asBoardId('board-1'),
      name: 'Scout',
      x: 10,
      y: 10
    })

    const stale = await publish(storage, {
      type: 'MovePiece',
      gameId,
      actorId,
      pieceId: asPieceId('piece-1'),
      x: 20,
      y: 20,
      expectedSeq: 1
    })

    assert.equal(stale.ok, false)
    if (stale.ok) return
    assert.equal(stale.error.code, 'stale_command')
    assert.equal((await readEventStream(storage, gameId)).length, 3)
  })

  it('rejects stale expected sequence numbers on character sheet edits', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-1')
    await publish(storage, createGameCommand())
    await storage.put(gameSeedKey(gameId), 5)
    await publish(storage, {
      type: 'CreateCharacter',
      gameId,
      actorId,
      characterId,
      characterType: 'PLAYER',
      name: 'Scout'
    })

    const stale = await publish(storage, {
      type: 'UpdateCharacterSheet',
      gameId,
      actorId,
      characterId,
      expectedSeq: 1,
      notes: 'This should not append'
    })

    assert.equal(stale.ok, false)
    if (stale.ok) return
    assert.equal(stale.error.code, 'stale_command')
    assert.equal((await readEventStream(storage, gameId)).length, 2)
  })

  it('publishes and projects character creation events', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-1')
    await publish(storage, createGameCommand())
    await storage.put(gameSeedKey(gameId), 5)
    await publish(storage, {
      type: 'CreateCharacter',
      gameId,
      actorId,
      characterId,
      characterType: 'PLAYER',
      name: 'Scout'
    })

    const started = await publish(storage, {
      type: 'StartCharacterCreation',
      gameId,
      actorId,
      characterId,
      expectedSeq: 2
    })

    assert.equal(started.ok, true)
    if (!started.ok) return
    assert.deepEqual(started.value.liveActivities, [
      {
        id: 'game-1:3',
        eventId: 'game-1:3',
        gameId,
        seq: 3,
        actorId,
        createdAt: started.value.liveActivities[0]?.createdAt,
        type: 'characterCreation',
        characterId,
        transition: 'STARTED',
        details: 'Started character creation',
        status: 'CHARACTERISTICS',
        creationComplete: false
      }
    ])
    assert.equal(
      started.value.state.characters[characterId]?.creation?.state.status,
      'CHARACTERISTICS'
    )

    const advanced = await publishCharacterCreationCharacteristics(
      storage,
      characterId
    )
    assert.equal(advanced?.ok, true)
    if (!advanced?.ok) return
    assert.equal(
      advanced.value.state.characters[characterId]?.creation?.state.status,
      'HOMEWORLD'
    )

    const homeworldSet = await publish(storage, {
      type: 'SetCharacterCreationHomeworld',
      gameId,
      actorId,
      characterId,
      expectedSeq: advanced.value.state.eventSeq,
      homeworld: {
        name: 'Regina',
        lawLevel: 'No Law',
        tradeCodes: ['Asteroid', 'Industrial']
      }
    })

    assert.equal(homeworldSet.ok, true)
    if (!homeworldSet.ok) return
    assert.deepEqual(
      homeworldSet.value.state.characters[characterId]?.creation
        ?.backgroundSkills,
      ['Zero-G-0', 'Broker-0']
    )
    assert.deepEqual(
      homeworldSet.value.state.characters[characterId]?.creation
        ?.pendingCascadeSkills,
      ['Gun Combat-0']
    )

    const resolvedCascade = await publish(storage, {
      type: 'ResolveCharacterCreationCascadeSkill',
      gameId,
      actorId,
      characterId,
      expectedSeq: homeworldSet.value.state.eventSeq,
      cascadeSkill: 'Gun Combat-0',
      selection: 'Slug Rifle'
    })

    assert.equal(resolvedCascade.ok, true)
    if (!resolvedCascade.ok) return
    assert.deepEqual(
      resolvedCascade.value.state.characters[characterId]?.creation
        ?.backgroundSkills,
      ['Zero-G-0', 'Broker-0', 'Slug Rifle-0']
    )

    const selectedBackgroundSkills: string[] = []
    let homeworld = await publish(storage, {
      type: 'CompleteCharacterCreationHomeworld',
      gameId,
      actorId,
      characterId,
      expectedSeq: resolvedCascade.value.state.eventSeq
    })
    for (const skill of [
      'Admin',
      'Electronics',
      'Computer',
      'Advocate',
      'Animals',
      'Carousing'
    ]) {
      if (
        homeworld.ok ||
        homeworld.error.message !==
          'Background choices must be complete before career selection'
      ) {
        break
      }
      const selected = await publish(storage, {
        type: 'SelectCharacterCreationBackgroundSkill',
        gameId,
        actorId,
        characterId,
        skill
      })
      assert.equal(
        selected.ok,
        true,
        selected.ok ? undefined : selected.error.message
      )
      if (!selected.ok) return
      selectedBackgroundSkills.push(`${skill}-0`)
      homeworld = await publish(storage, {
        type: 'CompleteCharacterCreationHomeworld',
        gameId,
        actorId,
        characterId,
        expectedSeq: selected.value.state.eventSeq
      })
    }

    assert.equal(
      homeworld.ok,
      true,
      homeworld.ok ? undefined : homeworld.error.message
    )
    if (!homeworld.ok) return

    const term = await publish(storage, {
      type: 'StartCharacterCareerTerm',
      gameId,
      actorId,
      characterId,
      expectedSeq: homeworld.value.state.eventSeq,
      career: 'Scout'
    })

    assert.equal(term.ok, true)
    if (!term.ok) return
    const creation = term.value.state.characters[characterId]?.creation
    assert.deepEqual(
      creation?.terms.map((entry) => entry.career),
      ['Scout']
    )
    assert.deepEqual(creation?.careers, [{ name: 'Scout', rank: 0 }])
    assert.equal(term.value.state.eventSeq, homeworld.value.state.eventSeq + 1)

    const recovered = await getProjectedGameState(storage, gameId)
    assert.deepEqual(recovered?.characters[characterId]?.creation?.homeworld, {
      name: 'Regina',
      lawLevel: 'No Law',
      tradeCodes: ['Asteroid', 'Industrial']
    })
    assert.deepEqual(
      recovered?.characters[characterId]?.creation?.backgroundSkills,
      ['Zero-G-0', 'Broker-0', 'Slug Rifle-0', ...selectedBackgroundSkills]
    )
  })

  it('publishes and replays semantic basic training completion', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-basic-training')
    await appendEvents(
      storage,
      gameId,
      actorId,
      [
        {
          type: 'GameCreated',
          slug: 'game-1',
          name: 'Spinward Test',
          ownerId: actorId
        },
        {
          type: 'CharacterCreated',
          characterId,
          ownerId: actorId,
          characterType: 'PLAYER',
          name: 'Scout'
        },
        {
          type: 'CharacterCreationStarted',
          characterId,
          creation: {
            state: {
              status: 'BASIC_TRAINING',
              context: {
                canCommission: false,
                canAdvance: false
              }
            },
            terms: [
              {
                career: 'Scout',
                skills: [],
                skillsAndTraining: ['Vacc Suit-0'],
                benefits: [],
                complete: false,
                canReenlist: true,
                completedBasicTraining: false,
                musteringOut: false,
                anagathics: false
              }
            ],
            careers: [{ name: 'Scout', rank: 0 }],
            canEnterDraft: true,
            failedToQualify: false,
            characteristicChanges: [],
            creationComplete: false,
            homeworld: null,
            backgroundSkills: [],
            pendingCascadeSkills: [],
            history: []
          }
        }
      ],
      '2026-05-03T00:00:00.000Z'
    )

    const completed = await publish(storage, {
      type: 'CompleteCharacterCreationBasicTraining',
      gameId,
      actorId,
      characterId,
      expectedSeq: 3
    })

    assert.equal(
      completed.ok,
      true,
      completed.ok ? undefined : completed.error.message
    )
    if (!completed.ok) return
    assert.equal(
      completed.value.state.characters[characterId]?.creation?.state.status,
      'SURVIVAL'
    )

    const events = await readEventStream(storage, gameId)
    assert.deepEqual(events.at(-1)?.event, {
      type: 'CharacterCreationBasicTrainingCompleted',
      characterId,
      trainingSkills: ['Vacc Suit-0'],
      state: {
        status: 'SURVIVAL',
        context: {
          canCommission: false,
          canAdvance: false
        }
      },
      creationComplete: false
    })

    const recovered = await getProjectedGameState(storage, gameId)
    assert.deepEqual(
      recovered?.characters[characterId]?.creation?.history?.at(-1),
      { type: 'COMPLETE_BASIC_TRAINING' }
    )
    assert.equal(
      recovered?.characters[characterId]?.creation?.terms.at(-1)
        ?.completedBasicTraining,
      true
    )
  })

  it('publishes semantic survival resolution through seeded server dice', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-survival')
    await appendEvents(
      storage,
      gameId,
      actorId,
      [
        {
          type: 'GameCreated',
          slug: 'game-1',
          name: 'Spinward Test',
          ownerId: actorId
        },
        {
          type: 'CharacterCreated',
          characterId,
          ownerId: actorId,
          characterType: 'PLAYER',
          name: 'Scout'
        },
        {
          type: 'CharacterCreationStarted',
          characterId,
          creation: {
            state: {
              status: 'SURVIVAL',
              context: {
                canCommission: false,
                canAdvance: false
              }
            },
            terms: [
              {
                career: 'Scout',
                skills: [],
                skillsAndTraining: ['Vacc Suit-0'],
                benefits: [],
                complete: false,
                canReenlist: true,
                completedBasicTraining: true,
                musteringOut: false,
                anagathics: false
              }
            ],
            careers: [{ name: 'Scout', rank: 0 }],
            canEnterDraft: true,
            failedToQualify: false,
            characteristicChanges: [],
            creationComplete: false,
            homeworld: null,
            backgroundSkills: [],
            pendingCascadeSkills: [],
            history: []
          }
        }
      ],
      '2026-05-03T00:00:00.000Z'
    )

    const resolved = await publish(storage, {
      type: 'ResolveCharacterCreationSurvival',
      gameId,
      actorId,
      characterId,
      expectedSeq: 3
    })

    assert.equal(resolved.ok, true)
    if (!resolved.ok) return
    assert.equal(typeof (await storage.get(gameSeedKey(gameId))), 'number')
    const storedEvents = await readEventStream(storage, gameId)
    const diceEnvelope = storedEvents.at(-2)
    const storedEnvelope = storedEvents.at(-1)
    const diceEvent = diceEnvelope?.event
    const storedEvent = storedEnvelope?.event
    assert.equal(diceEvent?.type, 'DiceRolled')
    assert.equal(storedEvent?.type, 'CharacterCreationSurvivalResolved')
    if (
      diceEvent?.type !== 'DiceRolled' ||
      storedEvent?.type !== 'CharacterCreationSurvivalResolved'
    ) {
      return
    }
    assert.equal(diceEvent.expression, '2d6')
    assert.equal(storedEvent.rollEventId, diceEnvelope?.id)
    assert.equal(diceEvent.reason, 'Scout survival')
    assert.deepEqual(diceEvent.rolls, storedEvent.survival.rolls)
    assert.equal(diceEvent.total, storedEvent.survival.total)
    assert.equal(storedEvent.survival.expression, '2d6')
    assert.equal(storedEvent.survival.rolls.length, 2)
    assert.equal(storedEvent.survival.success, storedEvent.passed)

    const diceActivity = resolved.value.liveActivities.find(
      (candidate) => candidate.type === 'diceRoll'
    )
    const activity = resolved.value.liveActivities.find(
      (candidate) => candidate.type === 'characterCreation'
    )
    assert.equal(diceActivity?.type, 'diceRoll')
    assert.equal(activity?.type, 'characterCreation')
    if (
      diceActivity?.type !== 'diceRoll' ||
      activity?.type !== 'characterCreation'
    ) {
      return
    }
    assert.deepEqual(diceActivity.rolls, storedEvent.survival.rolls)
    assert.equal(diceActivity.total, storedEvent.survival.total)
    assert.equal(
      activity.transition,
      storedEvent.passed ? 'SURVIVAL_PASSED' : 'SURVIVAL_FAILED'
    )

    const recovered = await getProjectedGameState(storage, gameId)
    const history = recovered?.characters[characterId]?.creation?.history ?? []
    assert.equal(history.at(-1)?.type, activity.transition)
    assert.equal(
      recovered?.characters[characterId]?.creation?.terms.at(-1)?.survival,
      storedEvent.survival.total
    )
  })

  it('publishes semantic commission resolution through seeded server dice', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-commission')
    await appendEvents(
      storage,
      gameId,
      actorId,
      [
        {
          type: 'GameCreated',
          slug: 'game-1',
          name: 'Spinward Test',
          ownerId: actorId
        },
        {
          type: 'CharacterCreated',
          characterId,
          ownerId: actorId,
          characterType: 'PLAYER',
          name: 'Merchant'
        },
        {
          type: 'CharacterCreationStarted',
          characterId,
          creation: {
            state: {
              status: 'COMMISSION',
              context: {
                canCommission: true,
                canAdvance: false
              }
            },
            terms: [
              {
                career: 'Merchant',
                skills: [],
                skillsAndTraining: ['Broker-0'],
                benefits: [],
                complete: false,
                canReenlist: true,
                completedBasicTraining: true,
                musteringOut: false,
                anagathics: false,
                survival: 7
              }
            ],
            careers: [{ name: 'Merchant', rank: 0 }],
            canEnterDraft: true,
            failedToQualify: false,
            characteristicChanges: [],
            creationComplete: false,
            homeworld: null,
            backgroundSkills: [],
            pendingCascadeSkills: [],
            history: []
          }
        }
      ],
      '2026-05-03T00:00:00.000Z'
    )

    const resolved = await publish(storage, {
      type: 'ResolveCharacterCreationCommission',
      gameId,
      actorId,
      characterId,
      expectedSeq: 3
    })

    assert.equal(resolved.ok, true)
    if (!resolved.ok) return
    assert.equal(typeof (await storage.get(gameSeedKey(gameId))), 'number')
    const storedEvents = await readEventStream(storage, gameId)
    const diceEnvelope = storedEvents.at(-2)
    const storedEnvelope = storedEvents.at(-1)
    const diceEvent = diceEnvelope?.event
    const storedEvent = storedEnvelope?.event
    assert.equal(diceEvent?.type, 'DiceRolled')
    assert.equal(storedEvent?.type, 'CharacterCreationCommissionResolved')
    if (
      diceEvent?.type !== 'DiceRolled' ||
      storedEvent?.type !== 'CharacterCreationCommissionResolved'
    ) {
      return
    }
    assert.equal(diceEvent.expression, '2d6')
    assert.equal(storedEvent.rollEventId, diceEnvelope?.id)
    assert.equal(diceEvent.reason, 'Merchant commission')
    assert.deepEqual(diceEvent.rolls, storedEvent.commission.rolls)
    assert.equal(diceEvent.total, storedEvent.commission.total)
    assert.equal(storedEvent.commission.expression, '2d6')
    assert.equal(storedEvent.commission.target, 5)
    assert.equal(storedEvent.commission.characteristic, 'int')
    assert.equal(storedEvent.commission.rolls.length, 2)
    assert.equal(storedEvent.commission.success, storedEvent.passed)

    const diceActivity = resolved.value.liveActivities.find(
      (candidate) => candidate.type === 'diceRoll'
    )
    const activity = resolved.value.liveActivities.find(
      (candidate) => candidate.type === 'characterCreation'
    )
    assert.equal(diceActivity?.type, 'diceRoll')
    assert.equal(activity?.type, 'characterCreation')
    if (
      diceActivity?.type !== 'diceRoll' ||
      activity?.type !== 'characterCreation'
    ) {
      return
    }
    assert.deepEqual(diceActivity.rolls, storedEvent.commission.rolls)
    assert.equal(diceActivity.total, storedEvent.commission.total)
    assert.equal(
      activity.transition,
      storedEvent.passed ? 'COMMISSION_PASSED' : 'COMMISSION_FAILED'
    )

    const recovered = await getProjectedGameState(storage, gameId)
    const history = recovered?.characters[characterId]?.creation?.history ?? []
    const lastHistoryEvent = history.at(-1)
    assert.equal(lastHistoryEvent?.type, 'COMPLETE_COMMISSION')
    assert.deepEqual(
      lastHistoryEvent?.type === 'COMPLETE_COMMISSION'
        ? lastHistoryEvent.commission
        : null,
      storedEvent.commission
    )
    assert.equal(
      recovered?.characters[characterId]?.creation?.state.status,
      'SKILLS_TRAINING'
    )
  })

  it('publishes semantic advancement resolution through seeded server dice', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-advancement')
    await appendEvents(
      storage,
      gameId,
      actorId,
      [
        {
          type: 'GameCreated',
          slug: 'game-1',
          name: 'Spinward Test',
          ownerId: actorId
        },
        {
          type: 'CharacterCreated',
          characterId,
          ownerId: actorId,
          characterType: 'PLAYER',
          name: 'Merchant'
        },
        {
          type: 'CharacterSheetUpdated',
          characterId,
          characteristics: {
            edu: 15
          }
        },
        {
          type: 'CharacterCreationStarted',
          characterId,
          creation: {
            state: {
              status: 'ADVANCEMENT',
              context: {
                canCommission: false,
                canAdvance: true
              }
            },
            terms: [
              {
                career: 'Merchant',
                skills: [],
                skillsAndTraining: ['Broker-0'],
                benefits: [],
                complete: false,
                canReenlist: true,
                completedBasicTraining: true,
                musteringOut: false,
                anagathics: false,
                survival: 7
              }
            ],
            careers: [{ name: 'Merchant', rank: 1 }],
            canEnterDraft: true,
            failedToQualify: false,
            characteristicChanges: [],
            creationComplete: false,
            homeworld: null,
            backgroundSkills: [],
            pendingCascadeSkills: [],
            history: []
          }
        }
      ],
      '2026-05-03T00:00:00.000Z'
    )

    const resolved = await publish(storage, {
      type: 'ResolveCharacterCreationAdvancement',
      gameId,
      actorId,
      characterId,
      expectedSeq: 4
    })

    assert.equal(resolved.ok, true)
    if (!resolved.ok) return
    const storedEvents = await readEventStream(storage, gameId)
    const diceEnvelope = storedEvents.at(-2)
    const storedEnvelope = storedEvents.at(-1)
    const diceEvent = diceEnvelope?.event
    const storedEvent = storedEnvelope?.event
    assert.equal(diceEvent?.type, 'DiceRolled')
    assert.equal(storedEvent?.type, 'CharacterCreationAdvancementResolved')
    if (
      diceEvent?.type !== 'DiceRolled' ||
      storedEvent?.type !== 'CharacterCreationAdvancementResolved'
    ) {
      return
    }
    assert.equal(diceEvent.expression, '2d6')
    assert.equal(storedEvent.rollEventId, diceEnvelope?.id)
    assert.equal(diceEvent.reason, 'Merchant advancement')
    assert.deepEqual(diceEvent.rolls, storedEvent.advancement.rolls)
    assert.equal(diceEvent.total, storedEvent.advancement.total)
    assert.equal(storedEvent.advancement.expression, '2d6')
    assert.equal(storedEvent.advancement.target, 8)
    assert.equal(storedEvent.advancement.characteristic, 'edu')
    assert.equal(storedEvent.advancement.success, storedEvent.passed)
    assert.deepEqual(
      storedEvent.rank,
      storedEvent.passed
        ? {
            career: 'Merchant',
            previousRank: 1,
            newRank: 2,
            title: 'Fourth Officer',
            bonusSkill: null
          }
        : null
    )

    const diceActivity = resolved.value.liveActivities.find(
      (candidate) => candidate.type === 'diceRoll'
    )
    const activity = resolved.value.liveActivities.find(
      (candidate) => candidate.type === 'characterCreation'
    )
    assert.equal(diceActivity?.type, 'diceRoll')
    assert.equal(activity?.type, 'characterCreation')
    if (
      diceActivity?.type !== 'diceRoll' ||
      activity?.type !== 'characterCreation'
    ) {
      return
    }
    assert.deepEqual(diceActivity.rolls, storedEvent.advancement.rolls)
    assert.equal(diceActivity.total, storedEvent.advancement.total)
    assert.equal(
      activity.transition,
      storedEvent.passed ? 'ADVANCEMENT_PASSED' : 'ADVANCEMENT_FAILED'
    )

    const recovered = await getProjectedGameState(storage, gameId)
    const creation = recovered?.characters[characterId]?.creation
    assert.equal(creation?.history?.at(-1)?.type, 'COMPLETE_ADVANCEMENT')
    assert.equal(
      creation?.terms.at(-1)?.advancement,
      storedEvent.advancement.total
    )
    assert.deepEqual(creation?.careers, [
      { name: 'Merchant', rank: storedEvent.passed ? 2 : 1 }
    ])
  })

  it('persists and replays server-backed homeworld/background decisions', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-background')
    await publish(storage, createGameCommand())
    await publish(storage, {
      type: 'CreateCharacter',
      gameId,
      actorId,
      characterId,
      characterType: 'PLAYER',
      name: 'Free Trader'
    })
    await publish(storage, {
      type: 'StartCharacterCreation',
      gameId,
      actorId,
      characterId
    })
    await publishCharacterCreationCharacteristics(storage, characterId)
    await publishEducationCorrection(storage, characterId)

    const homeworldSet = await publish(storage, {
      type: 'SetCharacterCreationHomeworld',
      gameId,
      actorId,
      characterId,
      homeworld: {
        name: ' Regina ',
        lawLevel: ' No Law ',
        tradeCodes: [' Asteroid ']
      }
    })
    assert.equal(homeworldSet.ok, true)

    const skillSelected = await publish(storage, {
      type: 'SelectCharacterCreationBackgroundSkill',
      gameId,
      actorId,
      characterId,
      skill: ' Admin '
    })
    assert.equal(skillSelected.ok, true)

    const cascadeResolved = await publish(storage, {
      type: 'ResolveCharacterCreationCascadeSkill',
      gameId,
      actorId,
      characterId,
      cascadeSkill: 'Gun Combat-0',
      selection: 'Slug Rifle'
    })
    assert.equal(cascadeResolved.ok, true)

    const events = await readEventStream(storage, gameId)
    assert.deepEqual(
      events.slice(-3).map((envelope) => envelope.event),
      [
        {
          type: 'CharacterCreationHomeworldSet',
          characterId,
          homeworld: {
            name: 'Regina',
            lawLevel: 'No Law',
            tradeCodes: ['Asteroid']
          },
          backgroundSkills: ['Zero-G-0'],
          pendingCascadeSkills: ['Gun Combat-0']
        },
        {
          type: 'CharacterCreationBackgroundSkillSelected',
          characterId,
          skill: 'Admin-0',
          backgroundSkills: ['Zero-G-0', 'Admin-0'],
          pendingCascadeSkills: ['Gun Combat-0']
        },
        {
          type: 'CharacterCreationCascadeSkillResolved',
          characterId,
          cascadeSkill: 'Gun Combat-0',
          selection: 'Slug Rifle',
          backgroundSkills: ['Zero-G-0', 'Admin-0', 'Slug Rifle-0'],
          pendingCascadeSkills: []
        }
      ]
    )

    const recovered = await getProjectedGameState(storage, gameId)
    const creation = recovered?.characters[characterId]?.creation
    assert.deepEqual(creation?.homeworld, {
      name: 'Regina',
      lawLevel: 'No Law',
      tradeCodes: ['Asteroid']
    })
    assert.deepEqual(creation?.backgroundSkills, [
      'Zero-G-0',
      'Admin-0',
      'Slug Rifle-0'
    ])
    assert.deepEqual(creation?.pendingCascadeSkills, [])
    assert.equal(recovered?.eventSeq, events.length)
  })

  it('publishes semantic character creation activity into player projections', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-activity')
    await publish(storage, createGameCommand())
    await publish(storage, {
      type: 'CreateCharacter',
      gameId,
      actorId,
      characterId,
      characterType: 'PLAYER',
      name: 'Free Trader'
    })
    await publish(storage, {
      type: 'StartCharacterCreation',
      gameId,
      actorId,
      characterId
    })
    await publishCharacterCreationCharacteristics(storage, characterId)
    await publishEducationCorrection(storage, characterId)

    const homeworldSet = await publish(storage, {
      type: 'SetCharacterCreationHomeworld',
      gameId,
      actorId,
      characterId,
      homeworld: {
        name: 'Regina',
        lawLevel: 'No Law',
        tradeCodes: ['Asteroid', 'Industrial']
      }
    })

    assert.equal(homeworldSet.ok, true)
    if (!homeworldSet.ok) return
    assert.deepEqual(homeworldSet.value.liveActivities, [
      {
        id: `game-1:${homeworldSet.value.state.eventSeq}`,
        eventId: `game-1:${homeworldSet.value.state.eventSeq}`,
        gameId,
        seq: homeworldSet.value.state.eventSeq,
        actorId,
        createdAt: homeworldSet.value.liveActivities[0]?.createdAt,
        type: 'characterCreation',
        characterId,
        transition: 'HOMEWORLD_SET',
        details:
          'Homeworld: Regina; trade codes Asteroid, Industrial; 2 background skills; 1 pending cascade',
        status: 'HOMEWORLD',
        creationComplete: false
      }
    ])

    const playerProjection = filterGameStateForViewer(
      homeworldSet.value.state,
      {
        userId: asUserId('player-2'),
        role: 'PLAYER'
      }
    )
    assert.equal(playerProjection.eventSeq, homeworldSet.value.state.eventSeq)
    assert.deepEqual(
      playerProjection.characters[characterId]?.creation?.backgroundSkills,
      ['Zero-G-0', 'Broker-0']
    )
    assert.deepEqual(
      playerProjection.characters[characterId]?.creation?.pendingCascadeSkills,
      ['Gun Combat-0']
    )

    const storedEvent = (await readEventStream(storage, gameId)).at(-1)?.event
    assert.equal(storedEvent?.type, 'CharacterCreationHomeworldSet')
  })

  it('publishes semantic homeworld completion into projection history', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-homeworld-complete')
    await publish(storage, createGameCommand())
    await publish(storage, {
      type: 'CreateCharacter',
      gameId,
      actorId,
      characterId,
      characterType: 'PLAYER',
      name: 'Homeworld Scout'
    })
    await publish(storage, {
      type: 'StartCharacterCreation',
      gameId,
      actorId,
      characterId
    })
    await publishCharacterCreationCharacteristics(storage, characterId)
    await publishEducationCorrection(storage, characterId)
    const homeworldSet = await publish(storage, {
      type: 'SetCharacterCreationHomeworld',
      gameId,
      actorId,
      characterId,
      homeworld: {
        name: 'Regina',
        lawLevel: 'No Law',
        tradeCodes: ['Asteroid', 'Industrial']
      }
    })
    assert.equal(
      homeworldSet.ok,
      true,
      homeworldSet.ok ? undefined : homeworldSet.error.message
    )
    const cascadeResolved = await publish(storage, {
      type: 'ResolveCharacterCreationCascadeSkill',
      gameId,
      actorId,
      characterId,
      cascadeSkill: 'Gun Combat-0',
      selection: 'Slug Rifle'
    })
    assert.equal(
      cascadeResolved.ok,
      true,
      cascadeResolved.ok ? undefined : cascadeResolved.error.message
    )

    let completed = await publish(storage, {
      type: 'CompleteCharacterCreationHomeworld',
      gameId,
      actorId,
      characterId
    })
    for (const skill of ['Admin', 'Electronics', 'Computer']) {
      if (
        completed.ok ||
        completed.error.message !==
          'Background choices must be complete before career selection'
      ) {
        break
      }
      const selected = await publish(storage, {
        type: 'SelectCharacterCreationBackgroundSkill',
        gameId,
        actorId,
        characterId,
        skill
      })
      assert.equal(
        selected.ok,
        true,
        selected.ok ? undefined : selected.error.message
      )
      completed = await publish(storage, {
        type: 'CompleteCharacterCreationHomeworld',
        gameId,
        actorId,
        characterId
      })
    }

    assert.equal(
      completed.ok,
      true,
      completed.ok ? undefined : completed.error.message
    )
    if (!completed.ok) return
    const storedEvent = (await readEventStream(storage, gameId)).at(-1)?.event
    assert.deepEqual(storedEvent, {
      type: 'CharacterCreationHomeworldCompleted',
      characterId,
      state: {
        status: 'CAREER_SELECTION',
        context: {
          canCommission: false,
          canAdvance: false
        }
      },
      creationComplete: false
    })
    assert.deepEqual(completed.value.liveActivities, [
      {
        id: `game-1:${completed.value.state.eventSeq}`,
        eventId: `game-1:${completed.value.state.eventSeq}`,
        gameId,
        seq: completed.value.state.eventSeq,
        actorId,
        createdAt: completed.value.liveActivities[0]?.createdAt,
        type: 'characterCreation',
        characterId,
        transition: 'COMPLETE_HOMEWORLD',
        details: 'Homeworld complete',
        status: 'CAREER_SELECTION',
        creationComplete: false
      }
    ])

    const creation = completed.value.state.characters[characterId]?.creation
    assert.equal(creation?.state.status, 'CAREER_SELECTION')
    assert.deepEqual(creation?.history, [
      { type: 'SET_CHARACTERISTICS' },
      { type: 'COMPLETE_HOMEWORLD' }
    ])
    assert.equal(
      (await readEventStream(storage, gameId)).length,
      completed.value.state.eventSeq
    )
  })

  it('records semantic SRD roll facts in character creation transition history', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-1')
    await publish(storage, createGameCommand())
    await storage.put(gameSeedKey(gameId), 5)
    await publish(storage, {
      type: 'CreateCharacter',
      gameId,
      actorId,
      characterId,
      characterType: 'PLAYER',
      name: 'Scout'
    })
    await publish(storage, {
      type: 'StartCharacterCreation',
      gameId,
      actorId,
      characterId
    })

    await publishCharacterCreationCharacteristics(storage, characterId)
    await publish(storage, {
      type: 'SetCharacterCreationHomeworld',
      gameId,
      actorId,
      characterId,
      homeworld: {
        name: 'Regina',
        lawLevel: 'No Law',
        tradeCodes: ['Asteroid', 'Industrial']
      }
    })
    await publish(storage, {
      type: 'ResolveCharacterCreationCascadeSkill',
      gameId,
      actorId,
      characterId,
      cascadeSkill: 'Gun Combat-0',
      selection: 'Slug Rifle'
    })
    const homeworldCompleted = await publish(storage, {
      type: 'CompleteCharacterCreationHomeworld',
      gameId,
      actorId,
      characterId
    })
    assert.equal(homeworldCompleted.ok, true)
    await publishCareerQualification(storage, characterId)
    const basicTrainingCompleted = await publishBasicTrainingCompletion(
      storage,
      characterId
    )
    assert.equal(basicTrainingCompleted.ok, true)
    assert.equal(
      (await publishSurvivalResolution(storage, characterId)).ok,
      true
    )
    assert.equal(
      (await publishRequiredTermSkillCompletion(storage, characterId)).ok,
      true
    )
    assert.equal(
      (await publishAnagathicsDecline(storage, characterId)).ok,
      true
    )
    assert.equal((await publishAgingResolution(storage, characterId)).ok, true)
    assert.equal(
      (await publishReenlistmentResolution(storage, characterId)).ok,
      true
    )
    assert.equal(
      (await publishCareerReenlistment(storage, characterId)).ok,
      true
    )

    assert.equal(
      (await publishSurvivalResolution(storage, characterId)).ok,
      true
    )
    assert.equal(
      (await publishRequiredTermSkillCompletion(storage, characterId)).ok,
      true
    )
    assert.equal(
      (await publishAnagathicsDecline(storage, characterId)).ok,
      true
    )
    assert.equal((await publishAgingResolution(storage, characterId)).ok, true)
    assert.equal(
      (await publishReenlistmentResolution(storage, characterId)).ok,
      true
    )
    assert.equal((await publishCareerLeave(storage, characterId)).ok, true)
    await appendEvents(
      storage,
      gameId,
      actorId,
      [
        {
          type: 'CharacterCreationTransitioned',
          characterId,
          creationEvent: {
            type: 'FINISH_MUSTERING',
            musteringBenefit: {
              career: 'Scout',
              kind: 'cash',
              roll: {
                expression: '2d6',
                rolls: [3, 4],
                total: 7
              },
              modifier: 1,
              tableRoll: 8,
              value: '20000',
              credits: 20000
            }
          },
          state: {
            status: 'MUSTERING_OUT',
            context: {
              canCommission: false,
              canAdvance: false
            }
          },
          creationComplete: false
        }
      ],
      new Date().toISOString()
    )

    const persistedEvents = (await readEventStream(storage, gameId)).map(
      (envelope) => envelope.event
    )
    const persistedCreationEvents = persistedEvents
      .filter((event) => event.type === 'CharacterCreationTransitioned')
      .map((event) => event.creationEvent)
    const persistedQualificationEvents = persistedEvents.filter(
      (event) => event.type === 'CharacterCreationQualificationResolved'
    )
    const persistedAgingEvents = persistedEvents.filter(
      (event) => event.type === 'CharacterCreationAgingResolved'
    )

    assert.deepEqual(
      persistedCreationEvents
        .filter((event) =>
          ['SELECT_CAREER', 'FINISH_MUSTERING'].includes(event.type)
        )
        .map((event) => event.type),
      ['FINISH_MUSTERING']
    )
    assert.equal(persistedQualificationEvents.length, 1)
    assert.equal(
      persistedEvents.some(
        (event) => event.type === 'CharacterCreationCareerReenlisted'
      ),
      true
    )
    assert.equal(persistedAgingEvents.length, 2)

    const recovered = await getProjectedGameState(storage, gameId)
    const history = recovered?.characters[characterId]?.creation?.history ?? []

    assert.deepEqual(
      history.find((event) => event.type === 'SELECT_CAREER')?.qualification,
      persistedQualificationEvents[0]?.type ===
        'CharacterCreationQualificationResolved'
        ? persistedQualificationEvents[0].qualification
        : undefined
    )
    assert.equal(
      history.find((event) => event.type === 'SURVIVAL_PASSED')?.survival
        ?.success,
      true
    )
    assert.equal(
      history.filter((event) => event.type === 'COMPLETE_AGING').length,
      2
    )
    const reenlistmentEvents = history.filter(
      (event) => event.type === 'RESOLVE_REENLISTMENT'
    )
    assert.equal(reenlistmentEvents.length, 2)
    assert.equal(reenlistmentEvents[0]?.reenlistment.success, true)
    assert.equal(
      history.some((event) => event.type === 'REENLIST'),
      true
    )
    assert.deepEqual(
      history.find((event) => event.type === 'FINISH_MUSTERING')
        ?.musteringBenefit,
      {
        career: 'Scout',
        kind: 'cash',
        roll: {
          expression: '2d6',
          rolls: [3, 4],
          total: 7
        },
        modifier: 1,
        tableRoll: 8,
        value: '20000',
        credits: 20000
      }
    )
  })

  it('checkpoints when character creation becomes playable', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-1')
    await publish(storage, createGameCommand())
    await storage.put(gameSeedKey(gameId), 5)
    await publish(storage, {
      type: 'CreateCharacter',
      gameId,
      actorId,
      characterId,
      characterType: 'PLAYER',
      name: 'Scout'
    })
    await publish(storage, {
      type: 'StartCharacterCreation',
      gameId,
      actorId,
      characterId
    })

    await publishCharacterCreationCharacteristics(storage, characterId)
    await publish(storage, {
      type: 'SetCharacterCreationHomeworld',
      gameId,
      actorId,
      characterId,
      homeworld: {
        name: 'Regina',
        lawLevel: 'No Law',
        tradeCodes: ['Asteroid', 'Industrial']
      }
    })
    await publish(storage, {
      type: 'ResolveCharacterCreationCascadeSkill',
      gameId,
      actorId,
      characterId,
      cascadeSkill: 'Gun Combat-0',
      selection: 'Slug Rifle'
    })
    const homeworldCompleted = await publish(storage, {
      type: 'CompleteCharacterCreationHomeworld',
      gameId,
      actorId,
      characterId
    })
    assert.equal(homeworldCompleted.ok, true)
    await publishCareerQualification(storage, characterId)
    const basicTrainingCompleted = await publishBasicTrainingCompletion(
      storage,
      characterId
    )
    assert.equal(basicTrainingCompleted.ok, true)
    assert.equal(
      (await publishSurvivalResolution(storage, characterId)).ok,
      true
    )
    assert.equal(
      (await publishRequiredTermSkillCompletion(storage, characterId)).ok,
      true
    )
    assert.equal(
      (await publishAnagathicsDecline(storage, characterId)).ok,
      true
    )
    assert.equal((await publishAgingResolution(storage, characterId)).ok, true)
    assert.equal(
      (await publishReenlistmentResolution(storage, characterId)).ok,
      true
    )
    assert.equal((await publishCareerLeave(storage, characterId)).ok, true)
    const earlyMusteringCompletion = await publish(storage, {
      type: 'CompleteCharacterCreationMustering',
      gameId,
      actorId,
      characterId
    })
    assert.equal(earlyMusteringCompletion.ok, false)
    if (earlyMusteringCompletion.ok) return
    assert.equal(earlyMusteringCompletion.error.code, 'invalid_command')
    assert.equal(
      (
        await publish(storage, {
          type: 'RollCharacterCreationMusteringBenefit',
          gameId,
          actorId,
          characterId,
          career: 'Scout',
          kind: 'material'
        })
      ).ok,
      true
    )
    assert.equal(
      (
        await publish(storage, {
          type: 'CompleteCharacterCreationMustering',
          gameId,
          actorId,
          characterId
        })
      ).ok,
      true
    )
    const completed = await publishCreationCompletion(storage, characterId)

    assert.equal(completed.ok, true)
    if (!completed.ok) return
    assert.equal(
      completed.value.state.characters[characterId]?.creation?.state.status,
      'PLAYABLE'
    )
    assert.equal(
      (await readCheckpoint(storage, gameId))?.seq,
      completed.value.state.eventSeq
    )
  })

  it('publishes final character creation sheets only after playable', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-1')
    await publish(storage, createGameCommand())
    await storage.put(gameSeedKey(gameId), 5)
    await publish(storage, {
      type: 'CreateCharacter',
      gameId,
      actorId,
      characterId,
      characterType: 'PLAYER',
      name: 'Scout'
    })
    await publish(storage, {
      type: 'StartCharacterCreation',
      gameId,
      actorId,
      characterId
    })

    const early = await publish(storage, {
      type: 'FinalizeCharacterCreation',
      gameId,
      actorId,
      characterId,
      age: 34,
      characteristics: {
        str: 7,
        dex: 8,
        end: 7,
        int: 9,
        edu: 8,
        soc: 6
      },
      skills: ['Pilot-1'],
      equipment: [],
      credits: 1200,
      notes: 'Too early.'
    })

    assert.equal(early.ok, false)
    if (early.ok) return
    assert.equal(early.error.code, 'invalid_command')

    await publishCharacterCreationCharacteristics(storage, characterId)
    await publish(storage, {
      type: 'SetCharacterCreationHomeworld',
      gameId,
      actorId,
      characterId,
      homeworld: {
        name: 'Regina',
        lawLevel: 'No Law',
        tradeCodes: ['Asteroid', 'Industrial']
      }
    })
    await publish(storage, {
      type: 'ResolveCharacterCreationCascadeSkill',
      gameId,
      actorId,
      characterId,
      cascadeSkill: 'Gun Combat-0',
      selection: 'Slug Rifle'
    })
    const homeworldCompleted = await publish(storage, {
      type: 'CompleteCharacterCreationHomeworld',
      gameId,
      actorId,
      characterId
    })
    assert.equal(homeworldCompleted.ok, true)
    await publishCareerQualification(storage, characterId)
    const basicTrainingCompleted = await publishBasicTrainingCompletion(
      storage,
      characterId
    )
    assert.equal(basicTrainingCompleted.ok, true)
    assert.equal(
      (await publishSurvivalResolution(storage, characterId)).ok,
      true
    )
    assert.equal(
      (await publishRequiredTermSkillCompletion(storage, characterId)).ok,
      true
    )
    assert.equal(
      (await publishAnagathicsDecline(storage, characterId)).ok,
      true
    )
    assert.equal((await publishAgingResolution(storage, characterId)).ok, true)
    assert.equal(
      (await publishReenlistmentResolution(storage, characterId)).ok,
      true
    )
    assert.equal((await publishCareerLeave(storage, characterId)).ok, true)
    assert.equal(
      (
        await publish(storage, {
          type: 'RollCharacterCreationMusteringBenefit',
          gameId,
          actorId,
          characterId,
          career: 'Scout',
          kind: 'material'
        })
      ).ok,
      true
    )
    assert.equal(
      (
        await publish(storage, {
          type: 'CompleteCharacterCreationMustering',
          gameId,
          actorId,
          characterId
        })
      ).ok,
      true
    )
    assert.equal(
      (await publishCreationCompletion(storage, characterId)).ok,
      true
    )

    const finalized = await publish(storage, {
      type: 'FinalizeCharacterCreation',
      gameId,
      actorId,
      characterId,
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
      equipment: [{ name: 'Vacc suit', quantity: 1, notes: 'Carried' }],
      credits: 1200,
      notes: 'Final scout.'
    })

    assert.equal(finalized.ok, true)
    if (!finalized.ok) return
    const character = finalized.value.state.characters[characterId]
    assert.equal(character?.age, 22)
    assert.equal(
      JSON.stringify(character?.skills) !==
        JSON.stringify(['Pilot-1', 'Vacc Suit-0']),
      true
    )
    assert.equal(character?.notes.includes('Final scout.'), false)
    assert.equal(
      (await readEventStream(storage, gameId)).length,
      finalized.value.state.eventSeq
    )
  })

  it('recovers finalized character creation from interval checkpoint plus tail', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-1')
    const hiddenPieceId = asPieceId('hidden-finalized-sheet-piece')
    await publishPlayableCharacterCreation(storage, characterId)

    const playableCheckpoint = await readCheckpoint(storage, gameId)
    assert.equal(playableCheckpoint?.seq, 38)

    const board = await publish(
      storage,
      createBoardCommand(asBoardId('finalization-checkpoint-board-39'))
    )
    assert.equal(board.ok, true)
    const piece = await publish(storage, {
      type: 'CreatePiece',
      gameId,
      actorId,
      pieceId: hiddenPieceId,
      boardId: asBoardId('finalization-checkpoint-board-39'),
      characterId,
      name: 'Hidden Scout',
      x: 10,
      y: 10
    })
    assert.equal(piece.ok, true)
    const hidden = await publish(storage, {
      type: 'SetPieceVisibility',
      gameId,
      actorId,
      pieceId: hiddenPieceId,
      visibility: 'HIDDEN'
    })
    assert.equal(hidden.ok, true)

    const intervalCheckpointSeq = 64
    for (
      let index = (hidden.ok ? hidden.value.eventSeq : 41) + 1;
      index <= intervalCheckpointSeq;
      index += 1
    ) {
      const created = await publish(
        storage,
        createBoardCommand(asBoardId(`finalization-checkpoint-board-${index}`))
      )
      assert.equal(created.ok, true)
    }

    const intervalCheckpoint = await readCheckpoint(storage, gameId)
    assert.equal(intervalCheckpoint?.seq, intervalCheckpointSeq)

    const finalized = await publish(storage, {
      type: 'FinalizeCharacterCreation',
      gameId,
      actorId,
      characterId,
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
      equipment: [{ name: 'Vacc suit', quantity: 1, notes: 'Carried' }],
      credits: 1200,
      notes: 'Final scout.'
    })

    assert.equal(finalized.ok, true)
    if (!finalized.ok) return
    assert.equal(
      (await readCheckpoint(storage, gameId))?.seq,
      intervalCheckpoint?.seq
    )
    const recoveredTail = await readEventStreamTail(
      storage,
      gameId,
      intervalCheckpoint?.seq ?? 0
    )
    assert.deepEqual(
      recoveredTail.map((envelope) => envelope.event.type),
      ['CharacterCreationFinalized']
    )

    const recovered = await getProjectedGameState(storage, gameId)
    const finalizedEvent = recoveredTail.at(-1)?.event
    assert.equal(finalizedEvent?.type, 'CharacterCreationFinalized')
    if (finalizedEvent?.type !== 'CharacterCreationFinalized') return
    const recoveredCharacter = recovered?.characters[characterId]
    assert.deepEqual(recovered, finalized.value.state)
    assert.equal(recoveredCharacter?.age, 22)
    assert.deepEqual(
      recoveredCharacter?.characteristics,
      finalizedEvent.characteristics
    )
    assert.deepEqual(recoveredCharacter?.skills, finalizedEvent.skills)
    assert.deepEqual(recoveredCharacter?.equipment, finalizedEvent.equipment)
    assert.equal(recoveredCharacter?.credits, finalizedEvent.credits)
    assert.equal(recoveredCharacter?.notes, finalizedEvent.notes)
    assert.equal(
      JSON.stringify(finalizedEvent.characteristics) !==
        JSON.stringify({
          str: 7,
          dex: 8,
          end: 7,
          int: 9,
          edu: 8,
          soc: 6
        }),
      true,
      'finalized characteristics should come from the server projection, not the command'
    )
    assert.equal(
      JSON.stringify(finalizedEvent.skills) !==
        JSON.stringify(['Pilot-1', 'Vacc Suit-0']),
      true,
      'finalized skills should come from the server projection, not the command'
    )
    assert.equal(
      finalizedEvent.equipment[0]?.name !== 'Vacc suit',
      true,
      'finalized equipment should come from the server projection, not the command'
    )
    assert.equal(finalizedEvent.credits !== 1200, true)
    assert.equal(finalizedEvent.notes.includes('Final scout.'), false)

    const refreshMessage = await buildRoomStateMessage(storage, gameId, {
      userId: asUserId('player-2'),
      role: 'PLAYER'
    })
    assert.equal(refreshMessage.type, 'roomState')
    if (refreshMessage.type !== 'roomState') return
    assert.equal(refreshMessage.eventSeq, finalized.value.state.eventSeq)
    assert.equal(refreshMessage.state?.eventSeq, finalized.value.state.eventSeq)
    assert.equal(refreshMessage.state?.pieces[hiddenPieceId], undefined)
    const refreshedCharacter = refreshMessage.state?.characters[characterId]
    assert.equal(refreshedCharacter?.name, 'Scout')
    assert.equal(refreshedCharacter?.type, 'PLAYER')
    assert.equal(refreshedCharacter?.active, true)
    assert.equal(refreshedCharacter?.age, finalizedEvent.age)
    assert.deepEqual(
      refreshedCharacter?.characteristics,
      finalizedEvent.characteristics
    )
    assert.deepEqual(refreshedCharacter?.skills, finalizedEvent.skills)
    assert.deepEqual(refreshedCharacter?.equipment, finalizedEvent.equipment)
    assert.equal(refreshedCharacter?.credits, finalizedEvent.credits)
    assert.equal(refreshedCharacter?.notes, finalizedEvent.notes)
  })

  it('recovers semantic commission, advancement, and term skills from checkpoint plus tail', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-recovery-tail')
    await publish(storage, createGameCommand())
    await storage.put(gameSeedKey(gameId), 5)

    for (let index = 1; index <= 63; index += 1) {
      const created = await publish(
        storage,
        createBoardCommand(asBoardId(`checkpoint-board-${index}`))
      )
      assert.equal(created.ok, true)
    }

    const intervalCheckpoint = await readCheckpoint(storage, gameId)
    assert.equal(intervalCheckpoint?.seq, 64)

    await appendEvents(
      storage,
      gameId,
      actorId,
      [
        {
          type: 'CharacterCreated',
          characterId,
          ownerId: actorId,
          characterType: 'PLAYER',
          name: 'Merchant'
        },
        {
          type: 'CharacterSheetUpdated',
          characterId,
          characteristics: {
            str: 9,
            dex: 9,
            end: 9,
            int: 15,
            edu: 15,
            soc: 9
          }
        },
        {
          type: 'CharacterCreationStarted',
          characterId,
          creation: {
            state: {
              status: 'COMMISSION',
              context: {
                canCommission: true,
                canAdvance: true
              }
            },
            terms: [
              {
                career: 'Merchant',
                skills: [],
                skillsAndTraining: ['Broker-0'],
                benefits: [],
                complete: false,
                canReenlist: true,
                completedBasicTraining: true,
                musteringOut: false,
                anagathics: false,
                survival: 8
              }
            ],
            careers: [{ name: 'Merchant', rank: 0 }],
            canEnterDraft: true,
            failedToQualify: false,
            characteristicChanges: [],
            creationComplete: false,
            homeworld: null,
            backgroundSkills: [],
            pendingCascadeSkills: [],
            history: [
              {
                type: 'SURVIVAL_PASSED',
                canCommission: true,
                canAdvance: true,
                survival: {
                  expression: '2d6',
                  rolls: [4, 4],
                  total: 8,
                  characteristic: 'int',
                  modifier: 0,
                  target: 5,
                  success: true
                }
              }
            ]
          }
        }
      ],
      '2026-05-03T00:00:00.000Z'
    )

    const commissioned = await publish(storage, {
      type: 'ResolveCharacterCreationCommission',
      gameId,
      actorId,
      characterId,
      expectedSeq: 67
    })
    assert.equal(
      commissioned.ok,
      true,
      commissioned.ok ? undefined : commissioned.error.message
    )
    if (!commissioned.ok) return

    const advanced = await publish(storage, {
      type: 'ResolveCharacterCreationAdvancement',
      gameId,
      actorId,
      characterId,
      expectedSeq: commissioned.value.eventSeq
    })
    assert.equal(
      advanced.ok,
      true,
      advanced.ok ? undefined : advanced.error.message
    )
    if (!advanced.ok) return

    const skilled = await publish(storage, {
      type: 'RollCharacterCreationTermSkill',
      gameId,
      actorId,
      characterId,
      expectedSeq: advanced.value.eventSeq,
      table: 'serviceSkills'
    })

    assert.equal(
      skilled.ok,
      true,
      skilled.ok ? undefined : skilled.error.message
    )
    if (!skilled.ok) return
    assert.equal((await readCheckpoint(storage, gameId))?.seq, 64)
    const recoveredTail = await readEventStreamTail(
      storage,
      gameId,
      intervalCheckpoint?.seq ?? 0
    )
    assert.deepEqual(
      recoveredTail.map((envelope) => envelope.event.type).slice(-9),
      [
        'CharacterCreated',
        'CharacterSheetUpdated',
        'CharacterCreationStarted',
        'DiceRolled',
        'CharacterCreationCommissionResolved',
        'DiceRolled',
        'CharacterCreationAdvancementResolved',
        'DiceRolled',
        'CharacterCreationTermSkillRolled'
      ]
    )

    const recovered = await getProjectedGameState(storage, gameId)
    const creation = recovered?.characters[characterId]?.creation
    const advancementEvent = recoveredTail
      .map((envelope) => envelope.event)
      .find((event) => event.type === 'CharacterCreationAdvancementResolved')
    assert.deepEqual(recovered, skilled.value.state)
    assert.equal(creation?.history?.at(-3)?.type, 'COMPLETE_COMMISSION')
    assert.equal(creation?.history?.at(-2)?.type, 'COMPLETE_ADVANCEMENT')
    assert.equal(creation?.history?.at(-1)?.type, 'ROLL_TERM_SKILL')
    assert.equal(
      creation?.terms.at(-1)?.advancement,
      advancementEvent?.type === 'CharacterCreationAdvancementResolved'
        ? advancementEvent.advancement.total
        : null
    )
    assert.equal(creation?.terms.at(-1)?.skills.length, 1)
    assert.equal(
      creation?.careers[0]?.rank,
      advancementEvent?.type === 'CharacterCreationAdvancementResolved' &&
        advancementEvent.rank
        ? advancementEvent.rank.newRank
        : 0
    )
  })

  it('rejects stale expected sequence numbers on character creation commands', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-1')
    await publish(storage, createGameCommand())
    await publish(storage, {
      type: 'CreateCharacter',
      gameId,
      actorId,
      characterId,
      characterType: 'PLAYER',
      name: 'Scout'
    })

    const stale = await publish(storage, {
      type: 'StartCharacterCreation',
      gameId,
      actorId,
      characterId,
      expectedSeq: 1
    })

    assert.equal(stale.ok, false)
    if (stale.ok) return
    assert.equal(stale.error.code, 'stale_command')
    assert.equal((await readEventStream(storage, gameId)).length, 2)
  })

  it('rejects player-forged character creation roll outcomes', async () => {
    const storage = createMemoryStorage()
    const playerId = asUserId('player-1')
    const characterId = asCharacterId('player-scout')
    await publish(storage, createGameCommand())
    await publish(storage, {
      type: 'CreateCharacter',
      gameId,
      actorId: playerId,
      characterId,
      characterType: 'PLAYER',
      name: 'Player Scout'
    })
    await publish(storage, {
      type: 'StartCharacterCreation',
      gameId,
      actorId: playerId,
      characterId
    })

    const forged = await publish(storage, {
      type: 'AdvanceCharacterCreation',
      gameId,
      actorId: playerId,
      characterId,
      creationEvent: { type: 'SET_CHARACTERISTICS' }
    })

    assert.equal(forged.ok, false)
    if (forged.ok) return
    assert.equal(forged.error.code, 'not_allowed')
    assert.equal(
      forged.error.message,
      'Only the referee can use generic character creation advance'
    )
    assert.equal((await readEventStream(storage, gameId)).length, 3)
  })

  it('rejects stale expected sequence numbers on homeworld/background commands', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-1')
    await publish(storage, createGameCommand())
    await publish(storage, {
      type: 'CreateCharacter',
      gameId,
      actorId,
      characterId,
      characterType: 'PLAYER',
      name: 'Scout'
    })
    await publish(storage, {
      type: 'StartCharacterCreation',
      gameId,
      actorId,
      characterId
    })
    await publishCharacterCreationCharacteristics(storage, characterId)

    const stale = await publish(storage, {
      type: 'SetCharacterCreationHomeworld',
      gameId,
      actorId,
      characterId,
      expectedSeq: 3,
      homeworld: {
        name: 'Regina',
        lawLevel: 'No Law',
        tradeCodes: ['Asteroid']
      }
    })

    assert.equal(stale.ok, false)
    if (stale.ok) return
    assert.equal(stale.error.code, 'stale_command')
    assert.equal((await readEventStream(storage, gameId)).length, 16)
  })

  it('rejects stale expected sequence numbers on semantic character creation commands before append', async () => {
    const assertStale = async (command: Command) => {
      const storage = createMemoryStorage()
      const characterId = asCharacterId('char-stale')
      await publish(storage, createGameCommand())
      await publish(storage, {
        type: 'CreateCharacter',
        gameId,
        actorId,
        characterId,
        characterType: 'PLAYER',
        name: 'Scout'
      })
      await publish(storage, {
        type: 'StartCharacterCreation',
        gameId,
        actorId,
        characterId
      })
      await publishCharacterCreationCharacteristics(storage, characterId)
      await publishEducationCorrection(storage, characterId)
      await publish(storage, {
        type: 'SetCharacterCreationHomeworld',
        gameId,
        actorId,
        characterId,
        homeworld: {
          name: 'Regina',
          lawLevel: 'No Law',
          tradeCodes: ['Asteroid', 'Industrial']
        }
      })

      if (
        command.type === 'ResolveCharacterCreationCascadeSkill' ||
        command.type === 'StartCharacterCareerTerm'
      ) {
        await publish(storage, {
          type: 'ResolveCharacterCreationCascadeSkill',
          gameId,
          actorId,
          characterId,
          cascadeSkill: 'Gun Combat-0',
          selection: 'Slug Rifle'
        })
      }

      if (command.type === 'StartCharacterCareerTerm') {
        await publish(storage, {
          type: 'CompleteCharacterCreationHomeworld',
          gameId,
          actorId,
          characterId
        })
      }

      const eventCountBefore = (await readEventStream(storage, gameId)).length
      const stale = await publish(storage, command)

      assert.equal(stale.ok, false)
      if (stale.ok) return
      assert.equal(stale.error.code, 'stale_command')
      assert.equal(
        (await readEventStream(storage, gameId)).length,
        eventCountBefore
      )
    }

    await assertStale({
      type: 'SelectCharacterCreationBackgroundSkill',
      gameId,
      actorId,
      characterId: asCharacterId('char-stale'),
      expectedSeq: 4,
      skill: 'Admin'
    })
    await assertStale({
      type: 'ResolveCharacterCreationCascadeSkill',
      gameId,
      actorId,
      characterId: asCharacterId('char-stale'),
      expectedSeq: 5,
      cascadeSkill: 'Gun Combat-0',
      selection: 'Slug Rifle'
    })
    await assertStale({
      type: 'StartCharacterCareerTerm',
      gameId,
      actorId,
      characterId: asCharacterId('char-stale'),
      expectedSeq: 6,
      career: 'Scout'
    })
  })

  it('rejects character creation commands for missing characters', async () => {
    const storage = createMemoryStorage()
    await publish(storage, createGameCommand())

    const rejected = await publish(storage, {
      type: 'StartCharacterCreation',
      gameId,
      actorId,
      characterId: asCharacterId('missing-character')
    })

    assert.equal(rejected.ok, false)
    if (rejected.ok) return
    assert.equal(rejected.error.code, 'missing_entity')
    assert.equal((await readEventStream(storage, gameId)).length, 1)
  })

  it('rejects generic homeworld completion without mutating storage', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-1')
    await publish(storage, createGameCommand())
    await publish(storage, {
      type: 'CreateCharacter',
      gameId,
      actorId,
      characterId,
      characterType: 'PLAYER',
      name: 'Scout'
    })
    await publish(storage, {
      type: 'StartCharacterCreation',
      gameId,
      actorId,
      characterId
    })

    const rejected = await publish(storage, {
      type: 'AdvanceCharacterCreation',
      gameId,
      actorId,
      characterId,
      creationEvent: { type: 'COMPLETE_HOMEWORLD' }
    })

    assert.equal(rejected.ok, false)
    if (rejected.ok) return
    assert.equal(rejected.error.code, 'invalid_command')
    assert.equal(
      rejected.error.message,
      'AdvanceCharacterCreation is deprecated; use semantic character creation commands'
    )
    assert.equal((await readEventStream(storage, gameId)).length, 3)
  })

  it('rejects state-machine illegal character creation transitions without appending events', async () => {
    const assertRejectedTransition = async (
      storage: ReturnType<typeof createMemoryStorage>,
      command: Extract<Command, { type: 'AdvanceCharacterCreation' }>,
      expectedCode: 'invalid_command' | 'not_allowed',
      expectedMessage: string
    ) => {
      const eventCountBefore = (await readEventStream(storage, gameId)).length
      const rejected = await publish(storage, command)

      assert.equal(rejected.ok, false)
      if (rejected.ok) return
      assert.equal(rejected.error.code, expectedCode)
      assert.equal(rejected.error.message, expectedMessage)
      assert.equal(
        (await readEventStream(storage, gameId)).length,
        eventCountBefore
      )
    }

    {
      const storage = createMemoryStorage()
      const characterId = asCharacterId('char-homeworld')
      await publish(storage, createGameCommand())
      await publish(storage, {
        type: 'CreateCharacter',
        gameId,
        actorId,
        characterId,
        characterType: 'PLAYER',
        name: 'Homeworld Scout'
      })
      await publish(storage, {
        type: 'StartCharacterCreation',
        gameId,
        actorId,
        characterId
      })
      await publishCharacterCreationCharacteristics(storage, characterId)

      await assertRejectedTransition(
        storage,
        {
          type: 'AdvanceCharacterCreation',
          gameId,
          actorId,
          characterId,
          creationEvent: { type: 'SELECT_CAREER', isNewCareer: true }
        },
        'invalid_command',
        'AdvanceCharacterCreation is deprecated; use semantic character creation commands'
      )
    }

    {
      const storage = createMemoryStorage()
      const characterId = asCharacterId('char-career-selection')
      await publish(storage, createGameCommand())
      await publish(storage, {
        type: 'CreateCharacter',
        gameId,
        actorId,
        characterId,
        characterType: 'PLAYER',
        name: 'Career Scout'
      })
      await publish(storage, {
        type: 'StartCharacterCreation',
        gameId,
        actorId,
        characterId
      })
      await publishCharacterCreationCharacteristics(storage, characterId)
      await publishEducationCorrection(storage, characterId)
      await publish(storage, {
        type: 'SetCharacterCreationHomeworld',
        gameId,
        actorId,
        characterId,
        homeworld: {
          name: 'Regina',
          lawLevel: 'No Law',
          tradeCodes: ['Asteroid', 'Industrial']
        }
      })
      await publish(storage, {
        type: 'ResolveCharacterCreationCascadeSkill',
        gameId,
        actorId,
        characterId,
        cascadeSkill: 'Gun Combat-0',
        selection: 'Slug Rifle'
      })
      let careerSelection = await publish(storage, {
        type: 'CompleteCharacterCreationHomeworld',
        gameId,
        actorId,
        characterId
      })
      for (const skill of ['Admin', 'Electronics', 'Computer']) {
        if (
          careerSelection.ok ||
          careerSelection.error.message !==
            'Background choices must be complete before career selection'
        ) {
          break
        }
        const selected = await publish(storage, {
          type: 'SelectCharacterCreationBackgroundSkill',
          gameId,
          actorId,
          characterId,
          skill
        })
        assert.equal(
          selected.ok,
          true,
          selected.ok ? undefined : selected.error.message
        )
        if (!selected.ok) return
        careerSelection = await publish(storage, {
          type: 'CompleteCharacterCreationHomeworld',
          gameId,
          actorId,
          characterId
        })
      }
      assert.equal(
        careerSelection.ok,
        true,
        careerSelection.ok ? undefined : careerSelection.error.message
      )
      if (!careerSelection.ok) return
      assert.equal(
        careerSelection.value.state.characters[characterId]?.creation?.state
          .status,
        'CAREER_SELECTION'
      )

      await assertRejectedTransition(
        storage,
        {
          type: 'AdvanceCharacterCreation',
          gameId,
          actorId,
          characterId,
          creationEvent: { type: 'COMPLETE_BASIC_TRAINING' }
        },
        'invalid_command',
        'AdvanceCharacterCreation is deprecated; use semantic character creation commands'
      )
    }

    {
      const storage = createMemoryStorage()
      const characterId = asCharacterId('char-playable')
      await publishPlayableCharacterCreation(storage, characterId)

      await assertRejectedTransition(
        storage,
        {
          type: 'AdvanceCharacterCreation',
          gameId,
          actorId,
          characterId,
          creationEvent: { type: 'SET_CHARACTERISTICS' }
        },
        'invalid_command',
        'AdvanceCharacterCreation is deprecated; use semantic character creation commands'
      )
    }
  })

  it('rejects career selection before background choices are complete', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-1')
    await publish(storage, createGameCommand())
    await publish(storage, {
      type: 'CreateCharacter',
      gameId,
      actorId,
      characterId,
      characterType: 'PLAYER',
      name: 'Scout'
    })
    await publish(storage, {
      type: 'StartCharacterCreation',
      gameId,
      actorId,
      characterId
    })
    await publishCharacterCreationCharacteristics(storage, characterId)
    await publishEducationCorrection(storage, characterId)
    const homeworldSet = await publish(storage, {
      type: 'SetCharacterCreationHomeworld',
      gameId,
      actorId,
      characterId,
      homeworld: {
        name: 'Regina',
        lawLevel: 'No Law',
        tradeCodes: ['Asteroid']
      }
    })
    assert.equal(
      homeworldSet.ok,
      true,
      homeworldSet.ok ? undefined : homeworldSet.error.message
    )
    const eventCountBeforeRejected = (await readEventStream(storage, gameId))
      .length

    const rejected = await publish(storage, {
      type: 'CompleteCharacterCreationHomeworld',
      gameId,
      actorId,
      characterId
    })

    assert.equal(rejected.ok, false)
    if (rejected.ok) return
    assert.equal(rejected.error.code, 'invalid_command')
    assert.equal(
      rejected.error.message,
      'Background choices must be complete before career selection'
    )
    assert.equal(
      (await readEventStream(storage, gameId)).length,
      eventCountBeforeRejected
    )
  })

  it('rejects career term starts outside career selection', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-1')
    await publish(storage, createGameCommand())
    await publish(storage, {
      type: 'CreateCharacter',
      gameId,
      actorId,
      characterId,
      characterType: 'PLAYER',
      name: 'Scout'
    })
    await publish(storage, {
      type: 'StartCharacterCreation',
      gameId,
      actorId,
      characterId
    })

    const rejected = await publish(storage, {
      type: 'StartCharacterCareerTerm',
      gameId,
      actorId,
      characterId,
      career: 'Scout'
    })

    assert.equal(rejected.ok, false)
    if (rejected.ok) return
    assert.equal(rejected.error.code, 'invalid_command')
    assert.equal(
      rejected.error.message,
      'Career terms cannot start from CHARACTERISTICS'
    )
    assert.equal((await readEventStream(storage, gameId)).length, 3)
  })

  it('publishes and projects custom piece dimensions', async () => {
    const storage = createMemoryStorage()
    const pieceId = asPieceId('door-1')
    await publish(storage, createGameCommand())
    await publish(storage, createBoardCommand())

    const created = await publish(storage, {
      type: 'CreatePiece',
      gameId,
      actorId,
      pieceId,
      boardId: asBoardId('board-1'),
      name: 'Airlock',
      x: 10,
      y: 10,
      width: 50,
      height: 100,
      scale: 1.5
    })

    assert.equal(created.ok, true)
    if (!created.ok) return
    assert.equal(created.value.state.pieces[pieceId]?.width, 50)
    assert.equal(created.value.state.pieces[pieceId]?.height, 100)
    assert.equal(created.value.state.pieces[pieceId]?.scale, 1.5)
    const storedEvent = (await readEventStream(storage, gameId))[2]?.event
    assert.equal(storedEvent?.type, 'PieceCreated')
    if (storedEvent?.type !== 'PieceCreated') return
    assert.equal(storedEvent.width, 50)
    assert.equal(storedEvent.height, 100)
    assert.equal(storedEvent.scale, 1.5)
  })

  it('rejects invalid custom piece dimensions without mutating storage', async () => {
    const storage = createMemoryStorage()
    await publish(storage, createGameCommand())
    await publish(storage, createBoardCommand())

    const rejected = await publish(storage, {
      type: 'CreatePiece',
      gameId,
      actorId,
      pieceId: asPieceId('door-1'),
      boardId: asBoardId('board-1'),
      name: 'Airlock',
      x: 10,
      y: 10,
      width: 50,
      height: 0,
      scale: 1
    })

    assert.equal(rejected.ok, false)
    if (rejected.ok) return
    assert.equal(rejected.error.code, 'invalid_command')
    assert.equal(rejected.error.message, 'height must be positive')
    assert.equal((await readEventStream(storage, gameId)).length, 2)
  })

  it('updates manual character sheet fields and preserves omitted fields', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-1')
    await publish(storage, createGameCommand())
    await publish(storage, {
      type: 'CreateCharacter',
      gameId,
      actorId,
      characterId,
      characterType: 'PLAYER',
      name: 'Scout'
    })

    const firstUpdate = await publish(storage, {
      type: 'UpdateCharacterSheet',
      gameId,
      actorId,
      characterId,
      notes: 'Scout service term notes',
      age: 34,
      characteristics: {
        str: 7,
        dex: 9
      },
      skills: ['Pilot 1'],
      equipment: [{ name: 'Vacc suit', quantity: 1, notes: '' }],
      credits: 1200
    })

    assert.equal(firstUpdate.ok, true)
    const secondUpdate = await publish(storage, {
      type: 'UpdateCharacterSheet',
      gameId,
      actorId,
      characterId,
      characteristics: {
        dex: null
      },
      credits: 900
    })

    assert.equal(secondUpdate.ok, true)
    if (!secondUpdate.ok) return
    const character = secondUpdate.value.state.characters[characterId]
    assert.equal(character?.notes, 'Scout service term notes')
    assert.equal(character?.age, 34)
    assert.equal(character?.characteristics.str, 7)
    assert.equal(character?.characteristics.dex, null)
    assert.deepEqual(character?.skills, ['Pilot 1'])
    assert.deepEqual(character?.equipment, [
      { name: 'Vacc suit', quantity: 1, notes: '' }
    ])
    assert.equal(character?.credits, 900)
  })

  it('blocks player edits to server-authored creation sheet fields', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-1')
    const refereeId = asUserId('referee-1')
    await publish(storage, {
      type: 'CreateGame',
      gameId,
      actorId: refereeId,
      slug: 'game-1',
      name: 'Spinward Test'
    })
    await publish(storage, {
      type: 'CreateCharacter',
      gameId,
      actorId,
      characterId,
      characterType: 'PLAYER',
      name: 'Scout'
    })
    await publish(storage, {
      type: 'StartCharacterCreation',
      gameId,
      actorId,
      characterId
    })

    const rejected = await publish(storage, {
      type: 'UpdateCharacterSheet',
      gameId,
      actorId,
      characterId,
      characteristics: { str: 15 }
    })

    assert.equal(rejected.ok, false)
    if (rejected.ok) return
    assert.equal(rejected.error.code, 'not_allowed')
    assert.equal(
      rejected.error.message,
      'Server-authored character creation fields can only be corrected by a referee'
    )
    assert.equal((await readEventStream(storage, gameId)).length, 3)
  })

  it('keeps player notes editable during canonical creation', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-1')
    const refereeId = asUserId('referee-1')
    await publish(storage, {
      type: 'CreateGame',
      gameId,
      actorId: refereeId,
      slug: 'game-1',
      name: 'Spinward Test'
    })
    await publish(storage, {
      type: 'CreateCharacter',
      gameId,
      actorId,
      characterId,
      characterType: 'PLAYER',
      name: 'Scout'
    })
    await publish(storage, {
      type: 'StartCharacterCreation',
      gameId,
      actorId,
      characterId
    })

    const updated = await publish(storage, {
      type: 'UpdateCharacterSheet',
      gameId,
      actorId,
      characterId,
      notes: 'Keeps an in-character journal.'
    })

    assert.equal(
      updated.ok,
      true,
      updated.ok ? undefined : updated.error.message
    )
    if (!updated.ok) return
    assert.equal(
      updated.value.state.characters[characterId]?.notes,
      'Keeps an in-character journal.'
    )
  })

  it('allows referee corrections to canonical creation sheet fields', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-1')
    const refereeId = asUserId('referee-1')
    await publish(storage, {
      type: 'CreateGame',
      gameId,
      actorId: refereeId,
      slug: 'game-1',
      name: 'Spinward Test'
    })
    await publish(storage, {
      type: 'CreateCharacter',
      gameId,
      actorId,
      characterId,
      characterType: 'PLAYER',
      name: 'Scout'
    })
    await publish(storage, {
      type: 'StartCharacterCreation',
      gameId,
      actorId,
      characterId
    })

    const updated = await publish(storage, {
      type: 'UpdateCharacterSheet',
      gameId,
      actorId: refereeId,
      characterId,
      credits: 100
    })

    assert.equal(
      updated.ok,
      true,
      updated.ok ? undefined : updated.error.message
    )
    if (!updated.ok) return
    assert.equal(updated.value.state.characters[characterId]?.credits, 100)
  })

  it('rejects non-string character sheet notes during publication', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-1')
    await publish(storage, createGameCommand())
    await publish(storage, {
      type: 'CreateCharacter',
      gameId,
      actorId,
      characterId,
      characterType: 'PLAYER',
      name: 'Scout'
    })

    const rejected = await publish(storage, {
      type: 'UpdateCharacterSheet',
      gameId,
      actorId,
      characterId,
      notes: 123
    } as unknown as Command)

    assert.equal(rejected.ok, false)
    if (rejected.ok) return
    assert.equal(rejected.error.code, 'invalid_command')
    assert.equal(rejected.error.message, 'notes must be a string')
  })

  it('rejects empty character sheet skills during publication', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-1')
    await publish(storage, createGameCommand())
    await publish(storage, {
      type: 'CreateCharacter',
      gameId,
      actorId,
      characterId,
      characterType: 'PLAYER',
      name: 'Scout'
    })

    const rejected = await publish(storage, {
      type: 'UpdateCharacterSheet',
      gameId,
      actorId,
      characterId,
      skills: ['Pilot 1', '  ']
    })

    assert.equal(rejected.ok, false)
    if (rejected.ok) return
    assert.equal(rejected.error.code, 'invalid_command')
    assert.equal(rejected.error.message, 'skills[1] cannot be empty')
    assert.equal((await readEventStream(storage, gameId)).length, 2)
  })

  it('rejects empty character sheet equipment names during publication', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-1')
    await publish(storage, createGameCommand())
    await publish(storage, {
      type: 'CreateCharacter',
      gameId,
      actorId,
      characterId,
      characterType: 'PLAYER',
      name: 'Scout'
    })

    const rejected = await publish(storage, {
      type: 'UpdateCharacterSheet',
      gameId,
      actorId,
      characterId,
      equipment: [{ name: '  ', quantity: 1, notes: '' }]
    })

    assert.equal(rejected.ok, false)
    if (rejected.ok) return
    assert.equal(rejected.error.code, 'invalid_command')
    assert.equal(rejected.error.message, 'equipment[0].name cannot be empty')
    assert.equal((await readEventStream(storage, gameId)).length, 2)
  })

  it('validates piece character links during publication', async () => {
    const storage = createMemoryStorage()
    const characterId = asCharacterId('char-1')
    await publish(storage, createGameCommand())
    await publish(storage, createBoardCommand())

    const missingCharacter = await publish(storage, {
      type: 'CreatePiece',
      gameId,
      actorId,
      pieceId: asPieceId('piece-1'),
      boardId: asBoardId('board-1'),
      characterId,
      name: 'Scout',
      x: 10,
      y: 10
    })

    assert.equal(missingCharacter.ok, false)
    if (missingCharacter.ok) return
    assert.equal(missingCharacter.error.code, 'missing_entity')
    assert.equal((await readEventStream(storage, gameId)).length, 2)

    await publish(storage, {
      type: 'CreateCharacter',
      gameId,
      actorId,
      characterId,
      characterType: 'PLAYER',
      name: 'Scout'
    })

    const linkedPiece = await publish(storage, {
      type: 'CreatePiece',
      gameId,
      actorId,
      pieceId: asPieceId('piece-1'),
      boardId: asBoardId('board-1'),
      characterId,
      name: 'Scout',
      x: 10,
      y: 10
    })

    assert.equal(linkedPiece.ok, true)
    if (!linkedPiece.ok) return
    assert.equal(
      linkedPiece.value.state.pieces[asPieceId('piece-1')]?.characterId,
      characterId
    )
  })

  it('selects an existing board and publishes the projected board selection', async () => {
    const storage = createMemoryStorage()
    await publish(storage, createGameCommand())
    await publish(storage, createBoardCommand(asBoardId('board-1')))
    await publish(storage, createBoardCommand(asBoardId('board-2')))

    const selected = await publish(storage, {
      type: 'SelectBoard',
      gameId,
      actorId,
      boardId: asBoardId('board-2')
    })

    assert.equal(selected.ok, true)
    if (!selected.ok) return
    assert.equal(selected.value.state.selectedBoardId, asBoardId('board-2'))
    assert.equal(selected.value.state.eventSeq, 4)

    const storedEvent = (await readEventStream(storage, gameId))[3]?.event
    assert.deepEqual(storedEvent, {
      type: 'BoardSelected',
      boardId: asBoardId('board-2')
    })
  })

  it('rejects board selection when the board does not exist', async () => {
    const storage = createMemoryStorage()
    await publish(storage, createGameCommand())

    const selected = await publish(storage, {
      type: 'SelectBoard',
      gameId,
      actorId,
      boardId: asBoardId('missing-board')
    })

    assert.equal(selected.ok, false)
    if (selected.ok) return
    assert.equal(selected.error.code, 'missing_entity')
    assert.equal((await readEventStream(storage, gameId)).length, 1)
  })

  it('publishes door state changes against existing boards', async () => {
    const storage = createMemoryStorage()
    await publish(storage, createGameCommand())
    await publish(storage, createBoardCommand(asBoardId('board-1')))

    const changed = await publish(storage, {
      type: 'SetDoorOpen',
      gameId,
      actorId,
      boardId: asBoardId('board-1'),
      doorId: 'iris-1',
      open: true
    })

    assert.equal(changed.ok, true)
    if (!changed.ok) return
    assert.deepEqual(changed.value.state.boards[asBoardId('board-1')]?.doors, {
      'iris-1': {
        id: 'iris-1',
        open: true
      }
    })

    const storedEvent = (await readEventStream(storage, gameId))[2]?.event
    assert.deepEqual(storedEvent, {
      type: 'DoorStateChanged',
      boardId: asBoardId('board-1'),
      doorId: 'iris-1',
      open: true
    })
  })

  it('recovers board selection and door updates from game checkpoint plus tail', async () => {
    const storage = createMemoryStorage()
    const boardOneId = asBoardId('board-1')
    const boardTwoId = asBoardId('board-2')
    await publish(storage, createGameCommand())

    const gameCheckpoint = await readCheckpoint(storage, gameId)
    assert.equal(gameCheckpoint?.seq, 1)

    await publish(storage, createBoardCommand(boardOneId))
    await publish(storage, createBoardCommand(boardTwoId))
    const selected = await publish(storage, {
      type: 'SelectBoard',
      gameId,
      actorId,
      boardId: boardTwoId
    })
    assert.equal(selected.ok, true)

    const firstDoor = await publish(storage, {
      type: 'SetDoorOpen',
      gameId,
      actorId,
      boardId: boardTwoId,
      doorId: 'iris-1',
      open: true
    })
    assert.equal(firstDoor.ok, true)
    const secondDoor = await publish(storage, {
      type: 'SetDoorOpen',
      gameId,
      actorId,
      boardId: boardTwoId,
      doorId: 'iris-2',
      open: false
    })

    assert.equal(secondDoor.ok, true)
    if (!secondDoor.ok) return
    assert.deepEqual(
      (
        await readEventStreamTail(storage, gameId, gameCheckpoint?.seq ?? 0)
      ).map((envelope) => envelope.event.type),
      [
        'BoardCreated',
        'BoardCreated',
        'BoardSelected',
        'DoorStateChanged',
        'DoorStateChanged'
      ]
    )

    const recovered = await getProjectedGameState(storage, gameId)
    assert.deepEqual(recovered, secondDoor.value.state)
    assert.equal(recovered?.selectedBoardId, boardTwoId)
    assert.deepEqual(recovered?.boards[boardTwoId]?.doors, {
      'iris-1': {
        id: 'iris-1',
        open: true
      },
      'iris-2': {
        id: 'iris-2',
        open: false
      }
    })
  })

  it('rejects door state changes when the board does not exist', async () => {
    const storage = createMemoryStorage()
    await publish(storage, createGameCommand())

    const changed = await publish(storage, {
      type: 'SetDoorOpen',
      gameId,
      actorId,
      boardId: asBoardId('missing-board'),
      doorId: 'iris-1',
      open: true
    })

    assert.equal(changed.ok, false)
    if (changed.ok) return
    assert.equal(changed.error.code, 'missing_entity')
    assert.equal((await readEventStream(storage, gameId)).length, 1)
  })

  it('rejects board selection when the game has not been created', async () => {
    const storage = createMemoryStorage()

    const selected = await publish(storage, {
      type: 'SelectBoard',
      gameId,
      actorId,
      boardId: asBoardId('board-1')
    })

    assert.equal(selected.ok, false)
    if (selected.ok) return
    assert.equal(selected.error.code, 'game_not_found')
    assert.equal(storage.records.size, 0)
  })

  it('uses the stored room seed and event sequence for deterministic dice events', async () => {
    const first = createMemoryStorage()
    const second = createMemoryStorage()
    await first.put(gameSeedKey(gameId), 12345)
    await second.put(gameSeedKey(gameId), 12345)

    for (const storage of [first, second]) {
      await publish(storage, createGameCommand())
      await publish(storage, {
        type: 'RollDice',
        gameId,
        actorId,
        expression: '2d6+1',
        reason: 'skill check'
      })
    }

    const firstDice = (await readEventStream(first, gameId))[1]?.event
    const secondDice = (await readEventStream(second, gameId))[1]?.event

    assert.equal(firstDice?.type, 'DiceRolled')
    assert.deepEqual(firstDice, secondDice)
  })
})
