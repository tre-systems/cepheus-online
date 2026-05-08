import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type {
  BoardId,
  CharacterId,
  GameId,
  PieceId,
  UserId
} from '../../shared/ids'
import type {
  BoardState,
  CharacterCreationProjection,
  CharacterState,
  GameState,
  PieceState
} from '../../shared/state'
import {
  nextBootstrapCommand,
  parseNonNegativeIntegerValue,
  parsePositiveIntegerValue,
  parsePositiveNumberValue,
  uniqueBoardId,
  uniqueCharacterId,
  uniquePieceId
} from './bootstrap-flow'

const roomId = 'demo-room' as GameId
const actorId = 'local-user' as UserId

const board = (id: string): BoardState => ({
  id: id as BoardId,
  name: id,
  imageAssetId: null,
  url: null,
  width: 1200,
  height: 800,
  scale: 50,
  doors: {}
})

const creation = (
  overrides: Partial<CharacterCreationProjection> = {}
): CharacterCreationProjection => ({
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
  ...overrides
})

const scout = (
  skills: string[] = [],
  creationState: CharacterCreationProjection | null = null
): CharacterState => ({
  id: 'scout' as CharacterId,
  ownerId: null,
  type: 'PLAYER',
  name: 'Scout',
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
  skills,
  equipment: [],
  credits: 0,
  creation: creationState
})

const piece = (id: string, boardId = 'main-board'): PieceState => ({
  id: id as PieceId,
  boardId: boardId as BoardId,
  characterId: null,
  imageAssetId: null,
  name: id,
  x: 0,
  y: 0,
  z: 0,
  width: 50,
  height: 50,
  scale: 1,
  visibility: 'VISIBLE',
  freedom: 'UNLOCKED'
})

const boards = (...ids: string[]): Record<BoardId, BoardState> =>
  Object.fromEntries(ids.map((id) => [id, board(id)])) as Record<
    BoardId,
    BoardState
  >

const characters = (
  entries: Record<string, CharacterState>
): Record<CharacterId, CharacterState> =>
  entries as Record<CharacterId, CharacterState>

const pieces = (...ids: string[]): Record<PieceId, PieceState> =>
  Object.fromEntries(ids.map((id) => [id, piece(id)])) as Record<
    PieceId,
    PieceState
  >

const gameState = (overrides: Partial<GameState> = {}): GameState => ({
  id: roomId,
  slug: 'demo-room',
  name: 'Cepheus Room demo-room',
  ownerId: actorId,
  players: {},
  characters: {},
  boards: {},
  pieces: {},
  diceLog: [],
  selectedBoardId: null,
  eventSeq: 0,
  ...overrides
})

