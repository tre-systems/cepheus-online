/**
 * Character Creation State Machine
 *
 * XState (v4) state machine that manages the character creation flow for
 * Cepheus Engine characters. Enforces valid state transitions and provides
 * a single source of truth for creation status.
 */
import {assign, createMachine} from 'xstate'

export type CreationEvent =
  | {type: 'SET_CHARACTERISTICS'}
  | {type: 'COMPLETE_HOMEWORLD'}
  | {type: 'SELECT_CAREER'; isNewCareer: boolean; drafted?: boolean}
  | {type: 'COMPLETE_BASIC_TRAINING'}
  | {type: 'SURVIVAL_PASSED'; canCommission: boolean; canAdvance: boolean}
  | {type: 'SURVIVAL_FAILED'}
  | {type: 'COMPLETE_COMMISSION'}
  | {type: 'SKIP_COMMISSION'}
  | {type: 'COMPLETE_ADVANCEMENT'}
  | {type: 'SKIP_ADVANCEMENT'}
  | {type: 'COMPLETE_SKILLS'}
  | {type: 'COMPLETE_AGING'}
  | {type: 'REENLIST'}
  | {type: 'LEAVE_CAREER'}
  | {type: 'REENLIST_BLOCKED'}
  | {type: 'FORCED_REENLIST'}
  | {type: 'CONTINUE_CAREER'}
  | {type: 'FINISH_MUSTERING'}
  | {type: 'CREATION_COMPLETE'}
  | {type: 'DEATH_CONFIRMED'}
  | {type: 'MISHAP_RESOLVED'}
  | {type: 'RESET'}

export interface CreationContext {
  characterId: string
  canCommission: boolean
  canAdvance: boolean
}

export type CreationState =
  | {value: 'CHARACTERISTICS'; context: CreationContext}
  | {value: 'HOMEWORLD'; context: CreationContext}
  | {value: 'CAREER_SELECTION'; context: CreationContext}
  | {value: 'BASIC_TRAINING'; context: CreationContext}
  | {value: 'SURVIVAL'; context: CreationContext}
  | {value: 'MISHAP'; context: CreationContext}
  | {value: 'COMMISSION'; context: CreationContext}
  | {value: 'ADVANCEMENT'; context: CreationContext}
  | {value: 'SKILLS_TRAINING'; context: CreationContext}
  | {value: 'AGING'; context: CreationContext}
  | {value: 'REENLISTMENT'; context: CreationContext}
  | {value: 'MUSTERING_OUT'; context: CreationContext}
  | {value: 'ACTIVE'; context: CreationContext}
  | {value: 'PLAYABLE'; context: CreationContext}
  | {value: 'DECEASED'; context: CreationContext}

/**
 * Creates a character creation state machine with the given character ID.
 */
