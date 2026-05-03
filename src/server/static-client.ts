const CLIENT_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="#020504">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <title>Cepheus Online</title>
    <link rel="manifest" href="/manifest.webmanifest">
    <link rel="icon" href="/icon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="/styles.css">
  </head>
  <body>
    <main class="app-shell">
      <section class="play-surface" aria-label="Tactical board">
        <aside class="combat-rail" aria-label="Characters and table controls">
          <div class="rail-status" aria-label="Table status">
            <span class="status-pip" aria-hidden="true"></span>
            <span id="railStatusText">LIVE</span>
          </div>
          <select id="boardSelect" class="board-select" title="Board" aria-label="Selected board"></select>
          <div id="initiativeRail" class="initiative-rail"></div>
          <div class="rail-tools" aria-label="Table tools">
            <button id="rollButton" class="rail-button" type="button" title="Roll dice" aria-label="Roll dice">2D</button>
            <button id="sheetButton" class="rail-button" type="button" title="Character sheet" aria-label="Character sheet">PC</button>
            <button id="menuButton" class="rail-button" type="button" title="Room menu" aria-label="Room menu">...</button>
          </div>
        </aside>

        <div class="board-frame">
          <canvas id="boardCanvas" width="1200" height="800"></canvas>
          <div class="camera-controls" aria-label="Board camera controls">
            <button id="zoomOutButton" class="camera-button" type="button" title="Zoom out" aria-label="Zoom out">-</button>
            <button id="zoomResetButton" class="camera-button camera-reset" type="button" title="Reset view" aria-label="Reset board view">1x</button>
            <button id="zoomInButton" class="camera-button" type="button" title="Zoom in" aria-label="Zoom in">+</button>
          </div>
          <div class="board-hud">
            <div>
              <h1>Cepheus Online</h1>
              <p id="connectionStatus">Offline</p>
              <p id="boardStatus">No board</p>
            </div>
            <p id="errorText" class="error-text" role="status"></p>
          </div>
        </div>
      </section>

      <div class="dice-overlay" id="diceOverlay" aria-live="polite">
        <div class="dice-stage" id="diceStage">
          <div class="dice-empty">No rolls yet</div>
        </div>
      </div>

      <aside class="character-sheet" id="characterSheet" aria-label="Character sheet">
        <header class="sheet-header">
          <div>
            <p class="sheet-kicker">Selected</p>
            <h2 id="sheetName">No piece</h2>
          </div>
          <button id="sheetCloseButton" type="button" aria-label="Close character sheet">Close</button>
        </header>
        <nav class="sheet-tabs" aria-label="Character sheet sections">
          <button class="sheet-tab active" type="button" data-sheet-tab="details">Details</button>
          <button class="sheet-tab" type="button" data-sheet-tab="action">Action</button>
          <button class="sheet-tab" type="button" data-sheet-tab="items">Items</button>
          <button class="sheet-tab" type="button" data-sheet-tab="notes">Notes</button>
        </nav>
        <div class="sheet-body" id="sheetBody"></div>
      </aside>

      <dialog class="room-dialog" id="roomDialog">
        <form id="roomForm" class="room-form" method="dialog">
          <div class="dialog-title">
            <span class="brand-mark small">CO</span>
            <div>
              <h2>Room</h2>
              <p>Local development controls</p>
            </div>
          </div>
          <label>
            <span>Room</span>
            <input id="roomInput" name="room" autocomplete="off" spellcheck="false">
          </label>
          <label>
            <span>Traveller</span>
            <input id="userInput" name="user" autocomplete="off" spellcheck="false">
          </label>
          <label class="dice-expression">
            <span>Dice</span>
            <input id="diceExpression" value="2d6" autocomplete="off" spellcheck="false">
          </label>
          <div class="piece-create-title">
            <span>New piece</span>
          </div>
          <label class="piece-name-field">
            <span>Name</span>
            <input id="pieceNameInput" name="pieceName" autocomplete="off" spellcheck="false" placeholder="Marine">
          </label>
          <label class="piece-image-field">
            <span>Image URL</span>
            <input id="pieceImageInput" name="pieceImage" type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="Optional">
          </label>
          <label class="piece-image-file-field">
            <span>Image file</span>
            <input id="pieceImageFileInput" name="pieceImageFile" type="file" accept="image/*">
          </label>
          <div class="piece-crop-fields">
            <label class="piece-crop-toggle">
              <input id="pieceCropInput" name="pieceCrop" type="checkbox">
              <span>Crop</span>
            </label>
            <label>
              <span>X</span>
              <input id="pieceCropXInput" name="pieceCropX" inputmode="numeric" autocomplete="off" value="0">
            </label>
            <label>
              <span>Y</span>
              <input id="pieceCropYInput" name="pieceCropY" inputmode="numeric" autocomplete="off" value="0">
            </label>
            <label>
              <span>W</span>
              <input id="pieceCropWidthInput" name="pieceCropWidth" inputmode="numeric" autocomplete="off" value="150">
            </label>
            <label>
              <span>H</span>
              <input id="pieceCropHeightInput" name="pieceCropHeight" inputmode="numeric" autocomplete="off" value="150">
            </label>
          </div>
          <div class="piece-size-fields">
            <label>
              <span>Width</span>
              <input id="pieceWidthInput" name="pieceWidth" inputmode="numeric" autocomplete="off" value="50">
            </label>
            <label>
              <span>Height</span>
              <input id="pieceHeightInput" name="pieceHeight" inputmode="numeric" autocomplete="off" value="50">
            </label>
            <label>
              <span>Scale</span>
              <input id="pieceScaleInput" name="pieceScale" inputmode="decimal" autocomplete="off" value="1">
            </label>
          </div>
          <label class="piece-sheet-field">
            <input id="pieceSheetInput" name="pieceSheet" type="checkbox" checked>
            <span>Create sheet</span>
          </label>
          <div class="board-create-title">
            <span>New board</span>
          </div>
          <label>
            <span>Name</span>
            <input id="boardNameInput" name="boardName" autocomplete="off" spellcheck="false" placeholder="Geomorph deck">
          </label>
          <label>
            <span>Image URL</span>
            <input id="boardImageInput" name="boardImage" inputmode="url" autocomplete="off" spellcheck="false" placeholder="Optional">
          </label>
          <label>
            <span>Image file</span>
            <input id="boardImageFileInput" name="boardImageFile" type="file" accept="image/*">
          </label>
          <label>
            <span>Width</span>
            <input id="boardWidthInput" name="boardWidth" inputmode="numeric" autocomplete="off" value="1200">
          </label>
          <label>
            <span>Height</span>
            <input id="boardHeightInput" name="boardHeight" inputmode="numeric" autocomplete="off" value="800">
          </label>
          <label>
            <span>Grid</span>
            <input id="boardScaleInput" name="boardScale" inputmode="numeric" autocomplete="off" value="50">
          </label>
          <div class="dialog-actions">
            <button id="bootstrapButton" type="button">Bootstrap</button>
            <button id="refreshButton" type="button">Refresh</button>
            <button id="createPieceButton" type="button">Create piece</button>
            <button id="createBoardButton" type="button">Create board</button>
            <button id="roomCancelButton" type="button">Close</button>
            <button type="submit">Open</button>
          </div>
        </form>
      </dialog>
    </main>
    <script type="module" src="/client.js"></script>
  </body>
</html>`

const CLIENT_CSS = `:root {
  color-scheme: dark;
  --bg: #020504;
  --bg-2: #07100d;
  --panel: rgba(4, 13, 10, 0.86);
  --panel-solid: #07120f;
  --panel-2: #0c1915;
  --line: rgba(133, 255, 202, 0.24);
  --line-bright: rgba(173, 255, 221, 0.52);
  --text: #f4fff8;
  --muted: #8bb7a6;
  --accent: #48ffad;
  --accent-soft: rgba(72, 255, 173, 0.18);
  --accent-2: #f7fff9;
  --danger: #ff776b;
  --board: #06100d;
  --shadow: rgba(0, 0, 0, 0.52);
}

* {
  box-sizing: border-box;
}

html,
body {
  min-height: 100%;
  margin: 0;
}

html {
  background: var(--bg);
}

body {
  min-height: 100vh;
  background:
    linear-gradient(rgba(72, 255, 173, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(72, 255, 173, 0.035) 1px, transparent 1px),
    radial-gradient(circle at 50% -18%, rgba(72, 255, 173, 0.18), transparent 46%),
    linear-gradient(180deg, #020504 0%, #050b09 52%, #010302 100%);
  background-size: 22px 22px, 22px 22px, auto, auto;
  color: var(--text);
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
    "Segoe UI", sans-serif;
  overflow-x: hidden;
  overflow: hidden;
  touch-action: none;
}

body::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background:
    repeating-linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.035) 0,
      rgba(255, 255, 255, 0.035) 1px,
      transparent 1px,
      transparent 5px
    );
  mix-blend-mode: screen;
  opacity: 0.2;
}

button,
input {
  font: inherit;
}

button {
  min-height: 46px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background:
    linear-gradient(180deg, rgba(244, 255, 248, 0.09), rgba(72, 255, 173, 0.04)),
    #07120f;
  color: var(--text);
  cursor: pointer;
  padding: 0 14px;
  font-weight: 750;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.12),
    0 10px 26px rgba(0, 0, 0, 0.22);
}

