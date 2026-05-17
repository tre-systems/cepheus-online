import type { CharacterId } from '../../../../shared/ids'
import type { ClientDiceRollActivity } from '../../../game-commands'
import type { CharacterCreationController } from './controller'
import type { CharacterCreationPanelController } from './panel'

export interface CharacterCreationLifecycleControllerDeps {
  controller: Pick<
    CharacterCreationController,
    'openFollow' | 'refreshFollowed' | 'shouldRefreshEditable' | 'viewModel'
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
    options?: Parameters<CharacterCreationController['openFollow']>[1]
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
}: CharacterCreationLifecycleControllerDeps): CharacterCreationLifecycleController => {
  let refreshGeneration = 0

  return {
    openFollow: (characterId, options = {}) => {
      const { readOnly = true } = options
      const flow = controller.openFollow(characterId, options)
      if (!flow && !controller.viewModel().wizard) return false

      if (!readOnly) {
        closeCharacterSheet()
      }
      panel.open()
      renderWizard()
      panel.scrollToTop()
      return true
    },

    planStateRefresh: ({ deferFollowedCreationRolls = [] } = {}) => {
      refreshGeneration += 1
      const plannedGeneration = refreshGeneration
      const shouldRenderFollowedCreation = controller.refreshFollowed()
      const shouldRenderEditableCreation = controller.shouldRefreshEditable({
        deferredRollCount: deferFollowedCreationRolls.length
      })

      return {
        renderAfterAppRender: () => {
          if (shouldRenderFollowedCreation) {
            if (deferFollowedCreationRolls.length > 0) {
              Promise.all(
                deferFollowedCreationRolls.map((roll) =>
                  waitForDiceReveal(roll)
                )
              )
                .then(() => {
                  if (plannedGeneration !== refreshGeneration) return
                  if (controller.refreshFollowed()) {
                    renderWizard()
                  }
                })
                .catch((error) => {
                  if (plannedGeneration === refreshGeneration) {
                    reportError(error.message)
                  }
                })
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
  }
}
