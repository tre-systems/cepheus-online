import type { CareerCreationStatus } from '../../../../shared/character-creation/types'
import { characterCreationStepFromStatus } from '../../../../shared/character-creation/view-state'
import type { CharacterCreationStep } from './flow'

export const creationStepFromStatus = (
  status: CareerCreationStatus | string
): CharacterCreationStep =>
  status === 'MUSTERING_OUT'
    ? 'equipment'
    : characterCreationStepFromStatus(status)