button:hover,
button:focus-visible {
  border-color: var(--accent);
  box-shadow:
    0 0 0 3px rgba(72, 255, 173, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.16);
  outline: none;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

input {
  width: 100%;
  min-height: 46px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: rgba(0, 0, 0, 0.46);
  color: var(--text);
  padding: 0 11px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(72, 255, 173, 0.14);
  outline: none;
}

.app-shell {
  position: relative;
  z-index: 1;
  min-height: 100dvh;
  display: grid;
  grid-template-rows: auto auto 1fr;
}

.topbar {
  display: grid;
  gap: 14px;
  padding: max(14px, env(safe-area-inset-top)) 14px 12px;
  border-bottom: 1px solid var(--line);
  background:
    linear-gradient(180deg, rgba(244, 255, 248, 0.08), transparent),
    rgba(3, 9, 7, 0.9);
  backdrop-filter: blur(18px);
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-mark {
  width: 42px;
  height: 42px;
  border: 1px solid var(--line-bright);
  border-radius: 8px;
  display: grid;
  place-items: center;
  background:
    linear-gradient(135deg, rgba(72, 255, 173, 0.95), rgba(244, 255, 248, 0.78));
  color: #02100a;
  font-weight: 900;
  letter-spacing: 0;
  box-shadow: 0 0 24px rgba(72, 255, 173, 0.26);
}

h1,
p {
  margin: 0;
}

h1 {
  font-size: 18px;
  line-height: 1.05;
  letter-spacing: 0;
}

#connectionStatus,
.room-form span,
.dice-expression span {
  color: var(--muted);
  font-size: 11px;
  font-weight: 760;
  text-transform: uppercase;
}

#connectionStatus {
  margin-top: 4px;
}

.room-form {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  align-items: end;
  gap: 8px;
}

.room-form label,
.dice-expression {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.tool-row {
  position: sticky;
  top: 0;
  z-index: 5;
  display: grid;
  grid-template-columns: 1fr minmax(84px, 112px) 76px 82px;
  align-items: end;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--line);
  background: rgba(5, 13, 10, 0.92);
  backdrop-filter: blur(18px);
}

.dice-expression {
  width: auto;
}

.error-text {
  grid-column: 1 / -1;
  min-height: 18px;
  color: var(--danger);
  font-size: 12px;
}

.play-surface {
  display: grid;
  min-height: 0;
}

.canvas-wrap {
  min-width: 0;
  min-height: 0;
  padding: 12px;
}

#boardCanvas {
  display: block;
  width: 100%;
  height: clamp(360px, 58dvh, 680px);
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--board);
  box-shadow:
    0 22px 60px var(--shadow),
    inset 0 0 0 1px rgba(255, 255, 255, 0.04),
    inset 0 0 80px rgba(72, 255, 173, 0.08);
  touch-action: none;
}

.side-panel {
  display: grid;
  gap: 12px;
  border-top: 1px solid var(--line);
  background:
    linear-gradient(180deg, rgba(244, 255, 248, 0.05), transparent),
    var(--panel);
  padding: 12px 12px calc(14px + env(safe-area-inset-bottom));
  overflow: auto;
}

.dice-stage {
  min-height: 196px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(72, 255, 173, 0.42);
  border-radius: 8px;
  background:
    radial-gradient(ellipse at 50% 34%, rgba(72, 255, 173, 0.2), transparent 52%),
    radial-gradient(ellipse at 50% 78%, rgba(0, 0, 0, 0.6), transparent 68%),
    linear-gradient(180deg, rgba(244, 255, 248, 0.04), transparent 42%),
    rgba(1, 12, 8, 0.94);
  perspective: 900px;
  perspective-origin: 50% 38%;
  overflow: hidden;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    inset 0 0 44px rgba(72, 255, 173, 0.08);
}

.dice-empty {
  color: var(--muted);
  font-size: 14px;
}

.dice-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 32px;
  flex-wrap: wrap;
  padding: 20px 18px 18px;
  transform-style: preserve-3d;
}

.die {
  --die-size: 72px;
  --die-depth: calc(var(--die-size) / 2);
  --die-tilt-x: -22deg;
  --die-tilt-y: -34deg;
  --die-tilt-z: 1deg;
  width: var(--die-size);
  height: var(--die-size);
  position: relative;
  transform-style: preserve-3d;
  transform: rotateX(var(--die-tilt-x)) rotateY(var(--die-tilt-y)) rotateZ(var(--die-tilt-z));
}

.die::after {
  content: "";
  position: absolute;
  inset: 10px;
  transform: translateZ(calc(var(--die-depth) * -1.04));
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.46);
  filter: blur(14px);
  pointer-events: none;
}

.die.rolling {
  animation: tumble 2200ms cubic-bezier(0.16, 0.82, 0.2, 1);
}

.face {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  border: 1px solid rgba(9, 29, 21, 0.72);
  border-radius: 9px;
  background:
    radial-gradient(ellipse at 28% 18%, rgba(255, 255, 255, 0.96) 0%, rgba(255, 255, 255, 0.56) 23%, transparent 42%),
    linear-gradient(145deg, #ffffff 0%, #f3f8f4 56%, #d5e3da 100%);
  color: #020504;
  overflow: hidden;
  font-weight: 900;
  font-size: 24px;
  box-shadow:
    inset 0 -14px 18px rgba(27, 60, 43, 0.15),
    inset 10px 0 18px rgba(255, 255, 255, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.92),
    0 14px 24px rgba(0, 0, 0, 0.22);
  backface-visibility: hidden;
}

.face::before {
  content: "";
  position: absolute;
  inset: 4px;
  border: 1px solid rgba(15, 44, 31, 0.1);
  border-radius: 7px;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.24),
    inset 0 -9px 12px rgba(16, 48, 31, 0.05);
  pointer-events: none;
}

.face::after {
  content: "";
  position: absolute;
  inset: 8px 12px auto 12px;
  height: 20px;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.16) 62%, transparent);
  opacity: 0.46;
  pointer-events: none;
}

.face.front {
  transform: translateZ(var(--die-depth));
}

