// Candy Sweeper — classic Minesweeper with candies instead of mines
(function () {
  "use strict";

  const CANDY = "🍬";
  const CANDIES = ["🍬", "🍭", "🍫", "🍡", "🧁", "🍩"]; // random candy skin per mine, just for fun
  const FLAG = "🚩";

  const DIFFICULTIES = {
    easy:   { rows: 9,  cols: 9,  candies: 10 },
    medium: { rows: 16, cols: 16, candies: 40 },
    hard:   { rows: 16, cols: 30, candies: 99 },
  };

  const boardEl = document.getElementById("board");
  const candyCountEl = document.getElementById("candyCount");
  const timerEl = document.getElementById("timer");
  const faceBtn = document.getElementById("faceBtn");
  const newGameBtn = document.getElementById("newGameBtn");
  const difficultySelect = document.getElementById("difficulty");
  const overlay = document.getElementById("overlay");
  const overlayEmoji = document.getElementById("overlayEmoji");
  const overlayText = document.getElementById("overlayText");
  const overlayBtn = document.getElementById("overlayBtn");

  let rows, cols, totalCandies;
  let grid = [];           // grid[r][c] = { candy:bool, open:bool, flagged:bool, count:number, skin:string }
  let firstClickDone = false;
  let gameOver = false;
  let flagsPlaced = 0;
  let openedCount = 0;
  let timerInterval = null;
  let secondsElapsed = 0;

  function inBounds(r, c) {
    return r >= 0 && r < rows && c >= 0 && c < cols;
  }

  function neighbors(r, c) {
    const result = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (inBounds(nr, nc)) result.push([nr, nc]);
      }
    }
    return result;
  }

  function createEmptyGrid() {
    grid = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        row.push({ candy: false, open: false, flagged: false, count: 0, skin: CANDY });
      }
      grid.push(row);
    }
  }

  function placeCandies(excludeR, excludeC) {
    const forbidden = new Set();
    neighbors(excludeR, excludeC).forEach(([r, c]) => forbidden.add(r + "," + c));
    forbidden.add(excludeR + "," + excludeC);

    let placed = 0;
    while (placed < totalCandies) {
      const r = Math.floor(Math.random() * rows);
      const c = Math.floor(Math.random() * cols);
      const key = r + "," + c;
      if (forbidden.has(key) || grid[r][c].candy) continue;
      grid[r][c].candy = true;
      grid[r][c].skin = CANDIES[Math.floor(Math.random() * CANDIES.length)];
      placed++;
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c].candy) continue;
        grid[r][c].count = neighbors(r, c).filter(([nr, nc]) => grid[nr][nc].candy).length;
      }
    }
  }

  function startTimer() {
    stopTimer();
    secondsElapsed = 0;
    timerEl.textContent = "000";
    timerInterval = setInterval(() => {
      secondsElapsed++;
      if (secondsElapsed > 999) secondsElapsed = 999;
      timerEl.textContent = String(secondsElapsed).padStart(3, "0");
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function updateCandyCounter() {
    candyCountEl.textContent = String(Math.max(0, totalCandies - flagsPlaced)).padStart(3, "0");
  }

  function renderBoard() {
    boardEl.innerHTML = "";
    boardEl.style.gridTemplateColumns = `repeat(${cols}, 32px)`;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cellEl = document.createElement("div");
        cellEl.className = "cell";
        cellEl.dataset.r = r;
        cellEl.dataset.c = c;
        cellEl.addEventListener("click", onCellLeftClick);
        cellEl.addEventListener("contextmenu", onCellRightClick);
        // Mobile support: long-press places a flag (no right-click on touch devices)
        cellEl.addEventListener("touchstart", startLongPress, { passive: true });
        cellEl.addEventListener("touchend", onCellTouchEnd);
        cellEl.addEventListener("touchmove", cancelLongPress, { passive: true });
        boardEl.appendChild(cellEl);
      }
    }
  }

  // --- Mobile long-press => flag ---
  let longPressTimer = null;
  let longPressTriggered = false;
  const LONG_PRESS_MS = 450;

  function startLongPress(e) {
    const cellEl = e.currentTarget;
    longPressTriggered = false;
    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
      longPressTriggered = true;
      if (navigator.vibrate) navigator.vibrate(15);
      onCellRightClick({ preventDefault() {}, currentTarget: cellEl });
    }, LONG_PRESS_MS);
  }

  function cancelLongPress() {
    clearTimeout(longPressTimer);
  }

  function onCellTouchEnd(e) {
    cancelLongPress();
    if (longPressTriggered) {
      // Swallow the synthetic click that follows touchend after a long-press flag
      e.preventDefault();
    }
  }

  function cellElement(r, c) {
    return boardEl.children[r * cols + c];
  }

  function updateCellView(r, c) {
    const cell = grid[r][c];
    const el = cellElement(r, c);
    el.className = "cell";
    el.textContent = "";

    if (cell.flagged && !cell.open) {
      el.classList.add("flagged");
      el.textContent = FLAG;
      return;
    }

    if (!cell.open) return;

    el.classList.add("open");
    if (cell.candy) {
      el.classList.add(cell.exploded ? "candy-exploded" : "candy");
      el.textContent = cell.skin;
    } else if (cell.count > 0) {
      el.classList.add("n" + cell.count);
      el.textContent = cell.count;
    }
  }

  function openCell(r, c) {
    const cell = grid[r][c];
    if (cell.open || cell.flagged) return;
    cell.open = true;
    openedCount++;
    updateCellView(r, c);

    if (cell.candy) return; // handled by caller (game over)

    if (cell.count === 0) {
      neighbors(r, c).forEach(([nr, nc]) => {
        if (!grid[nr][nc].open && !grid[nr][nc].candy) openCell(nr, nc);
      });
    }
  }

  function revealAllCandies(explodedR, explodedC) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r][c];
        if (cell.candy && !cell.flagged) {
          cell.open = true;
          if (r === explodedR && c === explodedC) cell.exploded = true;
          updateCellView(r, c);
        }
        if (!cell.candy && cell.flagged) {
          // wrongly flagged cell — mark it
          const el = cellElement(r, c);
          el.textContent = "❌";
        }
      }
    }
  }

  function chordOpen(r, c) {
    // Classic "chord": clicking an already-open numbered cell whose flag count
    // matches its number opens all remaining (non-flagged) neighbors at once.
    const cell = grid[r][c];
    if (!cell.open || cell.count === 0) return;
    const neigh = neighbors(r, c);
    const flaggedCount = neigh.filter(([nr, nc]) => grid[nr][nc].flagged).length;
    if (flaggedCount !== cell.count) return;

    for (const [nr, nc] of neigh) {
      const n = grid[nr][nc];
      if (n.flagged || n.open) continue;
      if (n.candy) {
        n.open = true;
        updateCellView(nr, nc);
        endGame(false, nr, nc);
        return;
      }
      openCell(nr, nc);
    }
    checkWin();
  }

  function onCellLeftClick(e) {
    if (gameOver) return;
    const r = parseInt(e.currentTarget.dataset.r, 10);
    const c = parseInt(e.currentTarget.dataset.c, 10);
    const cell = grid[r][c];

    if (cell.open) {
      chordOpen(r, c);
      return;
    }
    if (cell.flagged) return;

    if (!firstClickDone) {
      firstClickDone = true;
      placeCandies(r, c);
      startTimer();
    }

    if (cell.candy) {
      cell.open = true;
      updateCellView(r, c);
      endGame(false, r, c);
      return;
    }

    openCell(r, c);
    checkWin();
  }

  function onCellRightClick(e) {
    e.preventDefault();
    if (gameOver) return;
    const r = parseInt(e.currentTarget.dataset.r, 10);
    const c = parseInt(e.currentTarget.dataset.c, 10);
    const cell = grid[r][c];
    if (cell.open) return;

    cell.flagged = !cell.flagged;
    flagsPlaced += cell.flagged ? 1 : -1;
    updateCandyCounter();
    updateCellView(r, c);
  }

  function checkWin() {
    const safeCells = rows * cols - totalCandies;
    if (openedCount >= safeCells) {
      endGame(true);
    }
  }

  function endGame(won, explodedR, explodedC) {
    gameOver = true;
    stopTimer();

    if (won) {
      // auto-flag remaining candies
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (grid[r][c].candy && !grid[r][c].flagged) {
            grid[r][c].flagged = true;
            updateCellView(r, c);
          }
        }
      }
      flagsPlaced = totalCandies;
      updateCandyCounter();
      faceBtn.textContent = "😎";
      showOverlay(true);
    } else {
      revealAllCandies(explodedR, explodedC);
      faceBtn.textContent = "😵";
      showOverlay(false);
    }
  }

  function showOverlay(won) {
    overlayEmoji.textContent = won ? "🎉" : "💥";
    overlayText.textContent = won
      ? "Победа! Все конфеты найдены!"
      : "Ой! Попался на конфету 🍬";
    overlay.classList.remove("hidden");
  }

  function hideOverlay() {
    overlay.classList.add("hidden");
  }

  function newGame() {
    const diff = DIFFICULTIES[difficultySelect.value];
    rows = diff.rows;
    cols = diff.cols;
    totalCandies = diff.candies;

    firstClickDone = false;
    gameOver = false;
    flagsPlaced = 0;
    openedCount = 0;

    stopTimer();
    timerEl.textContent = "000";
    faceBtn.textContent = "🙂";
    hideOverlay();

    createEmptyGrid();
    renderBoard();
    updateCandyCounter();
  }

  faceBtn.addEventListener("click", newGame);
  newGameBtn.addEventListener("click", newGame);
  difficultySelect.addEventListener("change", newGame);
  overlayBtn.addEventListener("click", newGame);

  newGame();

  // PWA: register service worker for offline play / installability.
  // Silently no-ops on file:// or http (SW requires https or localhost).
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }
})();
