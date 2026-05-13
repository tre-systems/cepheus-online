import type {
  ClientDiceRollActivity,
  ClientMessageApplication
} from '../game-commands.js'
import {
  deriveCreationActivityCardsFromApplication,
  type CreationActivityCardViewModel
} from './creation-activity-view.js'
import { hasRedactedCreationActivityDetails } from './live-activity-client.js'

export interface CreationActivityFeedElements {
  feed: HTMLElement
}

export interface CreationActivityFeedController {
  clear(): void
  show(application: ClientMessageApplication, delayMs?: number): void
  dispose(): void
}

export interface CreationActivityFeedOptions {
  elements: CreationActivityFeedElements
  getViewerActorId: () => string
  shouldSuppressCards: () => boolean
  setTimeout: typeof window.setTimeout
  clearTimeout: typeof window.clearTimeout
}

const renderCreationActivityCard = (
  feed: HTMLElement,
  card: CreationActivityCardViewModel,
  scheduleTimer: (callback: () => void, delayMs: number) => number
): void => {
  const item = document.createElement('article')
  item.className = `creation-activity-card ${card.tone}`
  item.setAttribute('role', 'status')

  const title = document.createElement('strong')
  title.textContent = card.title

  const detail = document.createElement('span')
  detail.textContent = card.detail

  item.append(title, detail)
  feed.prepend(item)

  while (feed.children.length > 3) {
    feed.lastElementChild?.remove()
  }

  scheduleTimer(() => {
    item.classList.add('leaving')
    scheduleTimer(() => item.remove(), 220)
  }, 5200)
}

export const creationActivityRevealDelayMs = (
  diceRollActivities: readonly ClientDiceRollActivity[],
  nowMs = Date.now()
): number => {
  if (diceRollActivities.length === 0) return 0

  const revealAtMs = Math.max(
    ...diceRollActivities.map((activity) => Date.parse(activity.revealAt))
  )
  if (!Number.isFinite(revealAtMs)) return 0

  return Math.max(0, revealAtMs - nowMs) + 160
}

export const createCreationActivityFeedController = ({
  elements,
  getViewerActorId,
  shouldSuppressCards,
  setTimeout,
  clearTimeout
}: CreationActivityFeedOptions): CreationActivityFeedController => {
  const timers = new Set<number>()

  const scheduleTimer = (callback: () => void, delayMs: number): number => {
    const timer = setTimeout(() => {
      timers.delete(timer)
      callback()
    }, delayMs)
    timers.add(timer)
    return timer
  }

  const clear = (): void => {
    for (const timer of timers) {
      clearTimeout(timer)
    }
    timers.clear()
    elements.feed.replaceChildren()
  }

  return {
    clear,
    show(application, delayMs = 0) {
      if (shouldSuppressCards()) return
      if (
        hasRedactedCreationActivityDetails(application) &&
        application.diceRollActivities.some(
          (activity) => activity.total === undefined
        )
      ) {
        return
      }

      const cards = deriveCreationActivityCardsFromApplication(application, {
        viewerActorId: getViewerActorId()
      })
      if (cards.length === 0) return

      const renderCards = () => {
        for (const card of cards) {
          renderCreationActivityCard(elements.feed, card, scheduleTimer)
        }
      }

      if (delayMs > 0) {
        scheduleTimer(renderCards, delayMs)
        return
      }

      renderCards()
    },
    dispose: clear
  }
}