.face.back {
  background:
    radial-gradient(ellipse at 28% 18%, rgba(255, 255, 255, 0.76) 0%, transparent 42%),
    linear-gradient(145deg, #edf5ee 0%, #c6d8cc 100%);
  transform: rotateY(180deg) translateZ(var(--die-depth));
}

.face.right {
  background:
    radial-gradient(ellipse at 28% 18%, rgba(255, 255, 255, 0.62) 0%, transparent 40%),
    linear-gradient(90deg, #e5eee7 0%, #adc2b4 100%);
  transform: rotateY(90deg) translateZ(var(--die-depth));
}

.face.left {
  background:
    radial-gradient(ellipse at 28% 18%, rgba(255, 255, 255, 0.62) 0%, transparent 40%),
    linear-gradient(270deg, #e5eee7 0%, #adc2b4 100%);
  transform: rotateY(-90deg) translateZ(var(--die-depth));
}

.face.top {
  background:
    radial-gradient(ellipse at 28% 18%, rgba(255, 255, 255, 0.98) 0%, transparent 46%),
    linear-gradient(145deg, #ffffff 0%, #e5f0e8 100%);
  transform: rotateX(90deg) translateZ(var(--die-depth));
}

.face.bottom {
  background: linear-gradient(145deg, #c0d1c5 0%, #8da996 100%);
  transform: rotateX(-90deg) translateZ(var(--die-depth));
}

.pip {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background:
    radial-gradient(circle at 36% 28%, #435248 0%, #0b100d 58%, #010302 100%);
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.12),
    inset 0 -2px 3px rgba(0, 0, 0, 0.72),
    0 1px 1px rgba(255, 255, 255, 0.14);
}

.pip-top-left {
  top: 16px;
  left: 16px;
}

.pip-top-right {
  top: 16px;
  right: 16px;
}

.pip-center {
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.pip-middle-left {
  top: 50%;
  left: 16px;
  transform: translateY(-50%);
}

.pip-middle-right {
  top: 50%;
  right: 16px;
  transform: translateY(-50%);
}

.pip-bottom-left {
  bottom: 16px;
  left: 16px;
}

.pip-bottom-right {
  right: 16px;
  bottom: 16px;
}

.roll-total {
  width: 100%;
  text-align: center;
  color: var(--accent-2);
  font-weight: 900;
  font-size: 30px;
  text-shadow:
    0 0 18px rgba(72, 255, 173, 0.62),
    0 0 34px rgba(72, 255, 173, 0.28);
}

.dice-log {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.dice-log li {
  border: 1px solid var(--line);
  border-radius: 8px;
  background:
    linear-gradient(90deg, rgba(72, 255, 173, 0.11), transparent 62%),
    rgba(4, 10, 8, 0.86);
  padding: 10px;
}

.dice-log strong {
  color: var(--accent-2);
}

.dice-log span {
  display: block;
  margin-top: 4px;
  color: var(--muted);
  font-size: 12px;
}

.app-shell {
  position: fixed;
  inset: 0;
  z-index: 1;
  min-height: 100dvh;
  display: block;
  overflow: hidden;
  background: #010302;
}

.play-surface {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: 50px minmax(0, 1fr);
  min-height: 0;
}

.combat-rail {
  position: relative;
  z-index: 6;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  gap: 6px;
  padding: max(7px, env(safe-area-inset-top)) 3px max(7px, env(safe-area-inset-bottom));
  border-right: 1px solid rgba(72, 255, 173, 0.36);
  background:
    linear-gradient(90deg, rgba(72, 255, 173, 0.1), transparent),
    rgba(0, 0, 0, 0.92);
  box-shadow: 10px 0 28px rgba(0, 0, 0, 0.48);
}

.rail-status {
  min-height: 24px;
  display: grid;
  grid-template-columns: 5px minmax(0, 1fr);
  align-items: center;
  gap: 4px;
  color: var(--accent);
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0;
  overflow: hidden;
}

.status-pip {
  width: 3px;
  height: 18px;
  border-radius: 999px;
  background: var(--accent);
  box-shadow: 0 0 12px rgba(72, 255, 173, 0.82);
}

.rail-status span:last-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: clip;
}

.board-select {
  width: 40px;
  min-height: 30px;
  border: 1px solid rgba(72, 255, 173, 0.46);
  border-radius: 4px;
  background: rgba(5, 17, 13, 0.94);
  color: var(--accent);
  padding: 0 3px;
  font-size: 10px;
  font-weight: 900;
  box-shadow: none;
}

.board-select:disabled {
  color: rgba(166, 180, 175, 0.58);
  border-color: rgba(166, 180, 175, 0.22);
}

.initiative-rail {
  min-height: 0;
  display: grid;
  align-content: start;
  gap: 6px;
  overflow: auto;
  scrollbar-width: none;
}

.initiative-rail::-webkit-scrollbar {
  display: none;
}

.rail-piece {
  display: grid;
  grid-template-columns: 11px 29px;
  align-items: center;
  gap: 2px;
  width: 44px;
  min-height: 39px;
  border: 0;
  border-left: 3px solid transparent;
  border-radius: 3px;
  padding: 2px 0;
  background: rgba(0, 0, 0, 0.32);
  color: var(--text);
  box-shadow: none;
}

.rail-piece.selected {
  border-left-color: var(--accent);
  background: rgba(72, 255, 173, 0.22);
}

.rail-score {
  color: var(--accent-2);
  font-size: 12px;
  font-weight: 900;
  text-align: right;
}

.rail-avatar {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(244, 255, 248, 0.72);
  background:
    radial-gradient(circle at 50% 28%, rgba(244, 255, 248, 0.95), rgba(72, 255, 173, 0.74) 30%, #08120f 68%);
  color: #020504;
  font-size: 13px;
  font-weight: 900;
  overflow: hidden;
}

.rail-tools {
  display: grid;
  gap: 5px;
  justify-items: center;
}

.rail-button {
  width: 40px;
  min-height: 32px;
  margin: 0 auto;
  padding: 0;
  border-color: rgba(72, 255, 173, 0.52);
  background: rgba(5, 17, 13, 0.92);
  color: var(--accent);
  font-size: 11px;
  font-weight: 900;
  box-shadow: none;
}

.board-frame {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 10%, rgba(72, 255, 173, 0.08), transparent 45%),
    #010302;
}

#boardCanvas {
  width: 100%;
  height: 100dvh;
  min-height: 0;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.board-hud {
  position: absolute;
  top: max(8px, env(safe-area-inset-top));
  left: 8px;
  right: 8px;
  z-index: 4;
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 10px;
  pointer-events: none;
}

.board-hud h1 {
  color: rgba(244, 255, 248, 0.92);
  font-size: 15px;
  text-shadow: 0 1px 10px rgba(0, 0, 0, 0.8);
}

.board-hud #connectionStatus {
  color: var(--accent);
  font-size: 10px;
}

.board-hud #boardStatus {
  margin-top: 2px;
  color: rgba(244, 255, 248, 0.82);
  font-size: 10px;
  font-weight: 760;
  text-shadow: 0 1px 10px rgba(0, 0, 0, 0.76);
}

.board-hud .error-text {
  max-width: min(54vw, 320px);
  min-height: 0;
  padding: 6px 8px;
  border: 1px solid rgba(255, 119, 107, 0.4);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.68);
  font-weight: 700;
}

.camera-controls {
  position: absolute;
  right: 8px;
  bottom: max(8px, env(safe-area-inset-bottom));
  z-index: 5;
  display: grid;
  grid-template-columns: repeat(3, 36px);
  gap: 5px;
}

.camera-button {
  width: 36px;
  min-height: 34px;
  padding: 0;
  border-color: rgba(72, 255, 173, 0.52);
  border-radius: 5px;
  background: rgba(5, 17, 13, 0.9);
  color: var(--accent);
  font-size: 16px;
  font-weight: 900;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.34);
}

.camera-reset {
  font-size: 11px;
}

.dice-overlay {
  position: absolute;
  left: 56px;
  right: 8px;
  bottom: calc(10px + env(safe-area-inset-bottom));
  z-index: 12;
  display: grid;
  place-items: center;
  pointer-events: none;
  opacity: 0;
  transform: translateY(12px);
  transition:
    opacity 160ms ease,
    transform 160ms ease;
}

.dice-overlay.visible {
  opacity: 1;
  transform: translateY(0);
}

.dice-overlay .dice-stage {
  width: min(390px, 100%);
  min-height: 168px;
  background:
    radial-gradient(ellipse at 50% 38%, rgba(72, 255, 173, 0.28), transparent 52%),
    radial-gradient(ellipse at 50% 78%, rgba(0, 0, 0, 0.68), transparent 66%),
    linear-gradient(180deg, rgba(244, 255, 248, 0.05), transparent 42%),
    rgba(2, 8, 6, 0.94);
  box-shadow:
    0 18px 42px rgba(0, 0, 0, 0.58),
    0 0 34px rgba(72, 255, 173, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    inset 0 0 42px rgba(72, 255, 173, 0.08);
}

.character-sheet {
  position: absolute;
  top: max(8px, env(safe-area-inset-top));
  bottom: max(8px, env(safe-area-inset-bottom));
  left: 56px;
  z-index: 10;
  width: min(320px, calc(100vw - 64px));
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  border: 1px solid rgba(72, 255, 173, 0.8);
  background: #000;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.9),
    0 20px 50px rgba(0, 0, 0, 0.62),
    0 0 28px rgba(72, 255, 173, 0.12);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 120ms ease, visibility 120ms ease;
  overflow: hidden;
}

.character-sheet.open {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}

.sheet-header {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 10px 6px;
}

.sheet-kicker {
  color: var(--muted);
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
}

.sheet-header h2 {
  margin: 0;
  color: var(--accent);
  font-size: 24px;
  font-weight: 500;
  line-height: 1;
}

.sheet-header button {
  min-height: 32px;
  padding: 0 9px;
  font-size: 12px;
}

.sheet-tabs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border-bottom: 1px solid var(--line);
}

.sheet-tab {
  min-height: 36px;
  border: 0;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  background: transparent;
  color: var(--muted);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  box-shadow: none;
}

.sheet-tab.active {
  border-bottom-color: var(--accent-2);
  color: var(--accent-2);
}

.sheet-body {
  min-height: 0;
  padding: 10px;
  overflow: auto;
}

.sheet-grid {
  display: grid;
  gap: 10px;
}

.sheet-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  border-bottom: 1px solid rgba(244, 255, 248, 0.22);
  padding-bottom: 7px;
}

.sheet-label {
  color: var(--muted);
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
}

.sheet-value {
  color: var(--text);
  font-size: 15px;
  font-weight: 800;
}

.sheet-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 5px;
}

.sheet-actions button {
  min-height: 30px;
  padding: 0 5px;
  border-radius: 0;
  font-size: 10px;
  font-weight: 850;
  text-transform: uppercase;
}

.sheet-actions button.active {
  background: var(--accent);
  color: #020504;
}

.sheet-skill-actions {
  display: grid;
  gap: 6px;
}

.sheet-skill-actions button {
  min-height: 36px;
  justify-content: space-between;
  border-radius: 4px;
  text-align: left;
  font-size: 12px;
}

.sheet-empty {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.35;
}

.item-list {
  display: grid;
  gap: 6px;
}

.item-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  border-bottom: 1px solid rgba(244, 255, 248, 0.16);
  padding-bottom: 6px;
}

.item-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text);
  font-size: 13px;
  font-weight: 760;
  white-space: nowrap;
}

.item-meta {
  color: var(--muted);
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
}

.stat-strip {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 4px;
}

.stat {
  border: 1px solid rgba(72, 255, 173, 0.42);
  padding: 5px 3px;
  text-align: center;
}

.stat b {
  display: block;
  color: var(--accent);
  font-size: 10px;
}

.stat span {
  color: var(--text);
  font-size: 18px;
  font-weight: 500;
}

.chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.chip-list span {
  border: 1px solid rgba(72, 255, 173, 0.55);
  padding: 3px 5px;
  color: var(--accent-2);
  font-size: 10px;
}

.room-dialog {
  width: min(520px, calc(100vw - 20px));
  border: 1px solid rgba(72, 255, 173, 0.74);
  border-radius: 10px;
  background: rgba(2, 8, 6, 0.96);
  color: var(--text);
  box-shadow: 0 22px 70px rgba(0, 0, 0, 0.72);
}

.room-dialog::backdrop {
  background: rgba(0, 0, 0, 0.58);
}