export const createCharacterCreationMachine = (characterId: string) =>
  createMachine<CreationContext, CreationEvent, CreationState>(
    {
      id: 'characterCreation',
      initial: 'CHARACTERISTICS',
      predictableActionArguments: true,
      context: {
        characterId,
        canCommission: false,
        canAdvance: false
      },
      states: {
        CHARACTERISTICS: {
          on: {
            SET_CHARACTERISTICS: 'HOMEWORLD'
          }
        },
        HOMEWORLD: {
          on: {
            COMPLETE_HOMEWORLD: 'CAREER_SELECTION'
          }
        },
        CAREER_SELECTION: {
          on: {
            SELECT_CAREER: [
              {
                target: 'BASIC_TRAINING',
                cond: 'isNewCareer'
              },
              {
                target: 'SURVIVAL'
              }
            ]
          }
        },
        BASIC_TRAINING: {
          on: {
            COMPLETE_BASIC_TRAINING: 'SURVIVAL'
          }
        },
        SURVIVAL: {
          on: {
            SURVIVAL_PASSED: [
              {
                target: 'COMMISSION',
                cond: 'canCommission',
                actions: 'setPromotionFlags'
              },
              {
                target: 'ADVANCEMENT',
                cond: 'canAdvance',
                actions: 'setPromotionFlags'
              },
              {
                target: 'SKILLS_TRAINING',
                actions: 'setPromotionFlags'
              }
            ],
            SURVIVAL_FAILED: 'MISHAP'
          }
        },
        MISHAP: {
          on: {
            DEATH_CONFIRMED: 'DECEASED',
            MISHAP_RESOLVED: 'MUSTERING_OUT'
          }
        },
        COMMISSION: {
          on: {
            COMPLETE_COMMISSION: 'SKILLS_TRAINING',
            SKIP_COMMISSION: 'SKILLS_TRAINING'
          }
        },
        ADVANCEMENT: {
          on: {
            COMPLETE_ADVANCEMENT: 'SKILLS_TRAINING',
            SKIP_ADVANCEMENT: 'SKILLS_TRAINING'
          }
        },
        SKILLS_TRAINING: {
          on: {
            COMPLETE_SKILLS: 'AGING'
          }
        },
        AGING: {
          on: {
            COMPLETE_AGING: 'REENLISTMENT'
          }
        },
        REENLISTMENT: {
          on: {
            REENLIST: 'SURVIVAL',
            FORCED_REENLIST: 'SURVIVAL',
            LEAVE_CAREER: 'MUSTERING_OUT',
            REENLIST_BLOCKED: 'MUSTERING_OUT'
          }
        },
        MUSTERING_OUT: {
          on: {
            CONTINUE_CAREER: 'CAREER_SELECTION',
            FINISH_MUSTERING: 'ACTIVE'
          }
        },
        ACTIVE: {
          on: {
            CREATION_COMPLETE: 'PLAYABLE'
          }
        },
        PLAYABLE: {
          type: 'final'
        },
        DECEASED: {
          // Not marked as final so RESET can work
          on: {
            RESET: 'CHARACTERISTICS'
          }
        }
      },
      on: {
        RESET: {
          target: 'CHARACTERISTICS',
          actions: 'resetContext'
        }
      }
    },
    {
      guards: {
        isNewCareer: (_context, event) =>
          event.type === 'SELECT_CAREER' && event.isNewCareer,
        canCommission: (_context, event) =>
          event.type === 'SURVIVAL_PASSED' && event.canCommission,
        canAdvance: (_context, event) =>
          event.type === 'SURVIVAL_PASSED' && event.canAdvance
      },
      actions: {
        setPromotionFlags: assign({
          canCommission: (_context, event) =>
            event.type === 'SURVIVAL_PASSED' ? event.canCommission : false,
          canAdvance: (_context, event) =>
            event.type === 'SURVIVAL_PASSED' ? event.canAdvance : false
        }),
        resetContext: assign({
          canCommission: false,
          canAdvance: false
        })
      }
    }
  )

/**
 * Maps a CharacterStatus string to the corresponding machine state.
 * Used for initializing machines from persisted character data.
 */
export const statusToMachineState = (
  status: string | undefined
): string | undefined => {
  // Direct mapping - machine states match CharacterStatus values
  const validStates = [
    'CHARACTERISTICS',
    'HOMEWORLD',
    'CAREER_SELECTION',
    'BASIC_TRAINING',
    'SURVIVAL',
    'MISHAP',
    'COMMISSION',
    'ADVANCEMENT',
    'SKILLS_TRAINING',
    'AGING',
    'REENLISTMENT',
    'MUSTERING_OUT',
    'ACTIVE',
    'PLAYABLE',
    'DECEASED'
  ]

  return status && validStates.includes(status) ? status : undefined
}

/**
 * Maps a machine state to the corresponding CharacterStatus string.
 * Used for persisting machine state to the character record.
 */
export const machineStateToStatus = (stateValue: string): string => {
  // Direct mapping - machine states match CharacterStatus values
  return stateValue
}

export default createCharacterCreationMachine
