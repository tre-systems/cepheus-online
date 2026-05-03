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
          <div id="initiativeRail" class="initiative-rail"></div>
          <div class="rail-tools" aria-label="Table tools">
            <button id="rollButton" class="rail-button" type="button" title="Roll dice" aria-label="Roll dice">2D</button>
            <button id="sheetButton" class="rail-button" type="button" title="Character sheet" aria-label="Character sheet">PC</button>
            <button id="menuButton" class="rail-button" type="button" title="Room menu" aria-label="Room menu">...</button>
          </div>
        </aside>

        <div class="board-frame">
          <canvas id="boardCanvas" width="1200" height="800"></canvas>
          <div class="board-hud">
            <div>
              <h1>Cepheus Online</h1>
              <p id="connectionStatus">Offline</p>
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
          <button class="sheet-tab active" type="button">Details</button>
          <button class="sheet-tab" type="button">Action</button>
          <button class="sheet-tab" type="button">Items</button>
          <button class="sheet-tab" type="button">Notes</button>
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
          <div class="dialog-actions">
            <button id="bootstrapButton" type="button">Bootstrap</button>
            <button id="refreshButton" type="button">Refresh</button>
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
  gap: 18px;
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
  animation: tumble 1650ms cubic-bezier(0.18, 0.86, 0.22, 1);
}

.face {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  border: 1px solid rgba(1, 8, 6, 0.96);
  border-radius: 9px;
  background:
    radial-gradient(circle at 30% 24%, #ffffff 0%, #f7fff9 26%, transparent 46%),
    linear-gradient(145deg, #ffffff 0%, #eef9f1 42%, #b9ddca 100%);
  color: #020504;
  overflow: hidden;
  font-weight: 900;
  font-size: 24px;
  box-shadow:
    inset 0 -12px 18px rgba(4, 18, 13, 0.2),
    inset 10px 0 18px rgba(255, 255, 255, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.92),
    0 14px 24px rgba(0, 0, 0, 0.26);
  backface-visibility: hidden;
}

.face::before {
  content: "";
  position: absolute;
  inset: 4px;
  border: 1px solid rgba(4, 18, 13, 0.13);
  border-radius: 7px;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.2),
    inset 0 -9px 12px rgba(4, 18, 13, 0.08);
  pointer-events: none;
}

.face::after {
  content: "";
  position: absolute;
  inset: 8px 12px auto 12px;
  height: 18px;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.64), transparent);
  opacity: 0.55;
  pointer-events: none;
}

.face.front {
  transform: translateZ(var(--die-depth));
}