.room-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.room-form label,
.dice-expression,
.piece-create-title,
.board-create-title {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.room-form span,
.dice-expression span,
.piece-create-title span,
.board-create-title span {
  color: var(--muted);
  font-size: 11px;
  font-weight: 760;
  text-transform: uppercase;
}

.piece-create-title,
.board-create-title {
  grid-column: 1 / -1;
  padding-top: 4px;
  border-top: 1px solid rgba(72, 255, 173, 0.18);
}

.piece-sheet-field {
  align-self: end;
  grid-template-columns: auto 1fr;
  align-items: center;
}

.piece-crop-fields,
.piece-size-fields {
  grid-column: 1 / -1;
  display: grid;
  gap: 10px;
}

.piece-crop-fields {
  grid-template-columns: 64px repeat(4, minmax(0, 1fr));
}

.piece-size-fields {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.piece-crop-fields label,
.piece-size-fields label {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.piece-crop-toggle {
  align-self: end;
  grid-template-columns: auto 1fr;
  align-items: center;
}

.piece-crop-toggle input,
.piece-sheet-field input {
  width: 18px;
  min-height: 18px;
  accent-color: var(--accent);
}

.dialog-title,
.dialog-actions {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 10px;
}

.dialog-title h2 {
  margin: 0;
  color: var(--accent);
}

.dialog-title p {
  color: var(--muted);
  font-size: 12px;
}

.brand-mark.small {
  width: 34px;
  height: 34px;
  font-size: 12px;
}

.dialog-actions {
  justify-content: end;
  flex-wrap: wrap;
}

@media (min-width: 840px) {
  .play-surface {
    grid-template-columns: 58px minmax(0, 1fr);
  }

  .combat-rail {
    padding-left: 5px;
    padding-right: 5px;
  }

  .rail-piece {
    width: 48px;
    grid-template-columns: 13px 32px;
  }

  .rail-avatar {
    width: 32px;
    height: 32px;
  }

  .rail-button {
    width: 46px;
  }

  .board-select {
    width: 46px;
  }

  .dice-overlay,
  .character-sheet {
    left: 68px;
  }
}

@media (max-width: 520px) {
  .play-surface {
    grid-template-columns: 46px minmax(0, 1fr);
  }

  .combat-rail {
    gap: 5px;
  }

  .rail-button {
    width: 36px;
    min-height: 30px;
  }

  .board-select {
    width: 36px;
  }

  .dice-overlay,
  .character-sheet {
    left: 51px;
  }

  .character-sheet {
    width: min(306px, calc(100vw - 56px));
  }

  .room-form {
    grid-template-columns: 1fr;
  }
}

@keyframes tumble {
  0% {
    transform: rotateX(calc(var(--die-tilt-x) - 180deg)) rotateY(calc(var(--die-tilt-y) + 120deg)) rotateZ(calc(var(--die-tilt-z) - 90deg)) translateY(-9px) scale(0.96);
  }
  12% {
    transform: rotateX(calc(var(--die-tilt-x) + 520deg)) rotateY(calc(var(--die-tilt-y) - 430deg)) rotateZ(calc(var(--die-tilt-z) + 230deg)) translateY(-14px) scale(1.04);
  }
  24% {
    transform: rotateX(calc(var(--die-tilt-x) + 1080deg)) rotateY(calc(var(--die-tilt-y) - 910deg)) rotateZ(calc(var(--die-tilt-z) + 470deg)) translateY(3px) scale(1.03);
  }
  40% {
    transform: rotateX(calc(var(--die-tilt-x) + 1640deg)) rotateY(calc(var(--die-tilt-y) - 1340deg)) rotateZ(calc(var(--die-tilt-z) + 700deg)) translateY(-8px) scale(1.05);
  }
  58% {
    transform: rotateX(calc(var(--die-tilt-x) + 2100deg)) rotateY(calc(var(--die-tilt-y) - 1700deg)) rotateZ(calc(var(--die-tilt-z) + 900deg)) translateY(2px) scale(1.02);
  }
  74% {
    transform: rotateX(calc(var(--die-tilt-x) + 360deg)) rotateY(calc(var(--die-tilt-y) - 260deg)) rotateZ(calc(var(--die-tilt-z) + 112deg)) translateY(-4px) scale(1.01);
  }
  88% {
    transform: rotateX(calc(var(--die-tilt-x) + 68deg)) rotateY(calc(var(--die-tilt-y) - 46deg)) rotateZ(calc(var(--die-tilt-z) + 18deg)) translateY(1px) scale(1);
  }
  100% {
    transform: rotateX(var(--die-tilt-x)) rotateY(var(--die-tilt-y)) rotateZ(var(--die-tilt-z)) translateY(0) scale(1);
  }
}

`

const CLIENT_JS = `const DEFAULT_GAME_ID = "demo-room";
const DEFAULT_ACTOR_ID = "local-user";
const DICE_ROLL_ANIMATION_MS = 2200;
const DICE_OVERLAY_VISIBLE_MS = 6200;

const qs = new URLSearchParams(location.search);
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

const els = {
  status: document.getElementById("connectionStatus"),
  roomForm: document.getElementById("roomForm"),
  roomInput: document.getElementById("roomInput"),
  userInput: document.getElementById("userInput"),
  bootstrap: document.getElementById("bootstrapButton"),
  refresh: document.getElementById("refreshButton"),
  createPiece: document.getElementById("createPieceButton"),
  createBoard: document.getElementById("createBoardButton"),
  pieceNameInput: document.getElementById("pieceNameInput"),
  pieceImageInput: document.getElementById("pieceImageInput"),
  pieceImageFileInput: document.getElementById("pieceImageFileInput"),
  pieceCropInput: document.getElementById("pieceCropInput"),
  pieceCropXInput: document.getElementById("pieceCropXInput"),
  pieceCropYInput: document.getElementById("pieceCropYInput"),
  pieceCropWidthInput: document.getElementById("pieceCropWidthInput"),
  pieceCropHeightInput: document.getElementById("pieceCropHeightInput"),
  pieceWidthInput: document.getElementById("pieceWidthInput"),
  pieceHeightInput: document.getElementById("pieceHeightInput"),
  pieceScaleInput: document.getElementById("pieceScaleInput"),
  pieceSheetInput: document.getElementById("pieceSheetInput"),
  boardNameInput: document.getElementById("boardNameInput"),
  boardImageInput: document.getElementById("boardImageInput"),
  boardImageFileInput: document.getElementById("boardImageFileInput"),
  boardWidthInput: document.getElementById("boardWidthInput"),
  boardHeightInput: document.getElementById("boardHeightInput"),
  boardScaleInput: document.getElementById("boardScaleInput"),
  roll: document.getElementById("rollButton"),
  diceExpression: document.getElementById("diceExpression"),
  error: document.getElementById("errorText"),
  boardStatus: document.getElementById("boardStatus"),
  boardSelect: document.getElementById("boardSelect"),
  zoomOut: document.getElementById("zoomOutButton"),
  zoomReset: document.getElementById("zoomResetButton"),
  zoomIn: document.getElementById("zoomInButton"),
  canvas: document.getElementById("boardCanvas"),
  diceStage: document.getElementById("diceStage"),
  diceOverlay: document.getElementById("diceOverlay"),
  initiativeRail: document.getElementById("initiativeRail"),
  sheet: document.getElementById("characterSheet"),
  sheetButton: document.getElementById("sheetButton"),
  sheetClose: document.getElementById("sheetCloseButton"),
  sheetName: document.getElementById("sheetName"),
  sheetBody: document.getElementById("sheetBody"),
  sheetTabs: Array.from(document.querySelectorAll("[data-sheet-tab]")),
  menu: document.getElementById("menuButton"),
  roomDialog: document.getElementById("roomDialog"),
  roomCancel: document.getElementById("roomCancelButton")
};

const ctx = els.canvas.getContext("2d");
let roomId = qs.get("game") || DEFAULT_GAME_ID;
let actorId = qs.get("user") || DEFAULT_ACTOR_ID;
let state = null;
let socket = null;
let socketOpen = false;
let firstStateApplied = false;
let latestDiceId = null;
const viewerRole = qs.get("viewer") || "referee";
const canSelectBoards = viewerRole.toLowerCase() === "referee";
let selectedPieceId = null;
let sheetOpen = false;
let activeSheetTab = "details";
let drag = null;
let boardCamera = {zoom: 1, panX: 0, panY: 0};
let cameraBoardId = null;
let requestCounter = 0;
let diceHideTimer = null;
const boardImageCache = new Map();
const pieceImageCache = new Map();

els.roomInput.value = roomId;
els.userInput.value = actorId;

const setStatus = (text) => {
  els.status.textContent = text;
};

const setError = (text) => {
  els.error.textContent = text || "";
};

const requestId = (prefix) => prefix + "-" + Date.now().toString(36) + "-" + (++requestCounter).toString(36);

const roomPath = () => "/rooms/" + encodeURIComponent(roomId);
const viewerQuery = () => "?viewer=" + encodeURIComponent(viewerRole) + "&user=" + encodeURIComponent(actorId);
const idFromName = (name, fallback) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || fallback;

const commandMessage = (id, command) => ({
  type: "command",
  requestId: id,
  command
});

const postCommand = async (command, id = requestId(command.type)) => {
  const response = await fetch(roomPath() + "/command", {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify(commandMessage(id, command))
  });
  const message = await response.json();
  applyMessage(message);
  if (!response.ok) throw new Error(message.error?.message || "Command failed");
  return message;
};

const sendCommand = async (command) => {
  const id = requestId(command.type);
  if (socket && socketOpen) {
    socket.send(JSON.stringify(commandMessage(id, command)));
    return;
  }
  await postCommand(command, id);
};

const fetchState = async () => {
  const response = await fetch(roomPath() + "/state" + viewerQuery());
  const message = await response.json();
  applyMessage(message);
};

const createGameCommand = () => ({
  type: "CreateGame",
  gameId: roomId,
  actorId,
  slug: roomId,
  name: "Cepheus Room " + roomId
});

const createBoardCommand = () => ({
  type: "CreateBoard",
  gameId: roomId,
  actorId,
  boardId: "main-board",
  name: "Downport Skirmish",
  width: 1200,
  height: 800,
  scale: 50
});

const createCharacterCommand = () => ({
  type: "CreateCharacter",
  gameId: roomId,
  actorId,
  characterId: "scout",
  characterType: "PLAYER",
  name: "Scout"
});

const updateScoutSheetCommand = () => ({
  type: "UpdateCharacterSheet",
  gameId: roomId,
  actorId,
  characterId: "scout",
  age: 34,
  characteristics: {
    str: 7,
    dex: 8,
    end: 8,
    int: 7,
    edu: 9,
    soc: 6
  },
  skills: ["Vacc Suit-0", "Gun Combat-0", "Mechanic-0", "Recon-0"],
  equipment: [
    {name: "Vacc Suit", quantity: 1, notes: "Carried"},
    {name: "Laser Carbine", quantity: 1, notes: "Carried"},
    {name: "Medkit", quantity: 1, notes: "Stowed"}
  ],
  credits: 1200
});

const createPieceCommand = (boardId) => ({
  type: "CreatePiece",
  gameId: roomId,
  actorId,
  pieceId: "scout-1",
  boardId,
  name: "Scout",
  characterId: "scout",
  imageAssetId: null,
  x: 220,
  y: 180
});

const uniqueBoardId = (name) => {
  const base = idFromName(name, "board");
  let index = Object.keys(state?.boards || {}).length + 1;
  let boardId = base + "-" + index;
  while (state?.boards?.[boardId]) {
    index += 1;
    boardId = base + "-" + index;
  }
  return boardId;
};

const uniquePieceId = (name) => {
  const base = idFromName(name, "piece");
  let index = Object.keys(state?.pieces || {}).length + 1;
  let pieceId = base + "-" + index;
  while (state?.pieces?.[pieceId]) {
    index += 1;
    pieceId = base + "-" + index;
  }
  return pieceId;
};

const uniqueCharacterId = (name) => {
  const base = idFromName(name, "character");
  let index = Object.keys(state?.characters || {}).length + 1;
  let characterId = base + "-" + index;
  while (state?.characters?.[characterId]) {
    index += 1;
    characterId = base + "-" + index;
  }
  return characterId;
};

const parsePositiveIntegerInput = (input, fallback) => {
  const value = Number.parseInt(input.value, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const parsePositiveNumberInput = (input, fallback) => {
  const value = Number.parseFloat(input.value);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const parseNonNegativeIntegerInput = (input, fallback) => {
  const value = Number.parseInt(input.value, 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};

const readSelectedImageFileAsDataUrl = (input) => new Promise((resolve, reject) => {
  const file = input.files?.[0];
  if (!file) {
    resolve(null);
    return;
  }
  if (!file.type.startsWith("image/")) {
    reject(new Error("Selected file must be an image"));
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    resolve(typeof reader.result === "string" ? reader.result : null);
  });
  reader.addEventListener("error", () => {
    reject(new Error("Could not read selected image"));
  });
  reader.readAsDataURL(file);
});

const readSelectedCroppedImageFileAsDataUrl = (input, crop) => new Promise((resolve, reject) => {
  const file = input.files?.[0];
  if (!file) {
    resolve(null);
    return;
  }
  if (!file.type.startsWith("image/")) {
    reject(new Error("Selected file must be an image"));
    return;
  }

  const image = new Image();
  const objectUrl = URL.createObjectURL(file);
  const cleanup = () => URL.revokeObjectURL(objectUrl);
  image.addEventListener("load", () => {
    cleanup();
    if (crop.x >= image.naturalWidth || crop.y >= image.naturalHeight) {
      reject(new Error("Crop starts outside selected image"));
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = crop.width;
    canvas.height = crop.height;
    const canvasContext = canvas.getContext("2d");
    if (!canvasContext) {
      reject(new Error("Could not crop selected image"));
      return;
    }
    canvasContext.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
    resolve(canvas.toDataURL("image/png"));
  });
  image.addEventListener("error", () => {
    cleanup();
    reject(new Error("Could not crop selected image"));
  });
  image.src = objectUrl;
});

const readImageDimensions = (file) => new Promise((resolve, reject) => {
  if (!file.type.startsWith("image/")) {
    reject(new Error("Selected file must be an image"));
    return;
  }

  const image = new Image();
  const objectUrl = URL.createObjectURL(file);
  image.addEventListener("load", () => {
    const dimensions = {width: image.naturalWidth, height: image.naturalHeight};
    URL.revokeObjectURL(objectUrl);
    resolve(dimensions);
  });
  image.addEventListener("error", () => {
    URL.revokeObjectURL(objectUrl);
    reject(new Error("Could not inspect selected image"));
  });
  image.src = objectUrl;
});

const applyBoardFileDimensions = async () => {
  const file = els.boardImageFileInput.files?.[0];
  if (!file) return;
  const dimensions = await readImageDimensions(file);
  els.boardWidthInput.value = String(dimensions.width);
  els.boardHeightInput.value = String(dimensions.height);
};

const applyPieceFileDimensions = async () => {
  const file = els.pieceImageFileInput.files?.[0];
  if (!file) return;
  const dimensions = await readImageDimensions(file);
  const shortAxis = Math.min(dimensions.width, dimensions.height);
  const longAxis = Math.max(dimensions.width, dimensions.height);
  if (shortAxis > 301 || longAxis / shortAxis > 2.2) return;

  const aspectRatio = dimensions.width / dimensions.height;
  if (aspectRatio > 1.45) {
    els.pieceWidthInput.value = "100";
    els.pieceHeightInput.value = "50";
    return;
  }
  if (aspectRatio < 0.69) {
    els.pieceWidthInput.value = "50";
    els.pieceHeightInput.value = "100";
    return;
  }
  els.pieceWidthInput.value = "50";
  els.pieceHeightInput.value = "50";
};

const selectedPieceImageDataUrl = async () => {
  const file = els.pieceImageFileInput.files?.[0];
  if (!file) return els.pieceImageInput.value.trim() || null;
  if (!els.pieceCropInput.checked) return await readSelectedImageFileAsDataUrl(els.pieceImageFileInput);

  return await readSelectedCroppedImageFileAsDataUrl(els.pieceImageFileInput, {
    x: parseNonNegativeIntegerInput(els.pieceCropXInput, 0),
    y: parseNonNegativeIntegerInput(els.pieceCropYInput, 0),
    width: parsePositiveIntegerInput(els.pieceCropWidthInput, 150),
    height: parsePositiveIntegerInput(els.pieceCropHeightInput, 150)
  });
};

const createManualCharacterCommand = (characterId, name) => ({
  type: "CreateCharacter",
  gameId: roomId,
  actorId,
  characterId,
  characterType: "PLAYER",
  name
});

const updateManualCharacterSheetCommand = (characterId) => ({
  type: "UpdateCharacterSheet",
  gameId: roomId,
  actorId,
  characterId,
  age: 30,
  characteristics: {
    str: 7,
    dex: 7,
    end: 7,
    int: 7,
    edu: 7,
    soc: 7
  },
  skills: ["Athletics-0", "Gun Combat-0"],
  equipment: [],
  credits: 0
});

const boardList = () => Object.values(state?.boards || {});

const selectedBoardId = () => {
  if (!state) return null;
  if (state.selectedBoardId && state.boards[state.selectedBoardId]) return state.selectedBoardId;
  return Object.keys(state.boards)[0] || null;
};

const createCustomBoard = async () => {
  setError("");
  if (!state) {
    await postCommand(createGameCommand(), requestId("create-game-for-board"));
  }

  const name = els.boardNameInput.value.trim() || "Board " + (Object.keys(state?.boards || {}).length + 1);
  const width = parsePositiveIntegerInput(els.boardWidthInput, 1200);
  const height = parsePositiveIntegerInput(els.boardHeightInput, 800);
  const scale = parsePositiveIntegerInput(els.boardScaleInput, 50);
  const boardId = uniqueBoardId(name);
  const imageUrl = await readSelectedImageFileAsDataUrl(els.boardImageFileInput) || els.boardImageInput.value.trim() || null;
  await sendCommand({
    type: "CreateBoard",
    gameId: roomId,
    actorId,
    boardId,
    name,
    imageAssetId: null,
    url: imageUrl,
    width,
    height,
    scale
  });
  els.boardNameInput.value = "";
  els.boardImageInput.value = "";
  els.boardImageFileInput.value = "";
  els.roomDialog.close();
  render();
};

const createCustomPiece = async () => {
  const board = selectedBoard();
  if (!state || !board) {
    setError("Bootstrap a board before creating a piece");
    return;
  }

  const name = els.pieceNameInput.value.trim();
  if (!name) {
    setError("Piece name is required");
    els.pieceNameInput.focus();
    return;
  }

  const width = parsePositiveIntegerInput(els.pieceWidthInput, 50);
  const height = parsePositiveIntegerInput(els.pieceHeightInput, 50);
  const scale = parsePositiveNumberInput(els.pieceScaleInput, 1);
  const pieceIndex = boardPieces().length;
  const x = Math.max(0, Math.min(board.width - width * scale, 160 + (pieceIndex % 8) * 58));
  const y = Math.max(0, Math.min(board.height - height * scale, 140 + Math.floor(pieceIndex / 8) * 58));
  const pieceId = uniquePieceId(name);
  const characterId = els.pieceSheetInput.checked ? uniqueCharacterId(name) : null;
  const imageAssetId = await selectedPieceImageDataUrl();
  if (characterId) {
    await sendCommand(createManualCharacterCommand(characterId, name));
    await sendCommand(updateManualCharacterSheetCommand(characterId));
  }
  await sendCommand({
    type: "CreatePiece",
    gameId: roomId,
    actorId,
    pieceId,
    boardId: board.id,
    name,
    characterId,
    imageAssetId,
    x,
    y,
    width,
    height,
    scale
  });
  selectedPieceId = pieceId;
  els.pieceNameInput.value = "";
  els.pieceImageInput.value = "";
  els.pieceImageFileInput.value = "";
  els.pieceCropInput.checked = false;
  els.pieceCropXInput.value = "0";
  els.pieceCropYInput.value = "0";
  els.pieceCropWidthInput.value = "150";
  els.pieceCropHeightInput.value = "150";
  els.pieceWidthInput.value = "50";
  els.pieceHeightInput.value = "50";
  els.pieceScaleInput.value = "1";
  els.roomDialog.close();
  render();
};

const nextBootstrapCommand = () => {
  if (!state) return createGameCommand();
  const boardIds = Object.keys(state.boards || {});
  if (boardIds.length === 0) return createBoardCommand();
  if (!state.characters?.scout) return createCharacterCommand();
  if ((state.characters.scout.skills || []).length === 0) return updateScoutSheetCommand();
  if (Object.keys(state.pieces || {}).length === 0) {
    return createPieceCommand(selectedBoardId() || boardIds[0]);
  }
  return null;
};

const bootstrapScene = async () => {
  setError("");
  for (let i = 0; i < 6; i++) {
    const command = nextBootstrapCommand();
    if (!command) break;
    await postCommand(command, "bootstrap-" + i);
  }
  await fetchState();
};

const connectSocket = () => {
  if (socket) socket.close();
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(protocol + "//" + location.host + roomPath() + "/ws" + viewerQuery());
  socketOpen = false;
  setStatus("Connecting");

  socket.addEventListener("open", () => {
    socketOpen = true;
    setStatus("Live");
  });

  socket.addEventListener("close", () => {
    socketOpen = false;
    setStatus("HTTP fallback");
  });

  socket.addEventListener("error", () => {
    socketOpen = false;
    setStatus("HTTP fallback");
  });

  socket.addEventListener("message", (event) => {
    try {
      applyMessage(JSON.parse(event.data));
    } catch {
      setError("Received an invalid server message");
    }
  });
};

const applyMessage = (message) => {
  switch (message.type) {
    case "roomState":
    case "commandAccepted":
      setError("");
      applyState(message.state);
      break;
    case "commandRejected":
      setError(message.error.message);
      if (message.error.code === "stale_command") fetchState().catch((err) => setError(err.message));
      break;
    case "error":
      setError(message.error.message);
      break;
    case "pong":
      break;
    default:
      setError("Unhandled server message " + message.type);
  }
};

const applyState = (nextState) => {
  const previousDiceId = latestDiceId;
  state = nextState;
  const latestRoll = state?.diceLog?.[state.diceLog.length - 1] || null;
  latestDiceId = latestRoll?.id || null;
  render();
  if (latestRoll && firstStateApplied && latestRoll.id !== previousDiceId) {
    animateRoll(latestRoll);
  }
  firstStateApplied = true;
};

const selectedBoard = () => {
  const boardId = selectedBoardId();
  return boardId ? state.boards[boardId] : null;
};

const boardPieces = () => {
  const board = selectedBoard();
  if (!state || !board) return [];
  return Object.values(state.pieces).filter((piece) => piece.boardId === board.id);
};

const browserImageUrl = (value) => {
  const imageRef = value || "";
  if (
    imageRef.startsWith("/") ||
    imageRef.startsWith("http://") ||
    imageRef.startsWith("https://") ||
    imageRef.startsWith("blob:") ||
    imageRef.startsWith("data:image/")
  ) {
    return imageRef;
  }
  return null;
};

const pieceImageUrl = (piece) => browserImageUrl(piece.imageAssetId);

const boardImageUrl = (board) => browserImageUrl(board.url) || browserImageUrl(board.imageAssetId);

const cssUrl = (url) => "url(" + JSON.stringify(url) + ")";

const loadImage = (url, cache) => {
  if (!url) return null;

  const cached = cache.get(url);
  if (cached) {
    return cached.loaded && !cached.failed ? cached.image : null;
  }

  const image = new Image();
  image.decoding = "async";
  image.onload = () => {
    const cachedState = cache.get(url);
    if (cachedState) cachedState.loaded = true;
    render();
  };
  image.onerror = () => {
    const cachedState = cache.get(url);
    if (cachedState) cachedState.failed = true;
  };
  cache.set(url, {image, loaded: false, failed: false});
  image.src = url;
  return null;
};

const loadBoardImage = (board) => loadImage(boardImageUrl(board), boardImageCache);

const loadPieceImage = (piece) => loadImage(pieceImageUrl(piece), pieceImageCache);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const resetBoardCamera = () => {
  boardCamera = {zoom: 1, panX: 0, panY: 0};
};

const ensureBoardCamera = (board) => {
  if (!board || cameraBoardId === board.id) return;
  cameraBoardId = board.id;
  resetBoardCamera();
};

const canvasCssSize = () => {
  const rect = els.canvas.getBoundingClientRect();
  return {
    width: Math.max(1, Math.floor(rect.width)),
    height: Math.max(1, Math.floor(rect.height))
  };
};

const boardTransform = (board, cssWidth, cssHeight) => {
  const baseScale = Math.min(cssWidth / board.width, cssHeight / board.height);
  const scale = baseScale * boardCamera.zoom;
  return {
    scale,
    x: (cssWidth - board.width * scale) / 2 + boardCamera.panX,
    y: (cssHeight - board.height * scale) / 2 + boardCamera.panY
  };
};

const screenPoint = (event) => {
  const rect = els.canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
};

const screenToBoard = (screen, board, transform) => ({
  x: (screen.x - transform.x) / transform.scale,
  y: (screen.y - transform.y) / transform.scale
});

const canvasPoint = (event) => {
  const board = selectedBoard();
  if (!board) return {x: 0, y: 0};
  const size = canvasCssSize();
  return screenToBoard(screenPoint(event), board, boardTransform(board, size.width, size.height));
};

const clampPiecePosition = (piece, x, y) => {
  const board = selectedBoard();
  if (!board) return {x, y};
  return {
    x: clamp(x, 0, Math.max(0, board.width - piece.width * piece.scale)),
    y: clamp(y, 0, Math.max(0, board.height - piece.height * piece.scale))
  };
};

const setCameraZoom = (nextZoom, anchorScreen = null) => {
  const board = selectedBoard();
  if (!board) return;
  const size = canvasCssSize();
  const beforeTransform = boardTransform(board, size.width, size.height);
  const anchor = anchorScreen || {x: size.width / 2, y: size.height / 2};
  const boardAnchor = screenToBoard(anchor, board, beforeTransform);
  boardCamera.zoom = clamp(nextZoom, 0.5, 5);
  const afterTransform = boardTransform(board, size.width, size.height);
  boardCamera.panX += anchor.x - (afterTransform.x + boardAnchor.x * afterTransform.scale);
  boardCamera.panY += anchor.y - (afterTransform.y + boardAnchor.y * afterTransform.scale);
  render();
};

const releaseCanvasPointer = (pointerId) => {
  if (els.canvas.hasPointerCapture(pointerId)) {
    els.canvas.releasePointerCapture(pointerId);
  }
};

const hitPiece = (point) => {
  const pieces = boardPieces().sort((a, b) => b.z - a.z);
  return pieces.find((piece) =>
    point.x >= piece.x &&
    point.x <= piece.x + piece.width * piece.scale &&
    point.y >= piece.y &&
    point.y <= piece.y + piece.height * piece.scale
  ) || null;
};

const selectedPiece = () => {
  const pieces = boardPieces();
  return pieces.find((piece) => piece.id === selectedPieceId) || pieces[0] || null;
};

const selectedCharacter = (piece) => {
  if (!piece?.characterId) return null;
  return state?.characters?.[piece.characterId] || null;
};

const setSheetOpen = (open) => {
  sheetOpen = open;
  els.sheet.classList.toggle("open", sheetOpen);
};

const sheetRow = (label, value) => {
  const row = document.createElement("div");
  row.className = "sheet-row";
  const labelEl = document.createElement("span");
  labelEl.className = "sheet-label";
  labelEl.textContent = label;
  const valueEl = document.createElement("span");
  valueEl.className = "sheet-value";
  valueEl.textContent = value;
  row.append(labelEl, valueEl);
  return row;
};

const emptySheetText = (text) => {
  const empty = document.createElement("p");
  empty.className = "sheet-empty";
  empty.textContent = text;
  return empty;
};

const statStrip = (character) => {
  const values = character?.characteristics || {};
  const fallback = {str: 7, dex: 8, end: 8, int: 7, edu: 9, soc: 6};
  const stats = document.createElement("div");
  stats.className = "stat-strip";
  for (const [label, key] of [["Str", "str"], ["Dex", "dex"], ["End", "end"], ["Int", "int"], ["Edu", "edu"], ["Soc", "soc"]]) {
    const stat = document.createElement("div");
    stat.className = "stat";
    const name = document.createElement("b");
    name.textContent = label;
    const number = document.createElement("span");
    number.textContent = String(values[key] ?? values[key.toUpperCase()] ?? fallback[key]);
    stat.append(name, number);
    stats.append(stat);
  }
  return stats;
};

const characterSkills = (character) => {
  if (character && Array.isArray(character.skills)) {
    return character.skills.filter((skill) => typeof skill === "string" && skill.trim()).map((skill) => skill.trim());
  }
  if (character) return [];
  return ["Vacc Suit-0", "Gun Combat-0", "Mechanic-0", "Recon-0"];
};

const skillChips = (skills) => {
  const chips = document.createElement("div");
  chips.className = "chip-list";
  for (const label of skills) {
    const chip = document.createElement("span");
    chip.textContent = label;
    chips.append(chip);
  }
  return chips;
};

const visibilityActions = (piece) => {
  const actions = document.createElement("div");
  actions.className = "sheet-actions";
  for (const visibility of ["HIDDEN", "PREVIEW", "VISIBLE"]) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = visibility === "HIDDEN" ? "Hide" : visibility.toLowerCase();
    button.className = piece.visibility === visibility ? "active" : "";
    button.addEventListener("click", () => {
      sendCommand({
        type: "SetPieceVisibility",
        gameId: roomId,
        actorId,
        pieceId: piece.id,
        visibility
      }).catch((error) => setError(error.message));
    });
    actions.append(button);
  }
  return actions;
};

const freedomActions = (piece) => {
  const actions = document.createElement("div");
  actions.className = "sheet-actions";
  for (const freedom of ["LOCKED", "UNLOCKED", "SHARE"]) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = freedom === "LOCKED" ? "Lock" : freedom.toLowerCase();
    button.className = piece.freedom === freedom ? "active" : "";
    button.addEventListener("click", () => {
      sendCommand({
        type: "SetPieceFreedom",
        gameId: roomId,
        actorId,
        pieceId: piece.id,
        freedom
      }).catch((error) => setError(error.message));
    });
    actions.append(button);
  }
  return actions;
};

const renderDetailsTab = (body, piece, character) => {
  body.append(
    sheetRow("Type", character?.type || "PLAYER"),
    sheetRow("Age", character?.age == null ? "-" : String(character.age)),
    sheetRow("Position", Math.round(piece.x) + ", " + Math.round(piece.y)),
    sheetRow("Visibility", piece.visibility),
    visibilityActions(piece),
    sheetRow("Move", piece.freedom),
    freedomActions(piece),
    statStrip(character),
    skillChips(characterSkills(character))
  );
};

const renderActionTab = (body, piece, character) => {
  const skills = characterSkills(character);
  if (skills.length === 0) {
    body.append(emptySheetText("No trained skills"));
    return;
  }

  const actions = document.createElement("div");
  actions.className = "sheet-skill-actions";
  const name = character?.name || piece.name;
  for (const skill of skills) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = skill;
    button.addEventListener("click", () => {
      sendCommand({
        type: "RollDice",
        gameId: roomId,
        actorId,
        expression: "2d6",
        reason: name + ": " + skill
      }).catch((error) => setError(error.message));
    });
    actions.append(button);
  }
  body.append(actions);
};

const itemName = (item) => item?.Name || item?.name || "Item";

const itemQuantity = (item) => item?.Quantity ?? item?.quantity ?? 1;

const itemCarried = (item) => item?.Carried ?? item?.carried;

const itemNotes = (item) => item?.notes || item?.Notes || "";

const renderItemsTab = (body, character) => {
  body.append(sheetRow("Credits", character?.credits == null ? "-" : String(character.credits)));
  const equipment = Array.isArray(character?.equipment) ? character.equipment : [];
  if (equipment.length === 0) {
    body.append(emptySheetText("No equipment listed"));
    return;
  }

  const list = document.createElement("div");
  list.className = "item-list";
  for (const item of equipment) {
    const row = document.createElement("div");
    row.className = "item-row";
    const name = document.createElement("span");
    name.className = "item-name";
    name.textContent = itemName(item);
    const meta = document.createElement("span");
    meta.className = "item-meta";
    const carried = itemCarried(item);
    const notes = itemNotes(item);
    meta.textContent = "x" + itemQuantity(item) + (carried === undefined ? "" : carried ? " carried" : " stowed") + (notes ? " " + notes : "");
    row.append(name, meta);
    list.append(row);
  }
  body.append(list);
};

const renderNotesTab = (body, character) => {
  body.append(emptySheetText(character?.notes || "No notes"));
};

const renderSheet = () => {
  const piece = selectedPiece();
  const character = selectedCharacter(piece);
  els.sheetName.textContent = character?.name || piece?.name || "No piece";
  for (const tab of els.sheetTabs) {
    tab.classList.toggle("active", tab.dataset.sheetTab === activeSheetTab);
  }

  const body = document.createElement("div");
  body.className = "sheet-grid";
  if (!piece) {
    body.append(sheetRow("Status", "No active token"));
    body.append(sheetRow("Board", selectedBoard()?.name || "None"));
    els.sheetBody.replaceChildren(body);
    return;
  }

  if (activeSheetTab === "action") renderActionTab(body, piece, character);
  else if (activeSheetTab === "items") renderItemsTab(body, character);
  else if (activeSheetTab === "notes") renderNotesTab(body, character);
  else renderDetailsTab(body, piece, character);
  els.sheetBody.replaceChildren(body);
};

const renderRail = () => {
  const pieces = boardPieces();
  if (pieces.length === 0) {
    const empty = document.createElement("button");
    empty.className = "rail-piece";
    empty.type = "button";
    empty.disabled = true;
    const score = document.createElement("span");
    score.className = "rail-score";
    score.textContent = "-";
    const avatar = document.createElement("span");
    avatar.className = "rail-avatar";
    avatar.textContent = "+";
    empty.append(score, avatar);
    els.initiativeRail.replaceChildren(empty);
    renderSheet();
    return;
  }

  els.initiativeRail.replaceChildren(...pieces.map((piece, index) => {
    const button = document.createElement("button");
    button.className = "rail-piece" + (piece.id === selectedPieceId ? " selected" : "");
    button.type = "button";
    button.title = piece.name;
    const score = document.createElement("span");
    score.className = "rail-score";
    score.textContent = String(Math.max(1, 7 - index));
    const avatar = document.createElement("span");
    avatar.className = "rail-avatar";
    const imageUrl = pieceImageUrl(piece);
    if (imageUrl) {
      avatar.style.backgroundImage = cssUrl(imageUrl);
      avatar.style.backgroundSize = "cover";
      avatar.style.backgroundPosition = "center";
    } else {
      avatar.textContent = (piece.name || "?").slice(0, 1).toUpperCase();
    }
    button.append(score, avatar);
    button.addEventListener("click", () => {
      selectedPieceId = piece.id;
      setSheetOpen(true);
      render();
    });
    return button;
  }));
  renderSheet();
};

const renderBoardControls = () => {
  const boards = boardList();
  const board = selectedBoard();
  const selectedIndex = board ? boards.findIndex((candidate) => candidate.id === board.id) : -1;
  els.boardStatus.textContent = board
    ? board.name + " (" + (selectedIndex + 1) + "/" + boards.length + ")"
    : "No board";

  const options = boards.map((candidate, index) => {
    const option = document.createElement("option");
    option.value = candidate.id;
    option.textContent = "B" + (index + 1) + " " + candidate.name;
    return option;
  });
  els.boardSelect.replaceChildren(...options);
  els.boardSelect.value = board?.id || "";
  els.boardSelect.disabled = boards.length === 0 || !canSelectBoards;
  els.boardSelect.title = canSelectBoards
    ? board?.name || "Board"
    : "Board selection is referee-only";
  els.zoomOut.disabled = !board;
  els.zoomReset.disabled = !board;
  els.zoomIn.disabled = !board;
  els.zoomReset.textContent = Math.round(boardCamera.zoom * 100) + "%";
};

const drawGrid = (board) => {
  const grid = Math.max(25, board.scale || 50);
  ctx.strokeStyle = "rgba(238, 244, 241, 0.08)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= board.width; x += grid) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, board.height);
    ctx.stroke();
  }
  for (let y = 0; y <= board.height; y += grid) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(board.width, y);
    ctx.stroke();
  }
};

const render = () => {
  const board = selectedBoard();
  if (board) ensureBoardCamera(board);
  renderBoardControls();
  const size = canvasCssSize();
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = size.width;
  const cssHeight = size.height;
  if (els.canvas.width !== cssWidth * dpr || els.canvas.height !== cssHeight * dpr) {
    els.canvas.width = cssWidth * dpr;
    els.canvas.height = cssHeight * dpr;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  if (!board) {
    ctx.fillStyle = "#253130";
    ctx.fillRect(0, 0, cssWidth, cssHeight);
    ctx.fillStyle = "#a6b4af";
    ctx.font = "16px system-ui";
    ctx.fillText("Open or bootstrap a room from the menu", 24, 34);
    renderRail();
    return;
  }

  const transform = boardTransform(board, cssWidth, cssHeight);
  ctx.fillStyle = "#253130";
  ctx.fillRect(0, 0, cssWidth, cssHeight);
  ctx.save();
  ctx.translate(transform.x, transform.y);
  ctx.scale(transform.scale, transform.scale);
  ctx.fillStyle = "#06100d";
  ctx.fillRect(0, 0, board.width, board.height);
  const boardImage = loadBoardImage(board);
  if (boardImage) {
    ctx.drawImage(boardImage, 0, 0, board.width, board.height);
  }
  drawGrid(board);

  for (const piece of boardPieces()) {
    const isSelected = piece.id === selectedPieceId;
    const drawX = drag && drag.kind === "piece" && drag.pieceId === piece.id ? drag.x : piece.x;
    const drawY = drag && drag.kind === "piece" && drag.pieceId === piece.id ? drag.y : piece.y;
    const drawW = piece.width * piece.scale;
    const drawH = piece.height * piece.scale;
    const image = loadPieceImage(piece);
    ctx.fillStyle = piece.visibility === "PREVIEW" ? "#f2b84b" : "#5fd0a2";
    ctx.strokeStyle = isSelected ? "#ffffff" : "#0b1211";
    ctx.lineWidth = (isSelected ? 3 : 2) / transform.scale;
    ctx.beginPath();
    ctx.roundRect(drawX, drawY, drawW, drawH, Math.min(10, drawW / 3, drawH / 3));
    ctx.fill();
    if (image) {
      ctx.save();
      ctx.clip();
      ctx.drawImage(image, drawX, drawY, drawW, drawH);
      ctx.restore();
    }
    ctx.stroke();
    if (!image) {
      ctx.fillStyle = "#07100d";
      ctx.font = "700 13px system-ui";
      ctx.fillText(piece.name, drawX + 8, drawY + 22);
    }
  }
  ctx.restore();

  renderRail();
};

const PIP_SLOTS = {
  1: ["center"],
  2: ["top-left", "bottom-right"],
  3: ["top-left", "center", "bottom-right"],
  4: ["top-left", "top-right", "bottom-left", "bottom-right"],
  5: ["top-left", "top-right", "center", "bottom-left", "bottom-right"],
  6: ["top-left", "top-right", "middle-left", "middle-right", "bottom-left", "bottom-right"]
};

const d6Face = (value) => ((((Math.trunc(value) || 1) - 1) % 6) + 6) % 6 + 1;

const appendFaceValue = (face, value) => {
  const slots = PIP_SLOTS[value];
  if (!slots) {
    face.classList.add("numeric");
    face.textContent = String(value);
    return;
  }

  for (const slot of slots) {
    const pip = document.createElement("span");
    pip.className = "pip pip-" + slot;
    face.append(pip);
  }
};

const buildDie = (value, index) => {
  const base = d6Face(value);
  const die = document.createElement("div");
  die.className = "die rolling";
  die.setAttribute("aria-label", "Die result " + value);
  die.style.setProperty("--die-tilt-x", index % 2 === 0 ? "-22deg" : "-18deg");
  die.style.setProperty("--die-tilt-y", index % 2 === 0 ? "-34deg" : "-24deg");
  die.style.setProperty("--die-tilt-z", index % 2 === 0 ? "1deg" : "-4deg");
  const faces = [
    ["front", value],
    ["back", 7 - base],
    ["right", d6Face(base + 1)],
    ["left", d6Face(base + 3)],
    ["top", d6Face(base + 4)],
    ["bottom", d6Face(base + 2)]
  ];
  for (const [name, label] of faces) {
    const face = document.createElement("div");
    face.className = "face " + name;
    face.setAttribute("aria-hidden", "true");
    appendFaceValue(face, label);
    die.append(face);
  }
  return die;
};

const animateRoll = (roll) => {
  if (diceHideTimer) window.clearTimeout(diceHideTimer);
  els.diceOverlay.classList.add("visible");
  const revealAt = Date.parse(roll.revealAt || "");
  const timeUntilReveal = Number.isFinite(revealAt) ? revealAt - Date.now() : DICE_ROLL_ANIMATION_MS;
  const rollDuration = Math.max(500, Math.min(DICE_ROLL_ANIMATION_MS, timeUntilReveal));
  const row = document.createElement("div");
  row.className = "dice-row";
  roll.rolls.forEach((value, index) => {
    const die = buildDie(value, index);
    die.style.animationDuration = rollDuration + "ms";
    row.append(die);
  });
  const total = document.createElement("div");
  total.className = "roll-total";
  total.textContent = "Rolling...";
  row.append(total);
  els.diceStage.replaceChildren(row);
  setTimeout(() => {
    total.textContent = String(roll.total);
    for (const die of row.querySelectorAll(".die")) die.classList.remove("rolling");
  }, rollDuration);
  diceHideTimer = window.setTimeout(() => {
    els.diceOverlay.classList.remove("visible");
  }, Math.max(DICE_OVERLAY_VISIBLE_MS, rollDuration + 3600));
};

els.canvas.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  const screen = screenPoint(event);
  const point = canvasPoint(event);
  const piece = hitPiece(point);
  selectedPieceId = piece?.id || null;
  if (piece) {
    drag = {
      kind: "piece",
      pieceId: piece.id,
      offsetX: point.x - piece.x,
      offsetY: point.y - piece.y,
      x: piece.x,
      y: piece.y
    };
  } else {
    drag = {
      kind: "pan",
      pointerX: screen.x,
      pointerY: screen.y,
      panX: boardCamera.panX,
      panY: boardCamera.panY
    };
  }
  els.canvas.setPointerCapture(event.pointerId);
  render();
});

els.canvas.addEventListener("pointermove", (event) => {
  if (!drag) return;
  if (drag.kind === "pan") {
    const screen = screenPoint(event);
    boardCamera.panX = drag.panX + screen.x - drag.pointerX;
    boardCamera.panY = drag.panY + screen.y - drag.pointerY;
    render();
    return;
  }
  const point = canvasPoint(event);
  const next = clampPiecePosition(
    state?.pieces?.[drag.pieceId] || {width: 0, height: 0, scale: 1},
    point.x - drag.offsetX,
    point.y - drag.offsetY
  );
  drag.x = next.x;
  drag.y = next.y;
  render();
});

els.canvas.addEventListener("pointerup", async (event) => {
  if (!drag) return;
  const completed = drag;
  drag = null;
  releaseCanvasPointer(event.pointerId);
  if (completed.kind !== "piece" || !state) {
    render();
    return;
  }
  try {
    await sendCommand({
      type: "MovePiece",
      gameId: roomId,
      actorId,
      pieceId: completed.pieceId,
      x: Math.round(completed.x),
      y: Math.round(completed.y),
      expectedSeq: state.eventSeq
    });
  } catch (error) {
    setError(error.message);
  } finally {
    render();
  }
});

els.canvas.addEventListener("pointercancel", (event) => {
  drag = null;
  releaseCanvasPointer(event.pointerId);
  render();
});

els.canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  const zoomFactor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
  setCameraZoom(boardCamera.zoom * zoomFactor, screenPoint(event));
}, {passive: false});

