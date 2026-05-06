import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type {
  CareerCreationEvent,
  CareerCreationStatus
} from './characterCreation'
import type { EventEnvelope } from './events'
import {
  asBoardId,
  asCharacterId,
  asEventId,
  asGameId,
  asPieceId,
  asUserId
} from './ids'
import { projectGameState } from './projector'

const gameId = asGameId('game-1')
const actorId = asUserId('user-1')

const envelope = (
  seq: number,
  event: EventEnvelope['event']
): EventEnvelope => ({
  version: 1,
  id: asEventId(`${gameId}:${seq}`),
  gameId,
  seq,
  actorId,
  createdAt: `2026-05-03T00:00:0${seq}.000Z`,
  event
})

describe('game state projection', () => {
  it('rejects unknown event types instead of ignoring them', () => {
    let thrown: unknown

    try {
      projectGameState([
        envelope(1, {
          type: 'UnknownEvent'
        } as unknown as EventEnvelope['event'])
      ])
    } catch (error) {
      thrown = error
    }

    if (!(thrown instanceof Error)) {
      throw new Error('Expected unknown event projection to throw')
    }
    assert.equal(/Unhandled event UnknownEvent/.test(thrown.message), true)
  })

  it('projects explicit board selection over the first created board', () => {
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'BoardCreated',
        boardId: asBoardId('board-1'),
        name: 'Downport',
        imageAssetId: null,
        url: null,
        width: 1000,
        height: 800,
        scale: 50
      }),
      envelope(3, {
        type: 'BoardCreated',
        boardId: asBoardId('board-2'),
        name: 'Starport',
        imageAssetId: null,
        url: null,
        width: 1200,
        height: 900,
        scale: 50
      }),
      envelope(4, {
        type: 'BoardSelected',
        boardId: asBoardId('board-2')
      })
    ])

    assert.equal(state?.selectedBoardId, asBoardId('board-2'))
    assert.deepEqual(state?.boards[asBoardId('board-1')]?.doors, {})
    assert.equal(state?.eventSeq, 4)
  })

  it('projects board door state changes by board and door id', () => {
    const boardId = asBoardId('board-1')
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'BoardCreated',
        boardId,
        name: 'Downport',
        imageAssetId: null,
        url: null,
        width: 1000,
        height: 800,
        scale: 50
      }),
      envelope(3, {
        type: 'DoorStateChanged',
        boardId,
        doorId: 'iris-1',
        open: true
      }),
      envelope(4, {
        type: 'DoorStateChanged',
        boardId,
        doorId: 'iris-1',
        open: false
      })
    ])

    assert.deepEqual(state?.boards[boardId]?.doors, {
      'iris-1': {
        id: 'iris-1',
        open: false
      }
    })
    assert.equal(state?.eventSeq, 4)
  })

  it('projects default and partial manual character sheet fields', () => {
    const characterId = asCharacterId('char-1')
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'CharacterCreated',
        characterId,
        ownerId: actorId,
        characterType: 'PLAYER',
        name: 'Scout'
      }),
      envelope(3, {
        type: 'CharacterSheetUpdated',
        characterId,
        notes: 'Scout service term notes',
        age: 34,
        characteristics: {
          str: 7,
          dex: 9
        },
        skills: ['Pilot 1'],
        equipment: [
          {
            name: 'Vacc suit',
            quantity: 1,
            notes: ''
          }
        ],
        credits: 1200
      }),
      envelope(4, {
        type: 'CharacterSheetUpdated',
        characterId,
        characteristics: {
          dex: null,
          edu: 8
        },
        credits: 900
      })
    ])

    const character = state?.characters[characterId]
    assert.equal(character?.creation, null)
    assert.equal(character?.notes, 'Scout service term notes')
    assert.equal(character?.age, 34)
    assert.deepEqual(character?.characteristics, {
      str: 7,
      dex: null,
      end: null,
      int: null,
      edu: 8,
      soc: null
    })
    assert.deepEqual(character?.skills, ['Pilot 1'])
    assert.deepEqual(character?.equipment, [
      { name: 'Vacc suit', quantity: 1, notes: '' }
    ])
    assert.equal(character?.credits, 900)
  })

  it('projects character creation lifecycle events into character creation state', () => {
    const characterId = asCharacterId('char-1')
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'CharacterCreated',
        characterId,
        ownerId: actorId,
        characterType: 'PLAYER',
        name: 'Scout'
      }),
      envelope(3, {
        type: 'CharacterCreationStarted',
        characterId,
        creation: {
          state: {
            status: 'CHARACTERISTICS',
            context: {
              canCommission: false,
              canAdvance: false
            }
          },
          terms: [],
          careers: [],
          canEnterDraft: true,
          failedToQualify: false,
          characteristicChanges: [],
          creationComplete: false,
          history: []
        }
      }),
      envelope(4, {
        type: 'CharacterCreationTransitioned',
        characterId,
        creationEvent: { type: 'SET_CHARACTERISTICS' },
        state: {
          status: 'HOMEWORLD',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: false
      }),
      envelope(5, {
        type: 'CharacterCareerTermStarted',
        characterId,
        career: 'Scout',
        drafted: false
      }),
      envelope(6, {
        type: 'CharacterCreationTransitioned',
        characterId,
        creationEvent: { type: 'CREATION_COMPLETE' },
        state: {
          status: 'PLAYABLE',
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete: true
      }),
      envelope(7, {
        type: 'CharacterCreationFinalized',
        characterId,
        notes: 'Final scout.',
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
        credits: 1200
      })
    ])

    const character = state?.characters[characterId]
    const creation = state?.characters[characterId]?.creation
    assert.equal(creation?.state.status, 'PLAYABLE')
    assert.equal(creation?.creationComplete, true)
    assert.deepEqual(
      creation?.terms.map((term) => term.career),
      ['Scout']
    )
    assert.deepEqual(creation?.careers, [{ name: 'Scout', rank: 0 }])
    assert.deepEqual(creation?.history, [
      { type: 'SET_CHARACTERISTICS' },
      { type: 'CREATION_COMPLETE' }
    ])
    assert.equal(character?.age, 34)
    assert.deepEqual(character?.characteristics, {
      str: 7,
      dex: 8,
      end: 7,
      int: 9,
      edu: 8,
      soc: 6
    })
    assert.deepEqual(character?.skills, ['Pilot-1', 'Vacc Suit-0'])
    assert.equal(character?.credits, 1200)
    assert.equal(state?.eventSeq, 7)
  })

  it('projects semantic basic training completion like the legacy transition', () => {
    const characterId = asCharacterId('char-1')
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'CharacterCreated',
        characterId,
        ownerId: actorId,
        characterType: 'PLAYER',
        name: 'Scout'
      }),
      envelope(3, {
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
          history: []
        }
      }),
      envelope(4, {
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
    ])

    const creation = state?.characters[characterId]?.creation
    assert.equal(creation?.state.status, 'SURVIVAL')
    assert.equal(creation?.creationComplete, false)
    assert.deepEqual(creation?.history, [{ type: 'COMPLETE_BASIC_TRAINING' }])
    assert.deepEqual(creation?.terms[0]?.skillsAndTraining, ['Vacc Suit-0'])
    assert.equal(creation?.terms[0]?.completedBasicTraining, true)
    assert.equal(state?.eventSeq, 4)
  })

  it('replays character creation homeworld and background decisions', () => {
    const characterId = asCharacterId('char-1')
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'CharacterCreated',
        characterId,
        ownerId: actorId,
        characterType: 'PLAYER',
        name: 'Scout'
      }),
      envelope(3, {
        type: 'CharacterCreationStarted',
        characterId,
        creation: {
          state: {
            status: 'HOMEWORLD',
            context: {
              canCommission: false,
              canAdvance: false
            }
          },
          terms: [],
          careers: [],
          canEnterDraft: true,
          failedToQualify: false,
          characteristicChanges: [],
          creationComplete: false,
          homeworld: null,
          backgroundSkills: [],
          pendingCascadeSkills: [],
          history: []
        }
      }),
      envelope(4, {
        type: 'CharacterCreationHomeworldSet',
        characterId,
        homeworld: {
          name: 'Regina',
          lawLevel: 'No Law',
          tradeCodes: ['Asteroid']
        },
        backgroundSkills: ['Zero-G-0'],
        pendingCascadeSkills: ['Gun Combat-0']
      }),
      envelope(5, {
        type: 'CharacterCreationBackgroundSkillSelected',
        characterId,
        skill: 'Admin-0',
        backgroundSkills: ['Zero-G-0', 'Admin-0'],
        pendingCascadeSkills: ['Gun Combat-0']
      }),
      envelope(6, {
        type: 'CharacterCreationCascadeSkillResolved',
        characterId,
        cascadeSkill: 'Gun Combat-0',
        selection: 'Slug Rifle',
        backgroundSkills: ['Zero-G-0', 'Admin-0', 'Slug Rifle-0'],
        pendingCascadeSkills: []
      })
    ])

    const creation = state?.characters[characterId]?.creation
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
    assert.equal(creation?.state.status, 'HOMEWORLD')
    assert.equal(state?.eventSeq, 6)
  })

  it('projects reenlistment as a second career term', () => {
    const characterId = asCharacterId('char-1')
    const transition = (
      seq: number,
      creationEvent: CareerCreationEvent,
      status: CareerCreationStatus,
      creationComplete = false
    ) =>
      envelope(seq, {
        type: 'CharacterCreationTransitioned',
        characterId,
        creationEvent,
        state: {
          status,
          context: {
            canCommission: false,
            canAdvance: false
          }
        },
        creationComplete
      })

    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'CharacterCreated',
        characterId,
        ownerId: actorId,
        characterType: 'PLAYER',
        name: 'Scout'
      }),
      envelope(3, {
        type: 'CharacterCreationStarted',
        characterId,
        creation: {
          state: {
            status: 'CHARACTERISTICS',
            context: {
              canCommission: false,
              canAdvance: false
            }
          },
          terms: [],
          careers: [],
          canEnterDraft: true,
          failedToQualify: false,
          characteristicChanges: [],
          creationComplete: false,
          history: []
        }
      }),
      envelope(4, {
        type: 'CharacterCareerTermStarted',
        characterId,
        career: 'Scout',
        drafted: false
      }),
      transition(
        5,
        { type: 'SURVIVAL_PASSED', canCommission: false, canAdvance: false },
        'SURVIVAL'
      ),
      transition(6, { type: 'COMPLETE_SKILLS' }, 'SURVIVAL'),
      transition(7, { type: 'COMPLETE_AGING' }, 'REENLISTMENT'),
      transition(8, { type: 'REENLIST' }, 'SURVIVAL'),
      transition(
        9,
        { type: 'SURVIVAL_PASSED', canCommission: false, canAdvance: false },
        'SURVIVAL'
      ),
      transition(10, { type: 'COMPLETE_SKILLS' }, 'SURVIVAL'),
      transition(11, { type: 'COMPLETE_AGING' }, 'REENLISTMENT'),
      transition(12, { type: 'LEAVE_CAREER' }, 'MUSTERING_OUT'),
      transition(13, { type: 'FINISH_MUSTERING' }, 'ACTIVE'),
      transition(14, { type: 'CREATION_COMPLETE' }, 'PLAYABLE', true)
    ])

    const terms = state?.characters[characterId]?.creation?.terms
    assert.deepEqual(
      terms?.map((term) => term.career),
      ['Scout', 'Scout']
    )
    assert.equal(terms?.[0]?.complete, true)
    assert.equal(terms?.[1]?.complete, true)
    assert.equal(terms?.[1]?.musteringOut, true)
    assert.equal(
      state?.characters[characterId]?.creation?.state.status,
      'PLAYABLE'
    )
  })

  it('ignores character creation events for missing characters', () => {
    const missingCharacterId = asCharacterId('missing-character')
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'CharacterCreationStarted',
        characterId: missingCharacterId,
        creation: {
          state: {
            status: 'CHARACTERISTICS',
            context: {
              canCommission: false,
              canAdvance: false
            }
          },
          terms: [],
          careers: [],
          canEnterDraft: true,
          failedToQualify: false,
          characteristicChanges: [],
          creationComplete: false
        }
      })
    ])

    assert.deepEqual(state?.characters, {})
    assert.equal(state?.eventSeq, 1)
  })

  it('replaces manual character sheet skills without changing other fields', () => {
    const characterId = asCharacterId('char-1')
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'CharacterCreated',
        characterId,
        ownerId: actorId,
        characterType: 'PLAYER',
        name: 'Scout'
      }),
      envelope(3, {
        type: 'CharacterSheetUpdated',
        characterId,
        notes: 'Scout service term notes',
        age: 34,
        characteristics: {
          dex: 9,
          edu: 8
        },
        skills: ['Pilot 1', 'Vacc Suit 0'],
        equipment: [
          {
            name: 'Vacc suit',
            quantity: 1,
            notes: 'Tailored'
          }
        ],
        credits: 1200
      }),
      envelope(4, {
        type: 'CharacterSheetUpdated',
        characterId,
        skills: ['Engineer 1']
      })
    ])

    const character = state?.characters[characterId]
    assert.equal(character?.notes, 'Scout service term notes')
    assert.equal(character?.age, 34)
    assert.deepEqual(character?.characteristics, {
      str: null,
      dex: 9,
      end: null,
      int: null,
      edu: 8,
      soc: null
    })
    assert.deepEqual(character?.skills, ['Engineer 1'])
    assert.deepEqual(character?.equipment, [
      { name: 'Vacc suit', quantity: 1, notes: 'Tailored' }
    ])
    assert.equal(character?.credits, 1200)
  })

  it('replaces manual character sheet equipment without changing other fields', () => {
    const characterId = asCharacterId('char-1')
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'CharacterCreated',
        characterId,
        ownerId: actorId,
        characterType: 'PLAYER',
        name: 'Scout'
      }),
      envelope(3, {
        type: 'CharacterSheetUpdated',
        characterId,
        notes: 'Scout service term notes',
        age: 34,
        characteristics: {
          dex: 9,
          edu: 8
        },
        skills: ['Pilot 1', 'Vacc Suit 0'],
        equipment: [
          {
            name: 'Vacc suit',
            quantity: 1,
            notes: 'Tailored'
          },
          {
            name: 'Laser carbine',
            quantity: 1,
            notes: ''
          }
        ],
        credits: 1200
      }),
      envelope(4, {
        type: 'CharacterSheetUpdated',
        characterId,
        equipment: [
          {
            name: 'Medkit',
            quantity: 2,
            notes: 'Field issue'
          }
        ]
      })
    ])

    const character = state?.characters[characterId]
    assert.equal(character?.notes, 'Scout service term notes')
    assert.equal(character?.age, 34)
    assert.deepEqual(character?.characteristics, {
      str: null,
      dex: 9,
      end: null,
      int: null,
      edu: 8,
      soc: null
    })
    assert.deepEqual(character?.skills, ['Pilot 1', 'Vacc Suit 0'])
    assert.deepEqual(character?.equipment, [
      { name: 'Medkit', quantity: 2, notes: 'Field issue' }
    ])
    assert.equal(character?.credits, 1200)
  })

  it('projects piece character links', () => {
    const characterId = asCharacterId('char-1')
    const pieceId = asPieceId('piece-1')
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'BoardCreated',
        boardId: asBoardId('board-1'),
        name: 'Downport',
        imageAssetId: null,
        url: null,
        width: 1000,
        height: 800,
        scale: 50
      }),
      envelope(3, {
        type: 'PieceCreated',
        pieceId,
        boardId: asBoardId('board-1'),
        characterId,
        name: 'Scout',
        imageAssetId: null,
        x: 10,
        y: 20
      })
    ])

    assert.equal(state?.pieces[pieceId]?.characterId, characterId)
    assert.equal(state?.pieces[pieceId]?.width, 50)
    assert.equal(state?.pieces[pieceId]?.height, 50)
    assert.equal(state?.pieces[pieceId]?.scale, 1)
  })

  it('projects custom piece dimensions', () => {
    const pieceId = asPieceId('door-1')
    const state = projectGameState([
      envelope(1, {
        type: 'GameCreated',
        slug: 'game-1',
        name: 'Spinward Test',
        ownerId: actorId
      }),
      envelope(2, {
        type: 'BoardCreated',
        boardId: asBoardId('board-1'),
        name: 'Downport',
        imageAssetId: null,
        url: null,
        width: 1000,
        height: 800,
        scale: 50
      }),
      envelope(3, {
        type: 'PieceCreated',
        pieceId,
        boardId: asBoardId('board-1'),
        characterId: null,
        name: 'Airlock',
        imageAssetId: null,
        x: 10,
        y: 20,
        width: 50,
        height: 100,
        scale: 1.5
      })
    ])

    assert.equal(state?.pieces[pieceId]?.width, 50)
    assert.equal(state?.pieces[pieceId]?.height, 100)
    assert.equal(state?.pieces[pieceId]?.scale, 1.5)
  })
})
