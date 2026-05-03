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
      <header class="topbar">
        <div class="brand">
          <span class="brand-mark">CO</span>
          <div>
            <h1>Cepheus Online</h1>
            <p id="connectionStatus">Offline</p>
          </div>
        </div>
        <form id="roomForm" class="room-form">
          <label>
            <span>Room</span>
            <input id="roomInput" name="room" autocomplete="off" spellcheck="false">
          </label>
          <label>
            <span>Traveller</span>
            <input id="userInput" name="user" autocomplete="off" spellcheck="false">
          </label>
          <button type="submit">Open</button>
        </form>
      </header>

      <section class="tool-row">
        <button id="bootstrapButton" type="button">Bootstrap Scene</button>
        <label class="dice-expression">
          <span>Dice</span>
          <input id="diceExpression" value="2d6" autocomplete="off" spellcheck="false">
        </label>
        <button id="rollButton" type="button">Roll</button>
        <button id="refreshButton" type="button">Refresh</button>
        <p id="errorText" class="error-text" role="status"></p>
      </section>

      <section class="play-surface">
        <div class="canvas-wrap">
          <canvas id="boardCanvas" width="1200" height="800"></canvas>
        </div>
        <aside class="side-panel">
          <div class="dice-stage" id="diceStage" aria-live="polite">
            <div class="dice-empty">No rolls yet</div>
          </div>
          <ol id="diceLog" class="dice-log"></ol>
        </aside>
      </section>
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
  min-height: 166px;
  display: grid;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 10px;
  background:
    radial-gradient(circle at 50% 0%, rgba(72, 255, 173, 0.16), transparent 58%),
    var(--panel-2);
  perspective: 900px;
  overflow: hidden;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.07);
}

.dice-empty {
  color: var(--muted);
  font-size: 14px;
}

.dice-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  padding: 16px;
}

.die {
  width: 56px;
  height: 56px;
  position: relative;
  transform-style: preserve-3d;
  transform: rotateX(-24deg) rotateY(34deg);
  filter: drop-shadow(0 18px 20px rgba(0, 0, 0, 0.45));
}

.die.rolling {
  animation: tumble 900ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.face {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  border: 2px solid #07100d;
  border-radius: 10px;
  background:
    linear-gradient(145deg, #ffffff, #d9f4e6);
  color: #020504;
  font-weight: 900;
  font-size: 24px;
  box-shadow:
    inset 0 0 18px rgba(0, 0, 0, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.face.front {
  transform: translateZ(28px);
}

.face.back {
  transform: rotateY(180deg) translateZ(28px);
}

.face.right {
  transform: rotateY(90deg) translateZ(28px);
}

.face.left {
  transform: rotateY(-90deg) translateZ(28px);
}

.face.top {
  transform: rotateX(90deg) translateZ(28px);
}

.face.bottom {
  transform: rotateX(-90deg) translateZ(28px);
}

.roll-total {
  width: 100%;
  text-align: center;
  color: var(--accent-2);
  font-weight: 900;
  font-size: 30px;
  text-shadow: 0 0 18px rgba(72, 255, 173, 0.42);
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

@keyframes tumble {
  0% {
    transform: rotateX(-24deg) rotateY(34deg) rotateZ(0deg) translateY(-8px);
  }
  50% {
    transform: rotateX(360deg) rotateY(270deg) rotateZ(120deg) translateY(2px);
  }
  100% {
    transform: rotateX(-24deg) rotateY(34deg) rotateZ(0deg) translateY(0);
  }
}

@media (max-width: 520px) {
  .topbar {
    padding-left: 10px;
    padding-right: 10px;
  }

  .room-form {
    grid-template-columns: 1fr 1fr;
  }

  .room-form button {
    grid-column: 1 / -1;
  }

  .tool-row {
    grid-template-columns: 1fr 92px 72px;
    padding-left: 10px;
    padding-right: 10px;
  }

  #refreshButton {
    grid-column: 1 / -1;
  }

  .canvas-wrap,
  .side-panel {
    padding-left: 10px;
    padding-right: 10px;
  }
}

@media (min-width: 840px) {
  .topbar {
    grid-template-columns: minmax(220px, 1fr) auto;
    align-items: center;
    padding: 14px 18px;
  }

  .room-form {
    min-width: 510px;
  }

  .play-surface {
    grid-template-columns: minmax(0, 1fr) 310px;
  }

  .canvas-wrap {
    padding: 18px;
  }

  #boardCanvas {
    height: min(72vh, calc(100vh - 170px));
    min-height: 430px;
  }

  .side-panel {
    border-top: 0;
    border-left: 1px solid var(--line);
    padding: 18px;
  }
}`

const CLIENT_JS = `const DEFAULT_GAME_ID = "demo-room";
const DEFAULT_ACTOR_ID = "local-user";

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
  diceLog: document.getElementById("diceLog")
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
let drag = null;
let requestCounter = 0;

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
    ctx.fillText("Open or bootstrap a room", 24, 34);
    renderDiceLog();
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
    ctx.fillStyle = piece.visibility === "PREVIEW" ? "#f2b84b" : "#5fd0a2";
    ctx.strokeStyle = isSelected ? "#ffffff" : "#0b1211";
    ctx.lineWidth = isSelected ? 3 : 2;
    ctx.beginPath();
    ctx.roundRect(drawX, drawY, drawW, drawH, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#07100d";
    ctx.font = "700 13px system-ui";
    ctx.fillText(piece.name, drawX + 8, drawY + 22);
  }

  renderDiceLog();
};

const renderDiceLog = () => {
  const rolls = [...(state?.diceLog || [])].slice(-8).reverse();
  els.diceLog.replaceChildren(...rolls.map((roll) => {
    const li = document.createElement("li");
    const title = document.createElement("strong");
    title.textContent = roll.expression + " = " + roll.total;
    const meta = document.createElement("span");
    meta.textContent = roll.reason + " · " + roll.rolls.join(", ");
    li.append(title, meta);
    return li;
  }));
};

const buildDie = (value) => {
  const die = document.createElement("div");
  die.className = "die rolling";
  const faces = [
    ["front", value],
    ["back", 7 - value],
    ["right", Math.max(1, ((value + 1) % 6) + 1)],
    ["left", Math.max(1, ((value + 3) % 6) + 1)],
    ["top", Math.max(1, ((value + 4) % 6) + 1)],
    ["bottom", Math.max(1, ((value + 2) % 6) + 1)]
  ];
  for (const [name, label] of faces) {
    const face = document.createElement("div");
    face.className = "face " + name;
    face.textContent = String(label);
    die.append(face);
  }
  return die;
};

const animateRoll = (roll) => {
  const row = document.createElement("div");
  row.className = "dice-row";
  for (const value of roll.rolls) row.append(buildDie(value));
  const total = document.createElement("div");
  total.className = "roll-total";
  total.textContent = "Rolling...";
  row.append(total);
  els.diceStage.replaceChildren(row);
  setTimeout(() => {
    total.textContent = String(roll.total);
    for (const die of row.querySelectorAll(".die")) die.classList.remove("rolling");
  }, 900);
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
  connectSocket();
  fetchState().catch((error) => setError(error.message));
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

const CLIENT_SW = `const CACHE_NAME = "cepheus-online-shell-v1";
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

  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached || fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
    )
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