els.roomForm.addEventListener("submit", (event) => {
  event.preventDefault();
  roomId = els.roomInput.value.trim() || DEFAULT_GAME_ID;
  actorId = els.userInput.value.trim() || DEFAULT_ACTOR_ID;
  const nextUrl = new URL(location.href);
  nextUrl.searchParams.set("game", roomId);
  nextUrl.searchParams.set("user", actorId);
  history.replaceState(null, "", nextUrl);
  firstStateApplied = false;
  latestDiceId = null;
  selectedPieceId = null;
  setSheetOpen(false);
  els.roomDialog.close();
  connectSocket();
  fetchState().catch((error) => setError(error.message));
});

els.menu.addEventListener("click", () => {
  els.roomDialog.showModal();
});

els.roomCancel.addEventListener("click", () => {
  els.roomDialog.close();
});

els.sheetButton.addEventListener("click", () => {
  if (!selectedPieceId && selectedPiece()) selectedPieceId = selectedPiece().id;
  setSheetOpen(!sheetOpen);
  render();
});

els.sheetClose.addEventListener("click", () => {
  setSheetOpen(false);
});

for (const tab of els.sheetTabs) {
  tab.addEventListener("click", () => {
    activeSheetTab = tab.dataset.sheetTab || "details";
    renderSheet();
  });
}

