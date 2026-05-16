import type { CareerCreationStatus } from '../../../../shared/character-creation/types'
import { characterCreationStepFromStatus } from '../../../../shared/character-creation/view-state.js'
import type { CharacterCreationStep } from './flow.js'

export const creationStepFromStatus = (
  status: CareerCreationStatus | string
): CharacterCreationStep =>
  status === 'MUSTERING_OUT'
    ? 'equipment'
    : characterCreationStepFromStatus(status)
