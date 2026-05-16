import type { CepheusRuleset } from '../../../../shared/character-creation/cepheus-srd-ruleset.js'
import {
  deriveCharacterCreationReadModel,
  type CharacterCreationReadModel,
  type CharacterCreationProjectionReadModel
} from '../../../../shared/character-creation/view-state.js'
import type { CharacterCreationProjection } from '../../../../shared/state'
import type { CharacterCreationFlow } from './flow.js'
import { localFlowWizardViewModel } from './model-local-flow.js'
import { readModelWizardViewModel } from './model-read-model-steps.js'
import { pendingViewModel, projectionViewModel } from './model-projection.js'
import type {
  CharacterCreationProjectionViewModel,
  CharacterCreationViewModel,
  CharacterCreationWizardViewModel,
  DeriveCharacterCreationViewModelOptions
} from './model-types.js'

export { flowFromProjectedCharacterReadModel } from './read-model-flow.js'
export type {
  CharacterCreationPendingViewModel,
  CharacterCreationProjectedActionSection,
  CharacterCreationProjectionViewModel,
  CharacterCreationViewModel,
  CharacterCreationViewModelMode,
  CharacterCreationWizardViewModel,
  DeriveCharacterCreationViewModelOptions
} from './model-types.js'
export { deriveCharacterCreationProjectedActionSection } from './model-projection.js'

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