els.bootstrap.addEventListener("click", () => {
  bootstrapScene().catch((error) => setError(error.message));
});

els.refresh.addEventListener("click", () => {
  fetchState().catch((error) => setError(error.message));
});

els.createPiece.addEventListener("click", () => {
  createCustomPiece().catch((error) => setError(error.message));
});

els.pieceImageFileInput.addEventListener("change", () => {
  applyPieceFileDimensions().catch((error) => setError(error.message));
});

els.createBoard.addEventListener("click", () => {
  createCustomBoard().catch((error) => setError(error.message));
});

els.boardImageFileInput.addEventListener("change", () => {
  applyBoardFileDimensions().catch((error) => setError(error.message));
});

els.boardSelect.addEventListener("change", () => {
  const boardId = els.boardSelect.value;
  if (!boardId || boardId === selectedBoardId() || !canSelectBoards) return;
  selectedPieceId = null;
  drag = null;
  sendCommand({
    type: "SelectBoard",
    gameId: roomId,
    actorId,
    boardId
  }).catch((error) => {
    setError(error.message);
    render();
  });
});

els.zoomOut.addEventListener("click", () => {
  setCameraZoom(boardCamera.zoom / 1.25);
});

els.zoomReset.addEventListener("click", () => {
  resetBoardCamera();
  render();
});

