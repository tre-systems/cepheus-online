import type { CepheusRuleset } from '../../../../shared/character-creation/cepheus-srd-ruleset'
import {
  deriveCharacterCreationReadModel,
  type CharacterCreationReadModel,
  type CharacterCreationProjectionReadModel
} from '../../../../shared/character-creation/view-state'
import type { CharacterCreationProjection } from '../../../../shared/state'
import type { CharacterCreationFlow } from './flow'
import { localFlowWizardViewModel } from './model-local-flow'
import { readModelWizardViewModel } from './model-read-model-steps'
import { pendingViewModel, projectionViewModel } from './model-projection'
import type {
  CharacterCreationProjectionViewModel,
  CharacterCreationViewModel,
  CharacterCreationWizardViewModel,
  DeriveCharacterCreationViewModelOptions
} from './model-types'

export { flowFromProjectedCharacterReadModel } from './read-model-flow'
export type {
  CharacterCreationPendingViewModel,
  CharacterCreationProjectedActionSection,
  CharacterCreationProjectionViewModel,
  CharacterCreationViewModel,
  CharacterCreationViewModelMode,
  CharacterCreationWizardViewModel,
  DeriveCharacterCreationViewModelOptions
} from './model-types'
export { deriveCharacterCreationProjectedActionSection } from './model-projection'

const wizardViewModel = ({
  flow,
  projectedCreation,
  projection,
  projectionReadModel,
  characterReadModel,
  readOnly,
  ruleset
}: {
  flow: CharacterCreationFlow | null
  projectedCreation: CharacterCreationProjection | null
  projection: CharacterCreationProjectionViewModel
  projectionReadModel: CharacterCreationProjectionReadModel | null
  characterReadModel: CharacterCreationReadModel | null
  readOnly: boolean
  ruleset?: CepheusRuleset | null
}): CharacterCreationWizardViewModel | null => {
  const preferLocalReviewFlow = !readOnly && flow?.step === 'review'

  const shouldUseReadModelHomeworld =
    characterReadModel?.status !== 'HOMEWORLD' || readOnly || !flow
  if (characterReadModel && projectedCreation && shouldUseReadModelHomeworld) {
    const readModelWizard = readModelWizardViewModel({
      readModel: characterReadModel,
      projectedCreation,
      readOnly,
      ruleset,
      preferLocalReviewFlow
    })
    if (readModelWizard) return readModelWizard
  }

  if (!flow) {
    return null
  }

  return localFlowWizardViewModel({
    flow,
    projectedCreation,
    projection,
    projectionReadModel,
    characterReadModel,
    readOnly
  })
}

export const deriveCharacterCreationViewModel = ({
  flow,
  projection,
  character = null,
  readOnly,
  actionPlan = null,
  ruleset
}: DeriveCharacterCreationViewModelOptions): CharacterCreationViewModel => {
  const projected = projectionViewModel(projection)
  const characterReadModel = character
    ? deriveCharacterCreationReadModel(character)
    : null
  const wizard = wizardViewModel({
    flow,
    projectedCreation: projection,
    projection: projected.summary,
    projectionReadModel: projected.readModel,
    characterReadModel,
    readOnly,
    ruleset
  })

  return {
    mode:
      !flow && !characterReadModel
        ? 'empty'
        : readOnly
          ? 'read-only'
          : 'editable',
    title:
      flow?.draft.name.trim() ||
      characterReadModel?.name.trim() ||
      'Create traveller',
    characterId: flow?.draft.characterId ?? character?.id ?? null,
    flow,
    readOnly,
    controlsDisabled: readOnly,
    projection: projected.summary,
    projectionReadModel: projected.readModel,
    characterReadModel,
    pending: pendingViewModel(flow, projection),
    wizard,
    actionPlan
  }
}
