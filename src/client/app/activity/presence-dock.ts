import type { CharacterId } from '../../../shared/ids'
import type { CharacterState, GameState } from '../../../shared/state'
import { deriveCharacterCreationReadModel } from '../../../shared/character-creation/view-state.js'

export interface ActiveCreationSummary {
  id: CharacterId
  name: string
  ownerId: CharacterState['ownerId']
  status: string
  statusLabel: string
  rolledCharacteristics: number
  terms: number
}

export interface CreationPresenceDockElements {
  dock: HTMLElement
  characterCreator: HTMLElement
  sheet: HTMLElement
}

export interface CreationPresenceDockController {
  hydrate(): void
  render(state: GameState | null): void
}

export interface CreationPresenceDockOptions {
  elements: CreationPresenceDockElements
  getRoomId: () => string
  getActorId: () => string
  openCharacterCreationFollow: (
    characterId: CharacterId,
    options: { readOnly: boolean }
  ) => void
  localStorage: Storage
  autoFollowSingleRemoteCreation?: boolean
}

export const activeCreationSummaries = (
  state: GameState | null,
  dismissedCreationPresenceIds: ReadonlySet<string>
): ActiveCreationSummary[] => {
  if (!state) return []

  const summaries: ActiveCreationSummary[] = []
  for (const character of Object.values(state.characters)) {
    const creation = deriveCharacterCreationReadModel(character)
    if (!creation?.isActive || dismissedCreationPresenceIds.has(character.id)) {
      continue
    }

    summaries.push({
      id: creation.characterId,
      name: creation.name,
      ownerId: creation.ownerId,
      status: creation.status,
      statusLabel: creation.statusLabel,
      rolledCharacteristics: creation.rolledCharacteristicCount,
      terms: creation.termCount
    })
  }

  return summaries
}

export const createCreationPresenceDock = ({
  elements,
  getRoomId,
  getActorId,
  openCharacterCreationFollow,
  localStorage,
  autoFollowSingleRemoteCreation = true
}: CreationPresenceDockOptions): CreationPresenceDockController => {
  const dismissedCreationPresenceIds = new Set<string>()

  const storageKey = (): string =>
    `cepheus.creationPresence.dismissed.${getRoomId()}.${getActorId()}`

  const persist = (): void => {
    try {
      localStorage.setItem(
        storageKey(),
        JSON.stringify([...dismissedCreationPresenceIds])
      )
    } catch {
      // Best-effort local UI state. Losing it should not block play.
    }
  }

  const hide = (): void => {
    elements.dock.hidden = true
    elements.dock.replaceChildren()
  }

  const controller: CreationPresenceDockController = {
    hydrate() {
      dismissedCreationPresenceIds.clear()
      try {
        const stored = localStorage.getItem(storageKey())
        const parsed = stored ? JSON.parse(stored) : []
        if (Array.isArray(parsed)) {
          for (const id of parsed) {
            if (typeof id === 'string') dismissedCreationPresenceIds.add(id)
          }
        }
      } catch {
        dismissedCreationPresenceIds.clear()
      }
    },
    render(state) {
      if (
        !elements.characterCreator.hidden ||
        elements.sheet.classList.contains('open')
      ) {
        hide()
        return
      }

      const summaries = activeCreationSummaries(
        state,
        dismissedCreationPresenceIds
      )
      if (summaries.length === 0) {
        hide()
        return
      }

      const currentActorId = getActorId()
      if (
        autoFollowSingleRemoteCreation &&
        summaries.length === 1 &&
        summaries[0]?.ownerId !== currentActorId
      ) {
        hide()
        openCharacterCreationFollow(summaries[0].id, { readOnly: true })
        return
      }

      const heading = document.createElement('div')
      heading.className = 'creation-presence-heading'

      const title = document.createElement('strong')
      title.textContent = 'Creation live'

      const count = document.createElement('span')
      count.textContent =
        summaries.length === 1
          ? '1 traveller'
          : `${summaries.length} travellers`

      const clearButton = document.createElement('button')
      clearButton.type = 'button'
      clearButton.className = 'creation-presence-clear'
      clearButton.textContent = 'Clear'
      clearButton.title = 'Hide these live creation cards on this screen'
      clearButton.addEventListener('click', () => {
        for (const summary of summaries) {
          dismissedCreationPresenceIds.add(summary.id)
        }
        persist()
        controller.render(state)
      })
      heading.append(title, count, clearButton)

      const list = document.createElement('div')
      list.className = 'creation-presence-list'
      const items = summaries.map((summary) => {
        const item = document.createElement('button')
        item.className = 'creation-presence-card'
        item.type = 'button'
        item.title = `Open ${summary.name}`

        const name = document.createElement('strong')
        name.textContent = summary.name

        const detail = document.createElement('span')
        detail.textContent = `${summary.statusLabel} · ${summary.rolledCharacteristics}/6 stats · ${summary.terms} terms`

        const owner = document.createElement('small')
        owner.textContent = summary.ownerId
          ? `by ${summary.ownerId}`
          : 'unowned'

        item.append(name, detail, owner)
        item.addEventListener('click', () => {
          openCharacterCreationFollow(summary.id, {
            readOnly: summary.ownerId !== getActorId()
          })
        })
        return item
      })
      list.append(...items)

      elements.dock.hidden = false
      elements.dock.replaceChildren(heading, list)
    }
  }

  return controller
}