.face.back {
  background:
    radial-gradient(circle at 30% 24%, #f1fff5 0%, transparent 44%),
    linear-gradient(145deg, #d2edda 0%, #92c5a5 100%);
  transform: rotateY(180deg) translateZ(var(--die-depth));
}

.face.right {
  background:
    radial-gradient(circle at 28% 24%, #e7fff0 0%, transparent 42%),
    linear-gradient(90deg, #caead5 0%, #75a78d 100%);
  transform: rotateY(90deg) translateZ(var(--die-depth));
}

.face.left {
  background:
    radial-gradient(circle at 28% 24%, #e7fff0 0%, transparent 42%),
    linear-gradient(270deg, #caead5 0%, #75a78d 100%);
  transform: rotateY(-90deg) translateZ(var(--die-depth));
}

.face.top {
  background:
    radial-gradient(circle at 30% 20%, #ffffff 0%, transparent 50%),
    linear-gradient(145deg, #ffffff 0%, #d9f5e5 100%);
  transform: rotateX(90deg) translateZ(var(--die-depth));
}

.face.bottom {
  background: linear-gradient(145deg, #a8d0b8 0%, #6f9f85 100%);
  transform: rotateX(-90deg) translateZ(var(--die-depth));
}

.pip {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background:
    radial-gradient(circle at 38% 30%, rgba(70, 93, 81, 0.85), #010302 62%);
  box-shadow:
    inset 0 1px 2px rgba(255, 255, 255, 0.18),
    inset 0 -2px 2px rgba(0, 0, 0, 0.58),
    0 1px 1px rgba(255, 255, 255, 0.18);
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
  grid-template-rows: auto minmax(0, 1fr) auto;
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

.board-hud .error-text {
  max-width: min(54vw, 320px);
  min-height: 0;
  padding: 6px 8px;
  border: 1px solid rgba(255, 119, 107, 0.4);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.68);
  font-weight: 700;
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
.dice-expression {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.room-form span,
.dice-expression span {
  color: var(--muted);
  font-size: 11px;
  font-weight: 760;
  text-transform: uppercase;
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
    transform: rotateX(var(--die-tilt-x)) rotateY(var(--die-tilt-y)) rotateZ(var(--die-tilt-z)) translateY(-10px) scale(0.96);
  }
  34% {
    transform: rotateX(calc(var(--die-tilt-x) - 24deg)) rotateY(calc(var(--die-tilt-y) - 34deg)) rotateZ(calc(var(--die-tilt-z) + 36deg)) translateY(4px) scale(1.04);
  }
  64% {
    transform: rotateX(calc(var(--die-tilt-x) + 18deg)) rotateY(calc(var(--die-tilt-y) + 22deg)) rotateZ(calc(var(--die-tilt-z) - 18deg)) translateY(-3px) scale(1.02);
  }
  82% {
    transform: rotateX(calc(var(--die-tilt-x) - 6deg)) rotateY(calc(var(--die-tilt-y) - 8deg)) rotateZ(calc(var(--die-tilt-z) + 5deg)) translateY(1px) scale(1);
  }
  100% {
    transform: rotateX(var(--die-tilt-x)) rotateY(var(--die-tilt-y)) rotateZ(var(--die-tilt-z)) translateY(0) scale(1);
  }
}

`

const CLIENT_JS = `const DEFAULT_GAME_ID = "demo-room";
const DEFAULT_ACTOR_ID = "local-user";
const DICE_ROLL_ANIMATION_MS = 1650;
const DICE_OVERLAY_VISIBLE_MS = 5400;

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
  roll: document.getElementById("rollButton"),
  diceExpression: document.getElementById("diceExpression"),
  error: document.getElementById("errorText"),
  canvas: document.getElementById("boardCanvas"),
  diceStage: document.getElementById("diceStage"),
  diceOverlay: document.getElementById("diceOverlay"),
  initiativeRail: document.getElementById("initiativeRail"),
  sheet: document.getElementById("characterSheet"),
  sheetButton: document.getElementById("sheetButton"),
  sheetClose: document.getElementById("sheetCloseButton"),
  sheetName: document.getElementById("sheetName"),
  sheetBody: document.getElementById("sheetBody"),
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
let selectedPieceId = null;
let sheetOpen = false;
let drag = null;
let requestCounter = 0;
let diceHideTimer = null;
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
const viewerQuery = () => "?viewer=player&user=" + encodeURIComponent(actorId);

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

const createPieceCommand = (boardId) => ({
  type: "CreatePiece",
  gameId: roomId,
  actorId,
  pieceId: "scout-1",
  boardId,
  name: "Scout",
  imageAssetId: null,
  x: 220,
  y: 180
});

const nextBootstrapCommand = () => {
  if (!state) return createGameCommand();
  const boardIds = Object.keys(state.boards || {});
  if (boardIds.length === 0) return createBoardCommand();
  if (Object.keys(state.pieces || {}).length === 0) {
    return createPieceCommand(state.selectedBoardId || boardIds[0]);
  }
  return null;
};

const bootstrapScene = async () => {
  setError("");
  for (let i = 0; i < 4; i++) {
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
  if (!state) return null;
  const boardId = state.selectedBoardId || Object.keys(state.boards)[0];
  return boardId ? state.boards[boardId] : null;
};

const boardPieces = () => {
  const board = selectedBoard();
  if (!state || !board) return [];
  return Object.values(state.pieces).filter((piece) => piece.boardId === board.id);
};

const pieceImageUrl = (piece) => {
  const imageAssetId = piece.imageAssetId || "";
  if (
    imageAssetId.startsWith("/") ||
    imageAssetId.startsWith("http://") ||
    imageAssetId.startsWith("https://") ||
    imageAssetId.startsWith("blob:") ||
    imageAssetId.startsWith("data:image/")
  ) {
    return imageAssetId;
  }
  return null;
};

const cssUrl = (url) => "url(" + JSON.stringify(url) + ")";

const loadPieceImage = (piece) => {
  const url = pieceImageUrl(piece);
  if (!url) return null;

  const cached = pieceImageCache.get(url);
  if (cached) {
    return cached.loaded && !cached.failed ? cached.image : null;
  }

  const image = new Image();
  image.decoding = "async";
  image.onload = () => {
    const cachedState = pieceImageCache.get(url);
    if (cachedState) cachedState.loaded = true;
    render();
  };
  image.onerror = () => {
    const cachedState = pieceImageCache.get(url);
    if (cachedState) cachedState.failed = true;
  };
  pieceImageCache.set(url, {image, loaded: false, failed: false});
  image.src = url;
  return null;
};

const canvasPoint = (event) => {
  const rect = els.canvas.getBoundingClientRect();
  const board = selectedBoard();
  const width = board?.width || 1200;
  const height = board?.height || 800;
  return {
    x: ((event.clientX - rect.left) / rect.width) * width,
    y: ((event.clientY - rect.top) / rect.height) * height
  };
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

const renderSheet = () => {
  const piece = selectedPiece();
  els.sheetName.textContent = piece?.name || "No piece";

  const body = document.createElement("div");
  body.className = "sheet-grid";
  if (!piece) {
    body.append(sheetRow("Status", "No active token"));
    body.append(sheetRow("Board", selectedBoard()?.name || "None"));
    els.sheetBody.replaceChildren(body);
    return;
  }

  const stats = document.createElement("div");
  stats.className = "stat-strip";
  for (const [label, value] of [["Str", 7], ["Dex", 8], ["End", 8], ["Int", 7], ["Edu", 9], ["Soc", 6]]) {
    const stat = document.createElement("div");
    stat.className = "stat";
    const name = document.createElement("b");
    name.textContent = label;
    const number = document.createElement("span");
    number.textContent = String(value);
    stat.append(name, number);
    stats.append(stat);
  }

  const chips = document.createElement("div");
  chips.className = "chip-list";
  for (const label of ["Vacc Suit-0", "Gun Combat-0", "Mechanic-0", "Recon-0"]) {
    const chip = document.createElement("span");
    chip.textContent = label;
    chips.append(chip);
  }

  body.append(
    sheetRow("Type", "PLAYER"),
    sheetRow("Position", Math.round(piece.x) + ", " + Math.round(piece.y)),
    sheetRow("Visibility", piece.visibility),
    stats,
    chips
  );
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

const drawGrid = (board, scaleX, scaleY) => {
  const grid = Math.max(25, board.scale || 50);
  ctx.strokeStyle = "rgba(238, 244, 241, 0.08)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= board.width; x += grid) {
    ctx.beginPath();
    ctx.moveTo(x * scaleX, 0);
    ctx.lineTo(x * scaleX, board.height * scaleY);
    ctx.stroke();
  }
  for (let y = 0; y <= board.height; y += grid) {
    ctx.beginPath();
    ctx.moveTo(0, y * scaleY);
    ctx.lineTo(board.width * scaleX, y * scaleY);
    ctx.stroke();
  }
};

const render = () => {
  const board = selectedBoard();
  const rect = els.canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = Math.max(1, Math.floor(rect.width));
  const cssHeight = Math.max(1, Math.floor(rect.height));
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

  const scaleX = cssWidth / board.width;
  const scaleY = cssHeight / board.height;
  ctx.fillStyle = "#253130";
  ctx.fillRect(0, 0, cssWidth, cssHeight);
  drawGrid(board, scaleX, scaleY);

  for (const piece of boardPieces()) {
    const isSelected = piece.id === selectedPieceId;
    const drawX = (drag && drag.pieceId === piece.id ? drag.x : piece.x) * scaleX;
    const drawY = (drag && drag.pieceId === piece.id ? drag.y : piece.y) * scaleY;
    const drawW = piece.width * piece.scale * scaleX;
    const drawH = piece.height * piece.scale * scaleY;
    const image = loadPieceImage(piece);
    ctx.fillStyle = piece.visibility === "PREVIEW" ? "#f2b84b" : "#5fd0a2";
    ctx.strokeStyle = isSelected ? "#ffffff" : "#0b1211";
    ctx.lineWidth = isSelected ? 3 : 2;
    ctx.beginPath();
    ctx.roundRect(drawX, drawY, drawW, drawH, 10);
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
  const row = document.createElement("div");
  row.className = "dice-row";
  roll.rolls.forEach((value, index) => row.append(buildDie(value, index)));
  const total = document.createElement("div");
  total.className = "roll-total";
  total.textContent = "Rolling...";
  row.append(total);
  els.diceStage.replaceChildren(row);
  setTimeout(() => {
    total.textContent = String(roll.total);
    for (const die of row.querySelectorAll(".die")) die.classList.remove("rolling");
  }, DICE_ROLL_ANIMATION_MS);
  diceHideTimer = window.setTimeout(() => {
    els.diceOverlay.classList.remove("visible");
  }, DICE_OVERLAY_VISIBLE_MS);
};

els.canvas.addEventListener("pointerdown", (event) => {
  const point = canvasPoint(event);
  const piece = hitPiece(point);
  selectedPieceId = piece?.id || null;
  if (piece) {
    drag = {
      pieceId: piece.id,
      offsetX: point.x - piece.x,
      offsetY: point.y - piece.y,
      x: piece.x,
      y: piece.y
    };
    els.canvas.setPointerCapture(event.pointerId);
  }
  render();
});

els.canvas.addEventListener("pointermove", (event) => {
  if (!drag) return;
  const point = canvasPoint(event);
  drag.x = Math.max(0, point.x - drag.offsetX);
  drag.y = Math.max(0, point.y - drag.offsetY);
  render();
});

els.canvas.addEventListener("pointerup", async (event) => {
  if (!drag || !state) return;
  const completed = drag;
  drag = null;
  els.canvas.releasePointerCapture(event.pointerId);
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

els.bootstrap.addEventListener("click", () => {
  bootstrapScene().catch((error) => setError(error.message));
});

els.refresh.addEventListener("click", () => {
  fetchState().catch((error) => setError(error.message));
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
