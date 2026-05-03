import {createMachine} from 'xstate'

export type BoardInteractionContext = Record<string, never>

export type BoardInteractionEvent =
  | {type: 'DRAG_START'}
  | {type: 'DRAG_END'}
  | {type: 'MEASURE_START'}
  | {type: 'MEASURE_END'}
  | {type: 'FILE_HOVER'}
  | {type: 'FILE_LEAVE'}
  | {type: 'FILE_DROP'}
  | {type: 'RESET'}

export type BoardInteractionState =
  | {value: 'idle'; context: BoardInteractionContext}
  | {value: 'dragging'; context: BoardInteractionContext}
  | {value: 'measuring'; context: BoardInteractionContext}
  | {value: 'dropping'; context: BoardInteractionContext}

export const createBoardInteractionMachine = () => {
  return createMachine<
    BoardInteractionContext,
    BoardInteractionEvent,
    BoardInteractionState
  >(
    {
      id: 'boardInteraction',
      initial: 'idle',
      predictableActionArguments: true,
      context: {},
      states: {
        idle: {
          on: {
            DRAG_START: 'dragging',
            MEASURE_START: 'measuring',
            FILE_HOVER: 'dropping'
          }
        },
        dragging: {
          on: {
            DRAG_END: 'idle'
          }
        },
        measuring: {
          on: {
            MEASURE_END: 'idle'
          }
        },
        dropping: {
          on: {
            FILE_LEAVE: 'idle',
            FILE_DROP: 'idle'
          }
        }
      },
      on: {
        RESET: 'idle'
      }
    },
    {
      actions: {},
      guards: {},
      services: {}
    }
  )
}
