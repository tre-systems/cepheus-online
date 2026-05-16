import {
  characterCreationCareerEventHandlers,
  type CharacterCreationCareerEventType
} from './character-creation-career-handlers'
import {
  withCharacterCreationActionPlans,
  type CharacterCreationProjectionOptions
} from './character-creation-helpers'
import {
  characterCreationMusteringEventHandlers,
  type CharacterCreationMusteringEventType
} from './character-creation-mustering-handlers'
import {
  characterCreationRiskEventHandlers,
  type CharacterCreationRiskEventType
} from './character-creation-risk-handlers'
import {
  characterCreationSetupEventHandlers,
  type CharacterCreationSetupEventType
} from './character-creation-setup-handlers'
import {
  characterSheetEventHandlers,
  type CharacterSheetEventType
} from './character-sheet-handlers'
import type { EventHandlerMap } from './types'

export type { CharacterCreationProjectionOptions } from './character-creation-helpers'

type CharacterEventType =
  | CharacterSheetEventType
  | CharacterCreationSetupEventType
  | CharacterCreationCareerEventType
  | CharacterCreationRiskEventType
  | CharacterCreationMusteringEventType

const rawCharacterEventHandlers = {
  ...characterSheetEventHandlers,
  ...characterCreationSetupEventHandlers,
  ...characterCreationCareerEventHandlers,
  ...characterCreationRiskEventHandlers,
  ...characterCreationMusteringEventHandlers
} satisfies EventHandlerMap<CharacterEventType>

export const createCharacterEventHandlers = (
  options: CharacterCreationProjectionOptions = {}
) =>
  withCharacterCreationActionPlans<
    CharacterEventType,
    typeof rawCharacterEventHandlers
  >(rawCharacterEventHandlers, options)

export const characterEventHandlers = createCharacterEventHandlers()
