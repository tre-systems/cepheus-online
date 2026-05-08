import { expect, type Page } from '@playwright/test'

export const uniqueRoomId = (prefix = 'e2e-room'): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export const openUniqueRoom = async (
  page: Page,
  roomId = uniqueRoomId()
): Promise<string> => {
  await openRoom(page, {
    roomId,
    userId: 'e2e-referee',
    viewer: 'referee'
  })

  return roomId
}

export const openRoom = async (
  page: Page,
  {
    roomId,
    userId,
    viewer = 'player'
  }: {
    roomId: string
    userId: string
    viewer?: 'player' | 'spectator' | 'referee'
  }
): Promise<void> => {
  await page.goto(`/?game=${roomId}&user=${userId}&viewer=${viewer}`, {
    waitUntil: 'domcontentloaded'
  })

  await expect(page.locator('#boardCanvas')).toBeVisible()
  await expect(page.locator('#connectionStatus')).toBeVisible()
}
