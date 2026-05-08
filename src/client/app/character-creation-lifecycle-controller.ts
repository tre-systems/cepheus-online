import type { CharacterId } from '../../shared/ids.js'
import type { ClientDiceRollActivity } from '../game-commands.js'
import type { CharacterCreationController } from './character-creation-controller.js'
import type { CharacterCreationPanelController } from './character-creation-panel.js'

export interface CharacterCreationLifecycleControllerDeps {
  controller: Pick<
    CharacterCreationController,
    'openFollow' | 'refreshFollowed' | 'shouldRefreshEditable'
  >
  panel: Pick<CharacterCreationPanelController, 'open' | 'scrollToTop'>
  closeCharacterSheet: () => void
  renderWizard: () => void
  waitForDiceReveal: (roll: ClientDiceRollActivity) => Promise<unknown>
  reportError: (message: string) => void
}

export interface CharacterCreationStateRefreshPlan {
  renderAfterAppRender: () => void
}

export interface CharacterCreationLifecycleController {
  openFollow: (
    characterId: CharacterId,
    options?: { readOnly?: boolean }
  ) => boolean
  planStateRefresh: (options?: {
    deferFollowedCreationRolls?: readonly ClientDiceRollActivity[]
  }) => CharacterCreationStateRefreshPlan
}

export const createCharacterCreationLifecycleController = ({
  controller,
  panel,
  closeCharacterSheet,
  renderWizard,
  waitForDiceReveal,
  reportError
}: CharacterCreationLifecycleControllerDeps): CharacterCreationLifecycleController => ({
  openFollow: (characterId, { readOnly = true } = {}) => {
    const flow = controller.openFollow(characterId, { readOnly })
    if (!flow) return false

    if (!readOnly) {
      closeCharacterSheet()
    }
    panel.open()
    renderWizard()
    panel.scrollToTop()
    return true
  },

  planStateRefresh: ({ deferFollowedCreationRolls = [] } = {}) => {
    const shouldRenderFollowedCreation = controller.refreshFollowed()
    const shouldRenderEditableCreation = controller.shouldRefreshEditable({
      deferredRollCount: deferFollowedCreationRolls.length
    })

    return {
      renderAfterAppRender: () => {
        if (shouldRenderFollowedCreation) {
          if (deferFollowedCreationRolls.length > 0) {
            Promise.all(
              deferFollowedCreationRolls.map((roll) => waitForDiceReveal(roll))
            )
              .then(() => {
                if (controller.refreshFollowed()) {
                  renderWizard()
                }
              })
              .catch((error) => reportError(error.message))
          } else {
            renderWizard()
          }
        }
        if (shouldRenderEditableCreation) {
          renderWizard()
        }
      }
    }
  }
})
