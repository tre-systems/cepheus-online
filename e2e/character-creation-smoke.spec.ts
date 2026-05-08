import { expect, test } from '@playwright/test'
import { openRoom, openUniqueRoom } from './support/app'

test.describe('character creation smoke', () => {
  test('opens the creator and rolls the first characteristic through shared dice', async ({
    page
  }) => {
    const roomId = await openUniqueRoom(page)
    const characteristicRollCommands: unknown[] = []

    page.on('request', (request) => {
      if (
        request.method() !== 'POST' ||
        !request.url().includes(`/rooms/${roomId}/command`)
      ) {
        return
      }

      const body = request.postData()
      if (!body) return
      const message = JSON.parse(body) as {
        command?: { type?: string; characteristic?: string }
      }
      if (message.command?.type === 'RollCharacterCreationCharacteristic') {
        characteristicRollCommands.push(message.command)
      }
    })

    await page.locator('#createCharacterRailButton').click()

    await expect(
      page.getByRole('complementary', { name: 'Character creator' })
    ).toBeVisible()
    await expect(page.locator('#characterCreatorTitle')).toBeVisible()
    await expect(page.locator('#creatorBody')).toBeVisible()
    const characterName =
      (await page.locator('#characterCreatorTitle').textContent()) ?? ''

    const strValue = page
      .locator('#characterCreationFields .creation-stat-cell')
      .filter({
        hasText: 'Str'
      })
      .locator('strong')
    const characteristicRollButtons = page
      .locator('#characterCreationFields')
      .getByRole('button', { name: /^Roll (Str|Dex|End|Int|Edu|Soc)$/ })

    await expect(characteristicRollButtons).toHaveCount(6)
    await expect(page.getByRole('button', { name: 'Roll Str' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Roll Dex' })).toBeVisible()

    await page.getByRole('button', { name: 'Roll Str' }).click()

    await expect(page.locator('#diceOverlay.visible')).toBeVisible()
    await expect(strValue).toHaveCount(0)
    await expect(page.locator('#diceStage .roll-total')).not.toHaveText(
      'Rolling...',
      { timeout: 5_000 }
    )
    await expect(strValue).toHaveText(/\d+/, { timeout: 5_000 })
    const rolledStr = (await strValue.textContent()) ?? ''
    expect(rolledStr).toMatch(/\d+/)
    expect(characteristicRollCommands).toHaveLength(1)
    const rollDexButton = page.getByRole('button', { name: 'Roll Dex' })
    await expect(characteristicRollButtons).toHaveCount(5)
    await expect(page.getByRole('button', { name: 'Roll Str' })).toHaveCount(0)
    await expect(rollDexButton).toBeVisible()

    await rollDexButton.evaluate((button) => {
      button.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      )
      button.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      )
    })
    await expect(page.locator('#diceOverlay.visible')).toBeVisible()
    expect(
      characteristicRollCommands.filter((command) => {
        return (
          typeof command === 'object' &&
          command !== null &&
          'characteristic' in command &&
          command.characteristic === 'dex'
        )
      })
    ).toHaveLength(1)

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('#boardCanvas')).toBeVisible()
    await expect(page.locator('#connectionStatus')).toBeVisible()

    await page
      .locator('#creationPresenceDock .creation-presence-card')
      .filter({ hasText: characterName })
      .click()

    await expect(
      page.getByRole('complementary', { name: 'Character creator' })
    ).toBeVisible()
    await expect(strValue).toHaveText(rolledStr, { timeout: 5_000 })
  })

  test('lets another player follow a live characteristic roll without early reveal', async ({
    browser,
    page
  }) => {
    const roomId = await openUniqueRoom(page)
    await page.locator('#createCharacterRailButton').click()

    const characterName =
      (await page.locator('#characterCreatorTitle').textContent()) ?? ''

    const spectator = await browser.newPage()
    try {
      await openRoom(spectator, {
        roomId,
        userId: 'e2e-spectator',
        viewer: 'player'
      })

      const card = spectator
        .locator('#creationPresenceDock .creation-presence-card')
        .filter({ hasText: characterName })
      await expect(card).toBeVisible({ timeout: 5_000 })
      await card.click()

      const ownerStrValue = page
        .locator('#characterCreationFields .creation-stat-cell')
        .filter({ hasText: 'Str' })
        .locator('strong')
      const spectatorStrValue = spectator
        .locator('#characterCreationFields .creation-stat-cell')
        .filter({ hasText: 'Str' })
        .locator('strong')

      await page.getByRole('button', { name: 'Roll Str' }).click()

      await expect(spectator.locator('#diceOverlay.visible')).toBeVisible({
        timeout: 5_000
      })
      await expect(spectatorStrValue).toHaveCount(0)
      await expect(spectator.locator('#diceStage .roll-total')).not.toHaveText(
        'Rolling...',
        { timeout: 5_000 }
      )

      await expect(ownerStrValue).toHaveText(/\d+/, { timeout: 5_000 })
      const rolledStr = (await ownerStrValue.textContent()) ?? ''
      await expect(spectatorStrValue).toHaveText(rolledStr, { timeout: 5_000 })

      await spectator.reload({ waitUntil: 'domcontentloaded' })
      const reloadedCard = spectator
        .locator('#creationPresenceDock .creation-presence-card')
        .filter({ hasText: characterName })
      await expect(reloadedCard).toBeVisible()
      await reloadedCard.click()
      await expect(spectatorStrValue).toHaveText(rolledStr, { timeout: 5_000 })
    } finally {
      await spectator.close()
    }
  })
})
