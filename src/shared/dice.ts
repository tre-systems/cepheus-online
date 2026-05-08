import { err, ok, type Result } from './result'

export interface DiceExpression {
  count: number
  sides: number
  modifier: number
}

export interface DiceRollResult extends DiceExpression {
  expression: string
  rolls: number[]
  total: number
}

const DICE_EXPRESSION = /^(\d{1,2})d(\d{1,4})(?:([+-])(\d{1,3}))?$/i

export const parseDiceExpression = (
  expression: string
): Result<DiceExpression> => {
  const normalized = expression.trim()
  const match = DICE_EXPRESSION.exec(normalized)

  if (!match) {
    return err('Dice expression must look like 2d6, 1d20+2, or 3d6-1')
  }

  const count = Number(match[1])
  const sides = Number(match[2])
  const modifierRaw = Number(match[4] ?? 0)
  const modifier = match[3] === '-' ? -modifierRaw : modifierRaw

  if (count < 1 || count > 20) {
    return err('Dice expression must roll between 1 and 20 dice')
  }

  if (sides < 2 || sides > 1000) {
    return err('Dice expression must use between 2 and 1000 sides')
  }

  return ok({ count, sides, modifier })
}

export const rollDiceExpression = (
  expression: string,
  rng: () => number
): Result<DiceRollResult> => {
  const parsed = parseDiceExpression(expression)

  if (!parsed.ok) {
    return parsed
  }

  const rolls = Array.from(
    { length: parsed.value.count },
    () => Math.floor(rng() * parsed.value.sides) + 1
  )
  const total =
    rolls.reduce((sum, roll) => sum + roll, 0) + parsed.value.modifier

  return ok({
    expression: expression.trim(),
    ...parsed.value,
    rolls,
    total
  })
}
