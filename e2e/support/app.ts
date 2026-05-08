import { expect, type Page } from '@playwright/test'

export const uniqueRoomId = (prefix = 'e2e-room'): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export const openUniqueRoom = async (
  page: Page,
  roomId = uniqueRoomId()
): Promise<string> => {
  await page.goto(`/?game=${roomId}&user=e2e-referee&viewer=referee`, {
    waitUntil: 'domcontentloaded'
  })

  await expect(page.locator('#boardCanvas')).toBeVisible()
  await expect(page.locator('#connectionStatus')).toBeVisible()

  return roomId
}
