export interface AppElementsDocument {
  getElementById(elementId: string): HTMLElement | null
  querySelectorAll<T extends Element = Element>(selectors: string): ArrayLike<T>
}

export interface AppElements {
  status: HTMLElement | null
  roomForm: HTMLFormElement | null
  roomInput: HTMLInputElement | null
  userInput: HTMLInputElement | null
  betaRoomNameInput: HTMLInputElement | null
  betaCreateRoom: HTMLButtonElement | null
  betaInviteRole: HTMLSelectElement | null
  betaCreateInvite: HTMLButtonElement | null
  betaInviteLink: HTMLInputElement | null
  betaInviteToken: HTMLInputElement | null
  betaAcceptInvite: HTMLButtonElement | null
  betaRoomStatus: HTMLElement | null
  bootstrap: HTMLButtonElement | null
  refresh: HTMLButtonElement | null
  createCharacterRail: HTMLButtonElement | null
  characterCreator: HTMLElement | null
  creatorBody: HTMLElement | null
  creatorActions: HTMLElement | null
  characterCreatorClose: HTMLButtonElement | null
  characterCreatorTitle: HTMLElement | null
  creatorStartSection: HTMLElement | null
  creatorQuickSection: HTMLElement | null
  startCharacterWizard: HTMLButtonElement | null
  backCharacterWizard: HTMLButtonElement | null
  nextCharacterWizard: HTMLButtonElement | null
  characterCreationWizard: HTMLElement | null
  characterCreationSteps: HTMLElement | null
  characterCreationStatus: HTMLElement | null
  characterCreationFields: HTMLElement | null
  createPiece: HTMLButtonElement | null
  createBoard: HTMLButtonElement | null
  pieceNameInput: HTMLInputElement | null
  pieceImageInput: HTMLInputElement | null
  pieceImageFileInput: HTMLInputElement | null
  pieceCropInput: HTMLInputElement | null
  pieceCropXInput: HTMLInputElement | null
  pieceCropYInput: HTMLInputElement | null
  pieceCropWidthInput: HTMLInputElement | null
  pieceCropHeightInput: HTMLInputElement | null
  pieceWidthInput: HTMLInputElement | null
  pieceHeightInput: HTMLInputElement | null
  pieceScaleInput: HTMLInputElement | null
  pieceSheetInput: HTMLInputElement | null
  pieceCharacterSelect: HTMLSelectElement | null
  localAssetMetadataInput: HTMLTextAreaElement | null
  loadLocalAssets: HTMLButtonElement | null
  boardAssetSelect: HTMLSelectElement | null
  boardLosSidecarInput: HTMLTextAreaElement | null
  useBoardAsset: HTMLButtonElement | null
  counterAssetSelect: HTMLSelectElement | null
  useCounterAsset: HTMLButtonElement | null
  localAssetStatus: HTMLElement | null
  boardNameInput: HTMLInputElement | null
  boardImageInput: HTMLInputElement | null
  boardImageFileInput: HTMLInputElement | null
  boardWidthInput: HTMLInputElement | null
  boardHeightInput: HTMLInputElement | null
  boardScaleInput: HTMLInputElement | null
  roll: HTMLButtonElement | null
  diceExpression: HTMLInputElement | null
  error: HTMLElement | null
  boardStatus: HTMLElement | null
  boardSelect: HTMLSelectElement | null
  zoomOut: HTMLButtonElement | null
  zoomReset: HTMLButtonElement | null
  zoomIn: HTMLButtonElement | null
  canvas: HTMLCanvasElement | null
  diceStage: HTMLElement | null
  diceOverlay: HTMLElement | null
  creationActivityFeed: HTMLElement | null
  creationPresenceDock: HTMLElement | null
  pwaInstallPrompt: HTMLElement | null
  pwaInstallButton: HTMLButtonElement | null
  pwaInstallDismissButton: HTMLButtonElement | null
  pwaUpdatePrompt: HTMLElement | null
  pwaUpdateButton: HTMLButtonElement | null
  pwaUpdateDismissButton: HTMLButtonElement | null
  initiativeRail: HTMLElement | null
  sheet: HTMLElement | null
  sheetButton: HTMLButtonElement | null
  sheetClose: HTMLButtonElement | null
  sheetName: HTMLElement | null
  sheetBody: HTMLElement | null
  sheetTabs: HTMLElement[]
  notesButton: HTMLButtonElement | null
  notesPanel: HTMLElement | null
  notesClose: HTMLButtonElement | null
  notesList: HTMLElement | null
  noteTitleInput: HTMLInputElement | null
  noteBodyInput: HTMLTextAreaElement | null
  noteVisibilitySelect: HTMLSelectElement | null
  noteNew: HTMLButtonElement | null
  noteSave: HTMLButtonElement | null
  noteDelete: HTMLButtonElement | null
  notesStatus: HTMLElement | null
  menu: HTMLButtonElement | null
  roomDialog: HTMLDialogElement | null
  roomCancel: HTMLButtonElement | null
}