els.zoomIn.addEventListener("click", () => {
  setCameraZoom(boardCamera.zoom * 1.25);
});

els.roll.addEventListener("click", () => {
  sendCommand({
    type: "RollDice",
    gameId: roomId,
    actorId,
    expression: els.diceExpression.value.trim() || "2d6",
    reason: "Table roll"
  }).catch((error) => setError(error.message));
});

window.addEventListener("resize", render);

connectSocket();
fetchState().catch((error) => setError(error.message));`

const CLIENT_MANIFEST = JSON.stringify(
  {
    name: 'Cepheus Online',
    short_name: 'Cepheus',
    description: 'A lightweight sci-fi tabletop for Cepheus Engine games.',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#020504',
    theme_color: '#020504',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any maskable'
      }
    ]
  },
  null,
  2
)

const CLIENT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#020504"/>
  <path d="M82 134h348v244H82z" fill="#06120f" stroke="#48ffad" stroke-width="14"/>
  <path d="M112 178h288M112 226h210M112 274h252M112 322h154" stroke="#f4fff8" stroke-width="18" stroke-linecap="round" opacity=".9"/>
  <circle cx="374" cy="322" r="38" fill="#48ffad"/>
  <path d="M356 322h36M374 304v36" stroke="#020504" stroke-width="12" stroke-linecap="round"/>
</svg>`

const CLIENT_SW = `const CACHE_NAME = "cepheus-online-shell-v2";
const SHELL_ASSETS = ["/", "/styles.css", "/client.js", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/rooms/")) return;
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request).then((response) => {
        if (!response.ok) return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) =>
        cached || caches.match("/")
      ))
  );
});`

const textResponse = (body: string, contentType: string): Response =>
  new Response(body, {
    headers: {
      'content-type': contentType
    }
  })

export const serveStaticClient = (pathname: string): Response | null => {
  switch (pathname) {
    case '/':
    case '/index.html':
      return textResponse(CLIENT_HTML, 'text/html; charset=utf-8')
    case '/styles.css':
      return textResponse(CLIENT_CSS, 'text/css; charset=utf-8')
    case '/client.js':
      return textResponse(CLIENT_JS, 'text/javascript; charset=utf-8')
    case '/manifest.webmanifest':
      return textResponse(CLIENT_MANIFEST, 'application/manifest+json')
    case '/icon.svg':
      return textResponse(CLIENT_ICON, 'image/svg+xml')
    case '/sw.js':
      return textResponse(CLIENT_SW, 'text/javascript; charset=utf-8')
    default:
      return null
  }
}
