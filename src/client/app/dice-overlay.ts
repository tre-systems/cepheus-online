import type { LiveDiceRollRevealTarget } from '../../shared/live-activity.js'
import {
  type DicePipSlot,
  deriveDicePipSlots,
  deriveDiceRollTiming,
  deriveDieFaces,
  deriveDieTilt
} from '../dice.js'

export type DiceFaceValueContent =
  | { kind: 'pips'; slots: readonly DicePipSlot[] }
  | { kind: 'numeric'; label: string }

export type BrowserDiceRoll = LiveDiceRollRevealTarget

export const hasDiceRollResult = (
  roll: Partial<BrowserDiceRoll> | null | undefined
): roll is BrowserDiceRoll =>
  Array.isArray(roll?.rolls) && typeof roll?.total === 'number'

export interface AnimateRollOptions {
  roll: BrowserDiceRoll
  overlay: HTMLElement
  stage: HTMLElement
  hideTimer: number | null
  onReveal?: () => void
}

export interface PendingDiceRoll {
  id: string
  revealAt: string
}

export interface AnimatePendingRollOptions {
  roll: PendingDiceRoll
  overlay: HTMLElement
  stage: HTMLElement
  hideTimer: number | null
  onReveal?: () => void
}

export const deriveFaceValueContent = (value: number): DiceFaceValueContent => {
  const slots = deriveDicePipSlots(value)

  return slots
    ? { kind: 'pips', slots }
    : { kind: 'numeric', label: String(value) }
}

export const appendFaceValue = (face: HTMLElement, value: number): void => {
  const content = deriveFaceValueContent(value)
  if (content.kind === 'numeric') {
    face.classList.add('numeric')
    face.textContent = content.label
    return
  }

  for (const slot of content.slots) {
    const pip = document.createElement('span')
    pip.className = `pip pip-${slot}`
    face.append(pip)
  }
}

export const buildDie = (value: number, index: number): HTMLElement => {
  const die = document.createElement('div')
  die.className = 'die rolling'
  die.setAttribute('aria-label', `Die result ${value}`)
  const tilt = deriveDieTilt(index)
  die.style.setProperty('--die-tilt-x', tilt.x)
  die.style.setProperty('--die-tilt-y', tilt.y)
  die.style.setProperty('--die-tilt-z', tilt.z)
  for (const { name, value: label } of deriveDieFaces(value)) {
    const face = document.createElement('div')
    face.className = `face ${name}`
    face.setAttribute('aria-hidden', 'true')
    appendFaceValue(face, label)
    die.append(face)
  }
  return die
}

export const animateRoll = ({
  roll,
  overlay,
  stage,
  hideTimer,
  onReveal
}: AnimateRollOptions): number => {
  if (hideTimer) window.clearTimeout(hideTimer)
  overlay.classList.add('visible')
  const timing = deriveDiceRollTiming({
    revealAt: roll.revealAt,
    nowMs: Date.now()
  })
  const row = document.createElement('div')
  row.className = 'dice-row'
  for (const [index, value] of roll.rolls.entries()) {
    const die = buildDie(value, index)
    die.style.animationDuration = `${timing.rollDurationMs}ms`
    row.append(die)
  }
  const total = document.createElement('div')
  total.className = 'roll-total'
  total.textContent = 'Rolling...'
  row.append(total)
  stage.replaceChildren(row)
  setTimeout(() => {
    total.textContent = String(roll.total)
    for (const die of Array.from(row.querySelectorAll('.die'))) {
      die.classList.remove('rolling')
    }
    onReveal?.()
  }, timing.rollDurationMs)

  return window.setTimeout(() => {
    overlay.classList.remove('visible')
  }, timing.visibleDurationMs)
}

export const animatePendingRoll = ({
  roll,
  overlay,
  stage,
  hideTimer,
  onReveal
}: AnimatePendingRollOptions): number => {
  if (hideTimer) window.clearTimeout(hideTimer)
  overlay.classList.add('visible')
  const timing = deriveDiceRollTiming({
    revealAt: roll.revealAt,
    nowMs: Date.now()
  })
  const row = document.createElement('div')
  row.className = 'dice-row'
  for (const value of [1, 1]) {
    const die = buildDie(value, row.children.length)
    die.style.animationDuration = `${timing.rollDurationMs}ms`
    row.append(die)
  }
  const total = document.createElement('div')
  total.className = 'roll-total'
  total.textContent = 'Rolling...'
  row.append(total)
  stage.replaceChildren(row)
  setTimeout(() => {
    total.textContent = '?'
    for (const die of Array.from(row.querySelectorAll('.die'))) {
      die.classList.remove('rolling')
    }
    onReveal?.()
  }, timing.rollDurationMs)

  return window.setTimeout(() => {
    overlay.classList.remove('visible')
  }, timing.visibleDurationMs)
}
