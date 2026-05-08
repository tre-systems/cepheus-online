import type { CharacterCreationProjection } from '../../shared/state'
import type {
  CharacterCreationFlow,
  CharacterCreationStep
} from './character-creation-flow.js'
import { creationStepFromStatus } from './character-creation-projection.js'

const characterCreationStepOrder = [
  'basics',
  'characteristics',
  'homeworld',
  'career',
  'skills',
  'equipment',
  'review'
] satisfies CharacterCreationStep[]

const characterCreationCharacteristicKeys = [
  'str',
  'dex',
  'end',
  'int',
  'edu',
  'soc'
] as const

export const characterCreationStepIndex = (step: string): number =>
  characterCreationStepOrder.indexOf(step as CharacterCreationStep) >= 0
    ? characterCreationStepOrder.indexOf(step as CharacterCreationStep)
    : characterCreationStepOrder.length

export const characterCreationCharacteristicsComplete = (
  flow: CharacterCreationFlow
): boolean =>
  characterCreationCharacteristicKeys.every(
    (key) => flow.draft.characteristics[key] != null
  )

export const shouldSyncEditableCharacterCreationFlowWithProjection = ({
  flow,
  creation,
  readOnly
}: {
  flow: CharacterCreationFlow | null
  creation: CharacterCreationProjection | null
  readOnly: boolean
}): boolean => {
  if (readOnly || !flow || !creation) return false

  const projectedStep = creationStepFromStatus(creation.state.status)
  const projectedStepIndex = characterCreationStepIndex(projectedStep)
  const localStepIndex = characterCreationStepIndex(flow.step)

  return (
    projectedStepIndex < localStepIndex ||
    (projectedStepIndex > localStepIndex &&
      (flow.step !== 'characteristics' ||
        characterCreationCharacteristicsComplete(flow))) ||
    (creation.state.status === 'SKILLS_TRAINING' &&
      JSON.stringify(creation.pendingCascadeSkills ?? []) !==
        JSON.stringify(flow.draft.pendingTermCascadeSkills)) ||
    (creation.state.status === 'BASIC_TRAINING' && flow.step === 'career')
  )
}
