import type { LiveDiceRollRevealTarget } from '../../shared/live-activity.js'
import type { DiceRollState } from '../../shared/state.js'
import {
  animateRoll as animateDiceOverlayRoll,
  type AnimateRollOptions
} from './dice-overlay.js'
import type { CharacterCreationPanelController } from './character-creation-panel.js'

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
}

export interface DiceOverlayWiring {
  animateRoll: (roll: LiveDiceRollRevealTarget | DiceRollState) => void
}

export const createDiceOverlayWiring = ({
  elements,
  panel,
  resolveDiceReveal,
  animateRoll = animateDiceOverlayRoll
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
