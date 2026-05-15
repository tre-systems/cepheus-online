import { expect, test, type Page } from '@playwright/test'
import { openRoom, uniqueRoomId } from './support/app'
import {
  actorSessionFromPage,
  postCommand
} from './support/character-creation'

type TacticalRoomStateMessage = {
  type: 'roomState'
  state: {
    eventSeq: number
    selectedBoardId: string | null
    boards: Record<
      string,
      {
        id: string
        name: string
        imageAssetId?: string | null
        width: number
        height: number
        scale: number
        doors: Record<string, { id: string; open: boolean }>
      }
    >
    pieces: Record<
      string,
      {
        id: string
        boardId: string
        name: string
        imageAssetId?: string | null
        x: number
        y: number
        visibility: string
        freedom: string
      }
    >
  } | null
}

const fetchTacticalState = async (
  page: Page,
  roomId: string,
  userId: string,
  viewer: 'referee' | 'player' | 'spectator' = 'referee'
): Promise<TacticalRoomStateMessage> => {
  const response = await page.request.get(
    `/rooms/${encodeURIComponent(roomId)}/state?viewer=${viewer}&user=${encodeURIComponent(userId)}`
  )
  expect(response.ok()).toBe(true)
  return (await response.json()) as TacticalRoomStateMessage
}

const currentEventSeq = async (
  page: Page,
  roomId: string,
  actorId: string
): Promise<number> => {
  const message = await fetchTacticalState(page, roomId, actorId)
  expect(message.state).not.toBeNull()
  return message.state?.eventSeq ?? 0
}

const postSequencedCommand = async (
  page: Page,
  roomId: string,
  actorId: string,
  actorSession: string,
  command: Record<string, unknown>
): Promise<void> => {
  await postCommand(page, roomId, actorId, actorSession, {
    ...command,
    expectedSeq: await currentEventSeq(page, roomId, actorId)
  })
}

