export interface AppElementsDocument {
  getElementById(elementId: string): HTMLElement | null
  querySelectorAll<T extends Element = Element>(selectors: string): ArrayLike<T>
}

export interface AppElements {
  status: HTMLElement | null
  roomForm: HTMLFormElement | null
  roomInput: HTMLInputElement | null
  userInput: HTMLInputElement | null
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
  pwaInstallPrompt: HTMLElement | null
  pwaInstallButton: HTMLButtonElement | null
  pwaInstallDismissButton: HTMLButtonElement | null
  initiativeRail: HTMLElement | null
  sheet: HTMLElement | null
  sheetButton: HTMLButtonElement | null
  sheetClose: HTMLButtonElement | null
  sheetName: HTMLElement | null
  sheetBody: HTMLElement | null
  sheetTabs: HTMLElement[]
  menu: HTMLButtonElement | null
  roomDialog: HTMLDialogElement | null
  roomCancel: HTMLButtonElement | null
}

const getElement = <T extends HTMLElement>(
  document: AppElementsDocument,
  id: string
): T | null => document.getElementById(id) as T | null

export const getAppElements = (document: AppElementsDocument): AppElements => ({
  status: getElement(document, 'connectionStatus'),
  roomForm: getElement(document, 'roomForm'),
  roomInput: getElement(document, 'roomInput'),
  userInput: getElement(document, 'userInput'),
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
  pwaInstallPrompt: getElement(document, 'pwaInstallPrompt'),
  pwaInstallButton: getElement(document, 'pwaInstallButton'),
  pwaInstallDismissButton: getElement(document, 'pwaInstallDismissButton'),
  initiativeRail: getElement(document, 'initiativeRail'),
  sheet: getElement(document, 'characterSheet'),
  sheetButton: getElement(document, 'sheetButton'),
  sheetClose: getElement(document, 'sheetCloseButton'),
  sheetName: getElement(document, 'sheetName'),
  sheetBody: getElement(document, 'sheetBody'),
  sheetTabs: Array.from(
    document.querySelectorAll<HTMLElement>('[data-sheet-tab]')
  ),
  menu: getElement(document, 'menuButton'),
  roomDialog: getElement(document, 'roomDialog'),
  roomCancel: getElement(document, 'roomCancelButton')
})
