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
        url?: string | null
        width: number
        height: number
        scale: number
        doors: Record<string, { id: string; open: boolean }>
        losSidecar?: {
          assetRef: string
          occluders: { type: string; id: string }[]
        } | null
      }
    >
    pieces: Record<
      string,
      {
        id: string
        boardId: string
        name: string
        characterId?: string | null
        imageAssetId?: string | null
        x: number
        y: number
        visibility: string
        freedom: string
      }
    >
    characters: Record<string, { id: string; name: string; type: string }>
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

const tinyPngFile = (name: string) => ({
  name,
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
    'base64'
  )
})

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
        ],
        losSidecars: [
          {
            assetRef: 'Geomorphs/standard/deck-01.jpg',
            width: 1000,
            height: 1000,
            gridScale: 50,
            occluders: [
              {
                type: 'door',
                id: 'iris-1',
                x1: 400,
                y1: 300,
                x2: 480,
                y2: 300,
                open: false
              }
            ]
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

    await page.locator('#createBoardButton').click()
    await expect(page.locator('#roomDialog')).toBeHidden()

    const state = await fetchTacticalState(page, roomId, refereeId)
    const boardId = state.state?.selectedBoardId
    expect(boardId).not.toBeNull()
    expect(state.state?.boards[boardId ?? '']?.losSidecar).toMatchObject({
      assetRef: 'Geomorphs/standard/deck-01.jpg',
      occluders: [{ type: 'door', id: 'iris-1' }]
    })
  })

  test('creates a local geomorph board with a renderable file url and LOS sidecar', async ({
    page
  }) => {
    const roomId = uniqueRoomId('asset-file-los')
    const refereeId = 'asset-file-referee'
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
            relativePath: 'standard/file-deck.jpg',
            kind: 'geomorph',
            width: 1,
            height: 1,
            gridScale: 1
          }
        ],
        losSidecars: [
          {
            assetRef: 'Geomorphs/standard/file-deck.jpg',
            width: 1,
            height: 1,
            gridScale: 1,
            occluders: [
              {
                type: 'door',
                id: 'iris-1',
                x1: 0,
                y1: 0,
                x2: 1,
                y2: 0,
                open: false
              }
            ]
          }
        ]
      })
    )
    await page.locator('#loadLocalAssetsButton').click()
    await page
      .locator('#boardAssetSelect')
      .selectOption('Geomorphs/standard/file-deck.jpg')
    await page.locator('#useBoardAssetButton').click()
    await page
      .locator('#boardImageFileInput')
      .setInputFiles(tinyPngFile('file-deck.png'))
    await expect(page.locator('#boardImageInput')).toHaveValue(
      /^data:image\/png;base64,/
    )

    await page.locator('#createBoardButton').click()
    await expect(page.locator('#roomDialog')).toBeHidden()

    const state = await fetchTacticalState(page, roomId, refereeId)
    const boardId = state.state?.selectedBoardId
    const board = state.state?.boards[boardId ?? '']
    expect(board).toMatchObject({
      imageAssetId: 'Geomorphs/standard/file-deck.jpg',
      width: 1,
      height: 1
    })
    expect(board?.url).toContain('data:image/png;base64,')
    expect(board?.losSidecar).toMatchObject({
      assetRef: 'Geomorphs/standard/file-deck.jpg',
      occluders: [{ type: 'door', id: 'iris-1' }]
    })
  })

  test('creates boards and pieces from selected local image files without committed assets', async ({
    page
  }) => {
    const roomId = uniqueRoomId('file-assets')
    const refereeId = 'file-referee'
    await openRoom(page, {
      roomId,
      userId: refereeId,
      viewer: 'referee'
    })

    await page.locator('#menuButton').click()
    await expect(page.locator('#roomDialog')).toBeVisible()

    await page.locator('#boardNameInput').fill('File Deck')
    await page
      .locator('#boardImageFileInput')
      .setInputFiles(tinyPngFile('file-deck.png'))
    await expect(page.locator('#boardImageInput')).toHaveValue(
      /^data:image\/png;base64,/
    )
    await expect(page.locator('#boardWidthInput')).toHaveValue('1')
    await expect(page.locator('#boardHeightInput')).toHaveValue('1')
    await page.locator('#createBoardButton').click()
    await expect(page.locator('#roomDialog')).toBeHidden()

    let state = await fetchTacticalState(page, roomId, refereeId)
    const boardId = state.state?.selectedBoardId
    expect(boardId).not.toBeNull()
    const board = state.state?.boards[boardId ?? '']
    expect(board).toMatchObject({
      name: 'File Deck',
      imageAssetId: null,
      width: 1,
      height: 1
    })
    expect(board?.url).toContain('data:image/png;base64,')

    await page.locator('#menuButton').click()
    await expect(page.locator('#roomDialog')).toBeVisible()
    await page.locator('#pieceNameInput').fill('File Counter')
    await page
      .locator('#pieceImageFileInput')
      .setInputFiles(tinyPngFile('file-counter.png'))
    await expect(page.locator('#pieceImageInput')).toHaveValue(
      /^data:image\/png;base64,/
    )
    await expect(page.locator('#pieceWidthInput')).toHaveValue('50')
    await expect(page.locator('#pieceHeightInput')).toHaveValue('50')
    await page.locator('#createPieceButton').click()
    await expect(page.locator('#roomDialog')).toBeHidden()

    state = await fetchTacticalState(page, roomId, refereeId)
    const piece = Object.values(state.state?.pieces ?? {}).find(
      (candidate) => candidate.name === 'File Counter'
    )
    expect(piece?.imageAssetId).toContain('data:image/png;base64,')
  })

  test('links a new tactical piece to an existing character from the room dialog', async ({
    page
  }) => {
    const roomId = uniqueRoomId('linked-piece')
    const refereeId = 'linked-referee'
    await openRoom(page, {
      roomId,
      userId: refereeId,
      viewer: 'referee'
    })
    const refereeSession = await actorSessionFromPage(page, roomId, refereeId)

    await postCommand(page, roomId, refereeId, refereeSession, {
      type: 'CreateGame',
      slug: roomId,
      name: 'Linked Piece Smoke'
    })
    await postSequencedCommand(page, roomId, refereeId, refereeSession, {
      type: 'CreateBoard',
      boardId: 'ship-deck',
      name: 'Ship Deck',
      imageAssetId: null,
      url: null,
      width: 1000,
      height: 1000,
      scale: 50,
      losSidecar: null
    })
    await postSequencedCommand(page, roomId, refereeId, refereeSession, {
      type: 'CreateCharacter',
      characterId: 'mae-1',
      characterType: 'PLAYER',
      name: 'Mae'
    })

    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.locator('#menuButton').click()
    await expect(page.locator('#roomDialog')).toBeVisible()
    await page.locator('#pieceSheetInput').check()
    await page.locator('#pieceCharacterSelect').focus()
    await expect(
      page.locator('#pieceCharacterSelect option[value="mae-1"]')
    ).toHaveText('Mae (player)')

    await page.locator('#pieceCharacterSelect').selectOption('mae-1')
    await expect(page.locator('#pieceNameInput')).toHaveValue('Mae')
    await expect(page.locator('#pieceSheetInput')).not.toBeChecked()
    await page.locator('#createPieceButton').click()
    await expect(page.locator('#roomDialog')).toBeHidden()

    const state = await fetchTacticalState(page, roomId, refereeId)
    const pieces = Object.values(state.state?.pieces ?? {})
    expect(Object.keys(state.state?.characters ?? {})).toHaveLength(1)
    expect(pieces).toHaveLength(1)
    expect(pieces[0]).toMatchObject({
      name: 'Mae',
      characterId: 'mae-1'
    })
  })

  test('creates a tactical piece with a generated NPC sheet from the room dialog', async ({
    page
  }) => {
    const roomId = uniqueRoomId('piece-sheet')
    const refereeId = 'sheet-referee'
    await openRoom(page, {
      roomId,
      userId: refereeId,
      viewer: 'referee'
    })
    const refereeSession = await actorSessionFromPage(page, roomId, refereeId)

    await postCommand(page, roomId, refereeId, refereeSession, {
      type: 'CreateGame',
      slug: roomId,
      name: 'Piece Sheet Smoke'
    })
    await postSequencedCommand(page, roomId, refereeId, refereeSession, {
      type: 'CreateBoard',
      boardId: 'cargo-bay',
      name: 'Cargo Bay',
      imageAssetId: null,
      url: null,
      width: 1000,
      height: 1000,
      scale: 50,
      losSidecar: null
    })

    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.locator('#menuButton').click()
    await expect(page.locator('#roomDialog')).toBeVisible()
    await page.locator('#pieceNameInput').fill('Security Guard')
    await page.locator('#pieceSheetInput').check()
    await page.locator('#createPieceButton').click()
    await expect(page.locator('#roomDialog')).toBeHidden()

    const state = await fetchTacticalState(page, roomId, refereeId)
    const characters = Object.values(state.state?.characters ?? {})
    const pieces = Object.values(state.state?.pieces ?? {})
    expect(characters).toHaveLength(1)
    expect(pieces).toHaveLength(1)
    expect(characters[0]).toMatchObject({
      name: 'Security Guard',
      type: 'NPC'
    })
    expect(pieces[0]).toMatchObject({
      name: 'Security Guard',
      characterId: characters[0]?.id
    })
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
      scale: 50,
      losSidecar: {
        assetRef: 'Geomorphs/standard/deck-01.jpg',
        width: 1000,
        height: 1000,
        gridScale: 50,
        occluders: [
          {
            type: 'door',
            id: 'iris-1',
            x1: 400,
            y1: 300,
            x2: 480,
            y2: 300,
            open: false
          }
        ]
      }
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