export type RequiredAppElements = Omit<
  { [K in keyof AppElements]: NonNullable<AppElements[K]> },
  'creatorQuickSection'
> &
  Pick<AppElements, 'creatorQuickSection'>

const getElement = <T extends HTMLElement>(
  document: AppElementsDocument,
  id: string
): T | null => document.getElementById(id) as T | null

export const getAppElements = (document: AppElementsDocument): AppElements => ({
  status: getElement(document, 'connectionStatus'),
  roomForm: getElement(document, 'roomForm'),
  roomInput: getElement(document, 'roomInput'),
  userInput: getElement(document, 'userInput'),
  betaRoomNameInput: getElement(document, 'betaRoomNameInput'),
  betaCreateRoom: getElement(document, 'betaCreateRoomButton'),
  betaInviteRole: getElement(document, 'betaInviteRoleSelect'),
  betaCreateInvite: getElement(document, 'betaCreateInviteButton'),
  betaInviteLink: getElement(document, 'betaInviteLinkInput'),
  betaInviteToken: getElement(document, 'betaInviteTokenInput'),
  betaAcceptInvite: getElement(document, 'betaAcceptInviteButton'),
  betaRoomStatus: getElement(document, 'betaRoomStatus'),
  bootstrap: getElement(document, 'bootstrapButton'),
  refresh: getElement(document, 'refreshButton'),
  createCharacterRail: getElement(document, 'createCharacterRailButton'),
  characterCreator: getElement(document, 'characterCreator'),
  creatorBody: getElement(document, 'creatorBody'),
  creatorActions: getElement(document, 'creatorActions'),
  characterCreatorClose: getElement(document, 'characterCreatorCloseButton'),
  characterCreatorTitle: getElement(document, 'characterCreatorTitle'),
  creatorStartSection: getElement(document, 'creatorStartSection'),
  creatorQuickSection: getElement(document, 'creatorQuickSection'),
  startCharacterWizard: getElement(document, 'startCharacterWizardButton'),
  backCharacterWizard: getElement(document, 'backCharacterWizardButton'),
  nextCharacterWizard: getElement(document, 'nextCharacterWizardButton'),
  characterCreationWizard: getElement(document, 'characterCreationWizard'),
  characterCreationSteps: getElement(document, 'characterCreationSteps'),
  characterCreationStatus: getElement(document, 'characterCreationStatus'),
  characterCreationFields: getElement(document, 'characterCreationFields'),
  createPiece: getElement(document, 'createPieceButton'),
  createBoard: getElement(document, 'createBoardButton'),
  pieceNameInput: getElement(document, 'pieceNameInput'),
  pieceImageInput: getElement(document, 'pieceImageInput'),
  pieceImageFileInput: getElement(document, 'pieceImageFileInput'),
  pieceCropInput: getElement(document, 'pieceCropInput'),
  pieceCropXInput: getElement(document, 'pieceCropXInput'),
  pieceCropYInput: getElement(document, 'pieceCropYInput'),
  pieceCropWidthInput: getElement(document, 'pieceCropWidthInput'),
  pieceCropHeightInput: getElement(document, 'pieceCropHeightInput'),
  pieceWidthInput: getElement(document, 'pieceWidthInput'),
  pieceHeightInput: getElement(document, 'pieceHeightInput'),
  pieceScaleInput: getElement(document, 'pieceScaleInput'),
  pieceSheetInput: getElement(document, 'pieceSheetInput'),
  pieceCharacterSelect: getElement(document, 'pieceCharacterSelect'),
  localAssetMetadataInput: getElement(document, 'localAssetMetadataInput'),
  loadLocalAssets: getElement(document, 'loadLocalAssetsButton'),
  boardAssetSelect: getElement(document, 'boardAssetSelect'),
  boardLosSidecarInput: getElement(document, 'boardLosSidecarInput'),
  useBoardAsset: getElement(document, 'useBoardAssetButton'),
  counterAssetSelect: getElement(document, 'counterAssetSelect'),
  useCounterAsset: getElement(document, 'useCounterAssetButton'),
  localAssetStatus: getElement(document, 'localAssetStatus'),
  boardNameInput: getElement(document, 'boardNameInput'),
  boardImageInput: getElement(document, 'boardImageInput'),
  boardImageFileInput: getElement(document, 'boardImageFileInput'),
  boardWidthInput: getElement(document, 'boardWidthInput'),
  boardHeightInput: getElement(document, 'boardHeightInput'),
  boardScaleInput: getElement(document, 'boardScaleInput'),
  roll: getElement(document, 'rollButton'),
  diceExpression: getElement(document, 'diceExpression'),
  error: getElement(document, 'errorText'),
  boardStatus: getElement(document, 'boardStatus'),
  boardSelect: getElement(document, 'boardSelect'),
  zoomOut: getElement(document, 'zoomOutButton'),
  zoomReset: getElement(document, 'zoomResetButton'),
  zoomIn: getElement(document, 'zoomInButton'),
  canvas: getElement(document, 'boardCanvas'),
  diceStage: getElement(document, 'diceStage'),
  diceOverlay: getElement(document, 'diceOverlay'),
  creationActivityFeed: getElement(document, 'creationActivityFeed'),
  creationPresenceDock: getElement(document, 'creationPresenceDock'),
  pwaInstallPrompt: getElement(document, 'pwaInstallPrompt'),
  pwaInstallButton: getElement(document, 'pwaInstallButton'),
  pwaInstallDismissButton: getElement(document, 'pwaInstallDismissButton'),
  pwaUpdatePrompt: getElement(document, 'pwaUpdatePrompt'),
  pwaUpdateButton: getElement(document, 'pwaUpdateButton'),
  pwaUpdateDismissButton: getElement(document, 'pwaUpdateDismissButton'),
  initiativeRail: getElement(document, 'initiativeRail'),
  sheet: getElement(document, 'characterSheet'),
  sheetButton: getElement(document, 'sheetButton'),
  sheetClose: getElement(document, 'sheetCloseButton'),
  sheetName: getElement(document, 'sheetName'),
  sheetBody: getElement(document, 'sheetBody'),
  sheetTabs: Array.from(
    document.querySelectorAll<HTMLElement>('[data-sheet-tab]')
  ),
  notesButton: getElement(document, 'notesButton'),
  notesPanel: getElement(document, 'notesPanel'),
  notesClose: getElement(document, 'notesCloseButton'),
  notesList: getElement(document, 'notesList'),
  noteTitleInput: getElement(document, 'noteTitleInput'),
  noteBodyInput: getElement(document, 'noteBodyInput'),
  noteVisibilitySelect: getElement(document, 'noteVisibilitySelect'),
  noteNew: getElement(document, 'noteNewButton'),
  noteSave: getElement(document, 'noteSaveButton'),
  noteDelete: getElement(document, 'noteDeleteButton'),
  notesStatus: getElement(document, 'notesStatus'),
  menu: getElement(document, 'menuButton'),
  roomDialog: getElement(document, 'roomDialog'),
  roomCancel: getElement(document, 'roomCancelButton')
})

const optionalAppElementKeys = new Set<keyof AppElements>([
  'creatorQuickSection'
])

export const requireAppElements = (
  elements: AppElements
): RequiredAppElements => {
  for (const key of Object.keys(elements) as (keyof AppElements)[]) {
    if (optionalAppElementKeys.has(key)) continue
    if (elements[key] === null) {
      throw new Error(`Missing required app element: ${key}`)
    }
  }

  return elements as RequiredAppElements
}
