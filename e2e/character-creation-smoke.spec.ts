import { expect, test } from '@playwright/test'
import { openUniqueRoom } from './support/app'

test.describe('character creation smoke', () => {
  test('opens the creator and rolls the first characteristic through shared dice', async ({
    page
  }) => {
    await openUniqueRoom(page)

    await page.locator('#createCharacterRailButton').click()

    await expect(
      page.getByRole('complementary', { name: 'Character creator' })
    ).toBeVisible()
    await expect(page.locator('#characterCreatorTitle')).toBeVisible()
    await expect(page.locator('#creatorBody')).toBeVisible()

    await page.getByRole('button', { name: 'Roll Str' }).click()

    await expect(page.locator('#diceOverlay.visible')).toBeVisible()
    await expect(
      page.locator('#characterCreationFields .creation-stat-cell').filter({
        hasText: 'Str'
      }).locator('strong')
    ).toHaveCount(0)
    await expect(page.locator('#diceStage .roll-total')).not.toHaveText(
      'Rolling...',
      { timeout: 5_000 }
    )
    await expect(
      page.locator('#characterCreationFields .creation-stat-cell').filter({
        hasText: 'Str'
      }).locator('strong')
    ).toHaveText(/\d+/, { timeout: 5_000 })
  })
})
