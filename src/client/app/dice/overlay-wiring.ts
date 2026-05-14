import type { LiveDiceRollRevealTarget } from '../../../shared/live-activity.js'
import type { DiceRollState } from '../../../shared/state.js'
import type { ClientDiceRollActivity } from '../../game-commands.js'
import {
  animatePendingRoll as animatePendingDiceOverlayRoll,
  animateRoll as animateDiceOverlayRoll,
  hasDiceRollResult,
  type AnimatePendingRollOptions,
  type AnimateRollOptions
} from './overlay.js'
import type { CharacterCreationPanelController } from '../character/creation/panel.js'

export interface DiceOverlayWiringOptions {
  elements: {
    overlay: HTMLElement
    stage: HTMLElement
  }
  panel: Pick<
    CharacterCreationPanelController,
    'overlayHost' | 'overlayContext'
  >
  resolveDiceReveal: (rollId: string) => void
  animateRoll?: (options: AnimateRollOptions) => number
  animatePendingRoll?: (options: AnimatePendingRollOptions) => number
}

export interface DiceOverlayWiring {
  animateRoll: (
    roll: LiveDiceRollRevealTarget | ClientDiceRollActivity | DiceRollState
  ) => void
}

export const createDiceOverlayWiring = ({
  elements,
  panel,
  resolveDiceReveal,
  animateRoll = animateDiceOverlayRoll,
  animatePendingRoll = animatePendingDiceOverlayRoll
}: DiceOverlayWiringOptions): DiceOverlayWiring => {
  let hideTimer: number | null = null

  return {
    animateRoll: (roll) => {
      const overlayHost = panel.overlayHost()
      if (overlayHost && elements.overlay.parentElement !== overlayHost) {
        overlayHost.append(elements.overlay)
      }

      const overlayContext = panel.overlayContext()
      elements.overlay.classList.toggle('in-creator', overlayContext.inCreator)
      elements.overlay.classList.toggle('in-dialog', overlayContext.inDialog)

      if (!hasDiceRollResult(roll)) {
        hideTimer = animatePendingRoll({
          roll,
          overlay: elements.overlay,
          stage: elements.stage,
          hideTimer,
          onReveal: () => resolveDiceReveal(roll.id)
        })
        return
      }

      hideTimer = animateRoll({
        roll,
        overlay: elements.overlay,
        stage: elements.stage,
        hideTimer,
        onReveal: () => resolveDiceReveal(roll.id)
      })
    }
  }
}
