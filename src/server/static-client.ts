const CLIENT_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Cepheus Online</title>
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
  --bg: #111516;
  --panel: #1c2323;
  --panel-2: #222b2a;
  --line: #33413f;
  --text: #eef4f1;
  --muted: #a6b4af;
  --accent: #5fd0a2;
  --accent-2: #f2b84b;
  --danger: #ff8f7a;
  --board: #253130;
}

* {
  box-sizing: border-box;
}

html,
body {
  min-height: 100%;
  margin: 0;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
    "Segoe UI", sans-serif;
}

button,
input {
  font: inherit;
}

button {
  min-height: 38px;
  border: 1px solid #3f514d;
  border-radius: 6px;
  background: #293432;
  color: var(--text);
  cursor: pointer;
  padding: 0 14px;
}

button:hover {
  border-color: var(--accent);
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

input {
  width: 100%;
  min-height: 38px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #121817;
  color: var(--text);
  padding: 0 10px;
}

.app-shell {
  min-height: 100vh;
  display: grid;
  grid-template-rows: auto auto 1fr;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--line);
  background: #171d1d;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 210px;
}

.brand-mark {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: var(--accent);
  color: #06110d;
  font-weight: 800;
}

h1,
p {
  margin: 0;
}

h1 {
  font-size: 18px;
  line-height: 1.1;
}

#connectionStatus,
.room-form span,
.dice-expression span {
  color: var(--muted);
  font-size: 12px;
}

.room-form {
  display: grid;
  grid-template-columns: minmax(130px, 180px) minmax(130px, 180px) auto;
  align-items: end;
  gap: 10px;
}

.room-form label,
.dice-expression {
  display: grid;
  gap: 4px;
}

.tool-row {
  display: flex;
  align-items: end;
  gap: 10px;
  padding: 12px 18px;
  border-bottom: 1px solid var(--line);
  background: var(--panel);
}

.dice-expression {
  width: 110px;
}

.error-text {
  min-height: 20px;
  color: var(--danger);
  font-size: 13px;
}

.play-surface {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 290px;
  min-height: 0;
}

.canvas-wrap {
  min-width: 0;
  min-height: 0;
  padding: 18px;
  background: #121716;
}

#boardCanvas {
  display: block;
  width: 100%;
  height: min(72vh, calc(100vh - 170px));
  min-height: 420px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--board);
  touch-action: none;
}

.side-panel {
  border-left: 1px solid var(--line);
  background: var(--panel);
  padding: 18px;
  overflow: auto;
}

.dice-stage {
  min-height: 190px;
  display: grid;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel-2);
  perspective: 900px;
  overflow: hidden;
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
  padding: 18px;
}

.die {
  width: 58px;
  height: 58px;
  position: relative;
  transform-style: preserve-3d;
  transform: rotateX(-24deg) rotateY(34deg);
}

.die.rolling {
  animation: tumble 900ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.face {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  border: 2px solid #0b1211;
  border-radius: 10px;
  background: #f1f6ef;
  color: #111516;
  font-weight: 800;
  font-size: 25px;
  box-shadow: inset 0 0 18px rgba(0, 0, 0, 0.18);
}

.face.front {
  transform: translateZ(29px);
}

.face.back {
  transform: rotateY(180deg) translateZ(29px);
}

.face.right {
  transform: rotateY(90deg) translateZ(29px);
}

.face.left {
  transform: rotateY(-90deg) translateZ(29px);
}

.face.top {
  transform: rotateX(90deg) translateZ(29px);
}

.face.bottom {
  transform: rotateX(-90deg) translateZ(29px);
}

.roll-total {
  width: 100%;
  text-align: center;
  color: var(--accent-2);
  font-weight: 800;
  font-size: 28px;
}

.dice-log {
  list-style: none;
  margin: 16px 0 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.dice-log li {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #171e1d;
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

@media (max-width: 760px) {
  .topbar,
  .tool-row {
    align-items: stretch;
    flex-direction: column;
  }

  .room-form {
    grid-template-columns: 1fr;
  }

  .play-surface {
    grid-template-columns: 1fr;
  }

  .side-panel {
    border-left: 0;
    border-top: 1px solid var(--line);
  }

  #boardCanvas {
    min-height: 340px;
  }
}`

const CLIENT_JS = `const DEFAULT_GAME_ID = "demo-room";
const DEFAULT_ACTOR_ID = "local-user";

const qs = new URLSearchParams(location.search);
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
    default:
      return null
  }
}