describe('bootstrap flow helpers', () => {
  it('returns the next command for each bootstrap step', () => {
    assert.equal(
      nextBootstrapCommand({ roomId, actorId, state: null })?.type,
      'CreateGame'
    )

    assert.equal(
      nextBootstrapCommand({ roomId, actorId, state: gameState() })?.type,
      'CreateBoard'
    )

    assert.equal(
      nextBootstrapCommand({
        roomId,
        actorId,
        state: gameState({
          boards: boards('main-board')
        })
      })?.type,
      'CreateCharacter'
    )

    assert.equal(
      nextBootstrapCommand({
        roomId,
        actorId,
        state: gameState({
          boards: boards('main-board'),
          characters: characters({ scout: scout() })
        })
      })?.type,
      'StartCharacterCreation'
    )

    const characteristicCommand = nextBootstrapCommand({
      roomId,
      actorId,
      state: gameState({
        boards: boards('main-board'),
        characters: characters({ scout: scout([], creation()) })
      })
    })
    assert.equal(
      characteristicCommand?.type,
      'RollCharacterCreationCharacteristic'
    )
    if (characteristicCommand?.type !== 'RollCharacterCreationCharacteristic') {
      return
    }
    assert.equal(characteristicCommand.characteristic, 'str')

    const nextCharacteristicScout = scout([], creation())
    nextCharacteristicScout.characteristics.str = 7
    const nextCharacteristicCommand = nextBootstrapCommand({
      roomId,
      actorId,
      state: gameState({
        boards: boards('main-board'),
        characters: characters({ scout: nextCharacteristicScout })
      })
    })
    assert.equal(
      nextCharacteristicCommand?.type,
      'RollCharacterCreationCharacteristic'
    )
    if (
      nextCharacteristicCommand?.type !== 'RollCharacterCreationCharacteristic'
    ) {
      return
    }
    assert.equal(nextCharacteristicCommand.characteristic, 'dex')

    assert.equal(
      nextBootstrapCommand({
        roomId,
        actorId,
        state: gameState({
          boards: boards('main-board'),
          characters: characters({
            scout: {
              ...nextCharacteristicScout,
              characteristics: {
                str: 7,
                dex: 8,
                end: 8,
                int: 7,
                edu: 9,
                soc: 6
              }
            }
          })
        })
      }),
      null
    )

    assert.deepEqual(
      nextBootstrapCommand({
        roomId,
        actorId,
        state: gameState({
          boards: boards('main-board'),
          characters: characters({
            scout: scout(
              [],
              creation({
                state: {
                  status: 'HOMEWORLD',
                  context: { canCommission: false, canAdvance: false }
                }
              })
            )
          })
        })
      }),
      {
        type: 'CompleteCharacterCreationHomeworld',
        gameId: roomId,
        actorId,
        characterId: 'scout' as CharacterId
      }
    )

    assert.equal(
      nextBootstrapCommand({
        roomId,
        actorId,
        state: gameState({
          boards: boards('main-board'),
          characters: characters({
            scout: scout(
              [],
              creation({
                state: {
                  status: 'CAREER_SELECTION',
                  context: { canCommission: false, canAdvance: false }
                }
              })
            )
          })
        })
      })?.type,
      'ResolveCharacterCreationQualification'
    )

    assert.equal(
      nextBootstrapCommand({
        roomId,
        actorId,
        state: gameState({
          boards: boards('main-board'),
          characters: characters({
            scout: scout(
              [],
              creation({
                state: {
                  status: 'CAREER_SELECTION',
                  context: { canCommission: false, canAdvance: false }
                },
                terms: [
                  {
                    career: 'Scout',
                    skills: [],
                    skillsAndTraining: [],
                    benefits: [],
                    complete: false,
                    canReenlist: true,
                    completedBasicTraining: false,
                    musteringOut: false,
                    anagathics: false
                  }
                ],
                careers: [{ name: 'Scout', rank: 0 }]
              })
            )
          })
        })
      })?.type,
      'ResolveCharacterCreationQualification'
    )

    assert.equal(
      nextBootstrapCommand({
        roomId,
        actorId,
        state: gameState({
          boards: boards('main-board'),
          characters: characters({
            scout: scout(
              [],
              creation({
                state: {
                  status: 'CAREER_SELECTION',
                  context: { canCommission: false, canAdvance: false }
                },
                failedToQualify: true
              })
            )
          })
        })
      })?.type,
      'EnterCharacterCreationDrifter'
    )

    assert.equal(
      nextBootstrapCommand({
        roomId,
        actorId,
        state: gameState({
          boards: boards('main-board'),
          characters: characters({
            scout: scout(
              [],
              creation({
                state: {
                  status: 'BASIC_TRAINING',
                  context: { canCommission: false, canAdvance: false }
                },
                terms: [
                  {
                    career: 'Scout',
                    skills: [],
                    skillsAndTraining: [],
                    benefits: [],
                    complete: false,
                    canReenlist: true,
                    completedBasicTraining: false,
                    musteringOut: false,
                    anagathics: false
                  }
                ],
                careers: [{ name: 'Scout', rank: 0 }]
              })
            )
          })
        })
      })?.type,
      'CreatePiece'
    )

    const createPiece = nextBootstrapCommand({
      roomId,
      actorId,
      state: gameState({
        boards: boards('main-board', 'side'),
        selectedBoardId: 'side' as BoardId,
        characters: characters({
          scout: scout(
            ['Recon-0'],
            creation({
              state: {
                status: 'BASIC_TRAINING',
                context: { canCommission: false, canAdvance: false }
              },
              terms: [
                {
                  career: 'Scout',
                  skills: [],
                  skillsAndTraining: [],
                  benefits: [],
                  complete: false,
                  canReenlist: true,
                  completedBasicTraining: false,
                  musteringOut: false,
                  anagathics: false
                }
              ],
              careers: [{ name: 'Scout', rank: 0 }]
            })
          )
        })
      })
    })
    assert.equal(createPiece?.type, 'CreatePiece')
    if (createPiece?.type !== 'CreatePiece') return
    assert.equal(createPiece.boardId, 'side')

    assert.equal(
      nextBootstrapCommand({
        roomId,
        actorId,
        state: gameState({
          boards: boards('main-board'),
          characters: characters({
            scout: scout(
              ['Recon-0'],
              creation({
                state: {
                  status: 'BASIC_TRAINING',
                  context: { canCommission: false, canAdvance: false }
                },
                terms: [
                  {
                    career: 'Scout',
                    skills: [],
                    skillsAndTraining: [],
                    benefits: [],
                    complete: false,
                    canReenlist: true,
                    completedBasicTraining: false,
                    musteringOut: false,
                    anagathics: false
                  }
                ],
                careers: [{ name: 'Scout', rank: 0 }]
              })
            )
          }),
          pieces: pieces('scout-1')
        })
      }),
      null
    )
  })

  it('falls back to the first board when selected board is invalid', () => {
    const command = nextBootstrapCommand({
      roomId,
      actorId,
      state: gameState({
        boards: boards('main-board', 'side'),
        selectedBoardId: 'missing' as BoardId,
        characters: characters({
          scout: scout(
            ['Recon-0'],
            creation({
              state: {
                status: 'BASIC_TRAINING',
                context: { canCommission: false, canAdvance: false }
              },
              terms: [
                {
                  career: 'Scout',
                  skills: [],
                  skillsAndTraining: [],
                  benefits: [],
                  complete: false,
                  canReenlist: true,
                  completedBasicTraining: false,
                  musteringOut: false,
                  anagathics: false
                }
              ],
              careers: [{ name: 'Scout', rank: 0 }]
            })
          )
        })
      })
    })

    assert.equal(command?.type, 'CreatePiece')
    if (command?.type !== 'CreatePiece') return
    assert.equal(command.boardId, 'main-board')
  })

  it('does not emit generic character creation events from production bootstrap', () => {
    const characteristicState = scout([], creation())
    const commands = [
      nextBootstrapCommand({
        roomId,
        actorId,
        state: gameState({
          boards: boards('main-board'),
          characters: characters({ scout: characteristicState })
        })
      }),
      nextBootstrapCommand({
        roomId,
        actorId,
        state: gameState({
          boards: boards('main-board'),
          characters: characters({
            scout: scout(
              [],
              creation({
                state: {
                  status: 'HOMEWORLD',
                  context: { canCommission: false, canAdvance: false }
                }
              })
            )
          })
        })
      }),
      nextBootstrapCommand({
        roomId,
        actorId,
        state: gameState({
          boards: boards('main-board'),
          characters: characters({
            scout: scout(
              [],
              creation({
                state: {
                  status: 'CAREER_SELECTION',
                  context: { canCommission: false, canAdvance: false }
                }
              })
            )
          })
        })
      }),
      nextBootstrapCommand({
        roomId,
        actorId,
        state: gameState({
          boards: boards('main-board'),
          characters: characters({
            scout: scout(
              [],
              creation({
                state: {
                  status: 'CAREER_SELECTION',
                  context: { canCommission: false, canAdvance: false }
                },
                failedToQualify: true
              })
            )
          })
        })
      })
    ]

    assert.deepEqual(
      commands.map((command) => command?.type),
      [
        'RollCharacterCreationCharacteristic',
        'CompleteCharacterCreationHomeworld',
        'ResolveCharacterCreationQualification',
        'EnterCharacterCreationDrifter'
      ]
    )
    assert.equal(
      commands.some(
        (command) =>
          command?.type === 'AdvanceCharacterCreation' &&
          (command.creationEvent.type === 'SET_CHARACTERISTICS' ||
            command.creationEvent.type === 'SELECT_CAREER')
      ),
      false
    )
  })

  it('generates unique ids from names and existing entity counts', () => {
    assert.equal(uniqueBoardId(null, 'Deck Plan'), 'deck-plan-1')
    assert.equal(
      uniqueBoardId(
        {
          boards: boards('deck-plan-1', 'deck-plan-2')
        },
        'Deck Plan'
      ),
      'deck-plan-3'
    )
    assert.equal(
      uniquePieceId(
        {
          pieces: pieces('scout-1', 'scout-3')
        },
        'Scout!'
      ),
      'scout-4'
    )
    assert.equal(
      uniqueCharacterId(
        { characters: characters({ 'character-1': scout() }) },
        '...'
      ),
      'character-2'
    )
  })

  it('parses numeric input values with existing fallback behavior', () => {
    assert.equal(parsePositiveIntegerValue('10px', 3), 10)
    assert.equal(parsePositiveIntegerValue('0', 3), 3)
    assert.equal(parsePositiveNumberValue('1.5x', 1), 1.5)
    assert.equal(parsePositiveNumberValue('-1', 1), 1)
    assert.equal(parseNonNegativeIntegerValue('0', 7), 0)
    assert.equal(parseNonNegativeIntegerValue('-1', 7), 7)
  })
})