test.describe('tactical board smoke', () => {
  test('loads local map metadata into referee board and counter fields', async ({
    page
  }) => {
    const roomId = uniqueRoomId('asset-picker')
    const refereeId = 'asset-referee'
    await openRoom(page, {
      roomId,
      userId: refereeId,
      viewer: 'referee'
    })

    await page.locator('#menuButton').click()
    await expect(page.locator('#roomDialog')).toBeVisible()

    await page.locator('#localAssetMetadataInput').fill(
      JSON.stringify({
        assets: [
          {
            root: 'Geomorphs',
            relativePath: 'standard/deck-01.jpg',
            kind: 'geomorph',
            width: 1000,
            height: 1000,
            gridScale: 50
          },
          {
            root: 'Counters',
            relativePath: 'crew/free-trader.svg',
            kind: 'counter',
            width: 600,
            height: 600,
            gridScale: 50
          }
        ]
      })
    )
    await page.locator('#loadLocalAssetsButton').click()
    await expect(page.locator('#localAssetStatus')).toHaveText(
      '1 board asset(s), 1 counter asset(s)'
    )

    await page
      .locator('#boardAssetSelect')
      .selectOption('Geomorphs/standard/deck-01.jpg')
    await page.locator('#useBoardAssetButton').click()
    await expect(page.locator('#boardNameInput')).toHaveValue('deck 01')
    await expect(page.locator('#boardImageInput')).toHaveValue(
      'Geomorphs/standard/deck-01.jpg'
    )
    await expect(page.locator('#boardWidthInput')).toHaveValue('1000')
    await expect(page.locator('#boardHeightInput')).toHaveValue('1000')
    await expect(page.locator('#boardScaleInput')).toHaveValue('50')

    await page
      .locator('#counterAssetSelect')
      .selectOption('Counters/crew/free-trader.svg')
    await page.locator('#useCounterAssetButton').click()
    await expect(page.locator('#pieceNameInput')).toHaveValue('free trader')
    await expect(page.locator('#pieceImageInput')).toHaveValue(
      'Counters/crew/free-trader.svg'
    )
    await expect(page.locator('#pieceWidthInput')).toHaveValue('600')
    await expect(page.locator('#pieceHeightInput')).toHaveValue('600')
  })

  test('creates a board, moves pieces, toggles doors, and filters hidden pieces', async ({
    page,
    context
  }) => {
    const roomId = uniqueRoomId('tactical-board')
    const refereeId = 'tactical-referee'
    await openRoom(page, {
      roomId,
      userId: refereeId,
      viewer: 'referee'
    })

    const refereeSession = await actorSessionFromPage(page, roomId, refereeId)

    await postCommand(page, roomId, refereeId, refereeSession, {
      type: 'CreateGame',
      slug: roomId,
      name: 'Tactical Board Smoke'
    })
    await postSequencedCommand(page, roomId, refereeId, refereeSession, {
      type: 'CreateBoard',
      boardId: 'ship-deck',
      name: 'Ship Deck',
      imageAssetId: 'Geomorphs/standard/deck-01.jpg',
      url: null,
      width: 1000,
      height: 1000,
      scale: 50
    })
    await postSequencedCommand(page, roomId, refereeId, refereeSession, {
      type: 'SetDoorOpen',
      boardId: 'ship-deck',
      doorId: 'iris-1',
      open: false
    })
    await postSequencedCommand(page, roomId, refereeId, refereeSession, {
      type: 'CreatePiece',
      pieceId: 'marine-1',
      boardId: 'ship-deck',
      characterId: null,
      name: 'Marine',
      imageAssetId: null,
      x: 100,
      y: 120,
      width: 50,
      height: 50,
      scale: 1
    })
    await postSequencedCommand(page, roomId, refereeId, refereeSession, {
      type: 'CreatePiece',
      pieceId: 'pirate-1',
      boardId: 'ship-deck',
      characterId: null,
      name: 'Pirate',
      imageAssetId: 'Counters/enemies/pirate.png',
      x: 500,
      y: 520,
      width: 50,
      height: 50,
      scale: 1
    })
    await postSequencedCommand(page, roomId, refereeId, refereeSession, {
      type: 'SetPieceVisibility',
      pieceId: 'marine-1',
      visibility: 'VISIBLE'
    })
    await postSequencedCommand(page, roomId, refereeId, refereeSession, {
      type: 'SetPieceFreedom',
      pieceId: 'marine-1',
      freedom: 'UNLOCKED'
    })
    await postSequencedCommand(page, roomId, refereeId, refereeSession, {
      type: 'SetPieceVisibility',
      pieceId: 'pirate-1',
      visibility: 'HIDDEN'
    })
    await postSequencedCommand(page, roomId, refereeId, refereeSession, {
      type: 'MovePiece',
      pieceId: 'marine-1',
      x: 180,
      y: 220
    })
    await postSequencedCommand(page, roomId, refereeId, refereeSession, {
      type: 'SetDoorOpen',
      boardId: 'ship-deck',
      doorId: 'iris-1',
      open: true
    })

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('#boardCanvas')).toBeVisible()
    await expect(page.locator('#boardStatus')).toContainText('Ship Deck')

    const refereeState = await fetchTacticalState(page, roomId, refereeId)
    expect(refereeState.state?.selectedBoardId).toBe('ship-deck')
    expect(refereeState.state?.boards['ship-deck']).toMatchObject({
      name: 'Ship Deck',
      imageAssetId: 'Geomorphs/standard/deck-01.jpg',
      width: 1000,
      height: 1000,
      scale: 50,
      doors: {
        'iris-1': { id: 'iris-1', open: true }
      }
    })
    expect(refereeState.state?.pieces['marine-1']).toMatchObject({
      name: 'Marine',
      x: 180,
      y: 220,
      visibility: 'VISIBLE',
      freedom: 'UNLOCKED'
    })
    expect(refereeState.state?.pieces['pirate-1']).toMatchObject({
      name: 'Pirate',
      visibility: 'HIDDEN'
    })

    const spectator = await context.newPage()
    await openRoom(spectator, {
      roomId,
      userId: 'tactical-spectator',
      viewer: 'spectator'
    })
    await expect(spectator.locator('#boardStatus')).toContainText('Ship Deck')
    const spectatorState = await fetchTacticalState(
      spectator,
      roomId,
      'tactical-spectator',
      'spectator'
    )
    expect(spectatorState.state?.pieces['marine-1']).toMatchObject({
      name: 'Marine',
      visibility: 'VISIBLE'
    })
    expect(spectatorState.state?.pieces['pirate-1']).toBeUndefined()

    await spectator.reload({ waitUntil: 'domcontentloaded' })
    await expect(spectator.locator('#boardCanvas')).toBeVisible()
    await expect(spectator.locator('#boardStatus')).toContainText('Ship Deck')
  })
})
