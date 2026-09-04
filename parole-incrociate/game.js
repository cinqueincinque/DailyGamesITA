// ==========================================================================
// PAROLE INCROCIATE - MOTORE DI GIOCO (game.js)
// Meccanica Betweenle: restrizione alfabetica binaria entro 15 tentativi.
// Indicatore termometrico verticale laterale (Opzione A) con precisione a 2 decimali.
// Statistiche e salvataggi indipendenti per lunghezza (4-8 lettere).
// ==========================================================================

(() => {
  "use strict";

  const MAX_ATTEMPTS = 15;
  const STORAGE_KEY_PREFIX = "parole_incrociate_save_day_";
  const STATS_KEY_PREFIX = "parole_incrociate_stats_len_";
  const SETTINGS_KEY = "parole_incrociate_settings";

  let selectedLength = 5;
  let targetWordData = null;
  let targetWord = "";

  let boundBefore = "";
  let boundAfter = "";
  let attemptsHistory = [];
  let currentInput = "";

  let isGameOver = false;
  let isGameWon = false;
  let isResetting = false;

  let activeDictionary = [];
  let calendarViewDate = new Date();

  // Riferimenti DOM
  const appLoader = document.getElementById("app-loader");
  const gameTag = document.getElementById("game-tag");
  const attemptsCountText = document.getElementById("attempts-count-text");
  const attemptsDotsContainer = document.getElementById("attempts-dots");
  const rangeHintText = document.getElementById("range-hint-text");

  const boundBeforeRow = document.getElementById("bound-before-row");
  const boundAfterRow = document.getElementById("bound-after-row");
  const currentInputRow = document.getElementById("current-input-row");
  const keyboardElem = document.getElementById("keyboard");
  const toastContainer = document.getElementById("toast-container");
  const lengthSelector = document.getElementById("length-selector");

  // Sezione Prossimità Verticale Laterale (Opzione A)
  const proximityAside = document.getElementById("proximity-vertical-aside");
  const pctBeforeElem = document.getElementById("pct-before");
  const countBeforeElem = document.getElementById("count-before");
  const pctAfterElem = document.getElementById("pct-after");
  const countAfterElem = document.getElementById("count-after");
  const wordsBetweenCountElem = document.getElementById("words-between-count");
  const proximityFillTop = document.getElementById("proximity-fill-top");
  const proximityFillBottom = document.getElementById("proximity-fill-bottom");
  const proximityThumbV = document.getElementById("proximity-thumb-v");

  // Modali e Pulsanti
  const modalHelp = document.getElementById("modal-help");
  const modalStats = document.getElementById("modal-stats");
  const modalSettings = document.getElementById("modal-settings");
  const modalCalendar = document.getElementById("modal-calendar");

  const btnHelp = document.getElementById("btn-help");
  const btnStats = document.getElementById("btn-stats");
  const btnSettings = document.getElementById("btn-settings");
  const btnOpenCalendar = document.getElementById("btn-open-calendar");

  // Statistiche
  const modalStatsTitle = modalStats ? modalStats.querySelector(".modal-header h2") : null;
  const statPlayedElem = document.getElementById("stat-played");
  const statWinPctElem = document.getElementById("stat-win-pct");
  const statStreakElem = document.getElementById("stat-streak");
  const statBestAttemptsElem = document.getElementById("stat-best-attempts");
  const gameResultBanner = document.getElementById("game-result-banner");
  const distChart = document.getElementById("dist-chart");
  const solutionsReveal = document.getElementById("solutions-reveal");
  const solutionsList = document.getElementById("solutions-list");
  const shareSection = document.getElementById("share-section");
  const btnShare = document.getElementById("btn-share");

  // Calendario
  const calendarMonthLabel = document.getElementById("calendar-month-label");
  const calendarGrid = document.getElementById("calendar-grid");
  const btnPrevMonth = document.getElementById("btn-prev-month");
  const btnNextMonth = document.getElementById("btn-next-month");
  const dayDetailBox = document.getElementById("day-detail-box");
  const dayDetailTitle = document.getElementById("day-detail-title");
  const dayDetailStatus = document.getElementById("day-detail-status");
  const dayDetailWords = document.getElementById("day-detail-words");

  // Impostazioni
  const btnResetStats = document.getElementById("btn-reset-stats");

  function trackEvent(name, params = {}) {
    if (typeof window.gtag === "function") {
      window.gtag("event", name, params);
    }
  }

  function showToast(msg) {
    if (!toastContainer) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = msg;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 2200);
  }

  function formatNumber(num) {
    return Number(num).toLocaleString("it-IT");
  }

  // --- CARICAMENTO DIZIONARIO ESTESO CONDIVISO (DA 5in5) ---
  async function resolveGlobalDictionary() {
    if (typeof DICTIONARY !== "undefined" && Array.isArray(DICTIONARY) && DICTIONARY.length > 0) {
      return DICTIONARY;
    }
    if (typeof window.DICTIONARY !== "undefined" && Array.isArray(window.DICTIONARY) && window.DICTIONARY.length > 0) {
      return window.DICTIONARY;
    }

    try {
      const res = await fetch("../5in5/dictionary.json");
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json)) return json;
      }
    } catch (e) {
      console.warn("Dizionario JSON non raggiungibile via fetch:", e);
    }

    return [];
  }

  async function buildActiveDictionary(length) {
    const wordSet = new Set();
    const globalDict = await resolveGlobalDictionary();

    for (let i = 0; i < globalDict.length; i++) {
      const w = globalDict[i];
      if (w && w.length === length) {
        wordSet.add(w.trim().toUpperCase());
      }
    }

    if (typeof PAROLE_INCROCIATE_WORDS !== "undefined" && PAROLE_INCROCIATE_WORDS[length]) {
      PAROLE_INCROCIATE_WORDS[length].forEach((w) => wordSet.add(w.trim().toUpperCase()));
    }

    activeDictionary = Array.from(wordSet);
    activeDictionary.sort((a, b) => a.localeCompare(b, "it"));
  }

  function binarySearchIndex(arr, val) {
    let low = 0;
    let high = arr.length - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      const cmp = arr[mid].localeCompare(val, "it");
      if (cmp < 0) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return low;
  }

  function isWordInVocab(word) {
    const idx = binarySearchIndex(activeDictionary, word);
    return idx < activeDictionary.length && activeDictionary[idx] === word;
  }

  // --- AGGIORNAMENTO TERMOMETRO VERTICALE LATERALE (OPZIONE A) ---
  function updateProximityDisplay() {
    if (!proximityAside) return;

    if (attemptsHistory.length === 0 || (isGameOver && isGameWon)) {
      proximityAside.classList.add("hidden");
      return;
    }

    const idxBefore = binarySearchIndex(activeDictionary, boundBefore);
    const idxAfter = binarySearchIndex(activeDictionary, boundAfter);
    const idxTarget = binarySearchIndex(activeDictionary, targetWord);

    const countLeft = Math.max(0, idxTarget - idxBefore);
    const countRight = Math.max(0, idxAfter - idxTarget - 1);
    const totalRemaining = Math.max(0, idxAfter - idxBefore - 1);
    const totalVocab = Math.max(1, activeDictionary.length);

    // Percentuali calcolate sulla dimensione totale del dizionario
    const pctBeforeGlobal = (countLeft / totalVocab) * 100;
    const pctAfterGlobal = (countRight / totalVocab) * 100;

    // Posizione del cursore verticale lungo il binario (0% in alto = vicino a ▲, 100% in basso = vicino a ▼)
    let thumbPosition = 50.0;
    const localDiff = countLeft + countRight;
    if (localDiff > 0) {
      thumbPosition = (countLeft / localDiff) * 100;
    }

    if (pctBeforeElem) pctBeforeElem.textContent = `▲ ${pctBeforeGlobal.toFixed(2)}%`;
    if (countBeforeElem) countBeforeElem.textContent = `(${formatNumber(countLeft)})`;

    if (pctAfterElem) pctAfterElem.textContent = `${pctAfterGlobal.toFixed(2)}% ▼`;
    if (countAfterElem) countAfterElem.textContent = `(${formatNumber(countRight)})`;

    if (wordsBetweenCountElem) {
      wordsBetweenCountElem.textContent = `${formatNumber(totalRemaining)} residue`;
    }

    if (proximityFillTop) proximityFillTop.style.height = `${thumbPosition}%`;
    if (proximityFillBottom) proximityFillBottom.style.height = `${100 - thumbPosition}%`;
    if (proximityThumbV) proximityThumbV.style.top = `${thumbPosition}%`;

    proximityAside.classList.remove("hidden");
  }

  // --- INIZIALIZZAZIONE ---
  async function init() {
    loadSettings();
    await buildActiveDictionary(selectedLength);

    loadPuzzleForLength();
    setupEventListeners();

    if (appLoader) {
      appLoader.classList.add("hidden");
    }

    if (!localStorage.getItem("parole_incrociate_seen_help")) {
      openModal(modalHelp);
      localStorage.setItem("parole_incrociate_seen_help", "true");
    }
  }

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
      if (saved && saved.wordLength) {
        selectedLength = Number(saved.wordLength);
      }
    } catch {
      selectedLength = 5;
    }
    updateLengthSelectorUI();
  }

  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ wordLength: selectedLength }));
  }

  function updateLengthSelectorUI() {
    if (!lengthSelector) return;
    lengthSelector.querySelectorAll(".length-btn").forEach((btn) => {
      const len = Number(btn.dataset.length);
      btn.classList.toggle("active", len === selectedLength);
    });
  }

  function getInitialBoundBefore(len) {
    return "A".repeat(len);
  }

  function getInitialBoundAfter(len) {
    return "Z".repeat(len);
  }

  function loadPuzzleForLength() {
    targetWordData = getDailyWord(selectedLength);
    targetWord = targetWordData.word;

    if (gameTag) {
      gameTag.textContent = `GIORNO #${targetWordData.dayNumber} • ${selectedLength} LETTERE`;
    }

    boundBefore = getInitialBoundBefore(selectedLength);
    boundAfter = getInitialBoundAfter(selectedLength);
    attemptsHistory = [];
    currentInput = "";
    isGameOver = false;
    isGameWon = false;

    loadSavedGame();
    renderAttemptsDots();
    renderBoard();
    updateInputDisplay();
    updateStatusBar();
    updateProximityDisplay();

    if (isGameOver) {
      ensureGameRecorded();
    }
  }

  function renderAttemptsDots() {
    if (!attemptsDotsContainer) return;
    attemptsDotsContainer.innerHTML = "";
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const dot = document.createElement("div");
      dot.className = "attempt-dot";
      if (i < attemptsHistory.length) {
        if (isGameOver && isGameWon && i === attemptsHistory.length - 1) {
          dot.classList.add("win");
        } else {
          dot.classList.add("used");
        }
      } else if (isGameOver && !isGameWon && i === attemptsHistory.length) {
        dot.classList.add("fail");
      }
      attemptsDotsContainer.appendChild(dot);
    }
  }

  function renderRowLetters(rowElem, wordStr) {
    if (!rowElem) return;
    rowElem.innerHTML = "";
    rowElem.style.gridTemplateColumns = `repeat(${selectedLength}, 1fr)`;

    for (let i = 0; i < selectedLength; i++) {
      const cell = document.createElement("div");
      cell.className = "letter-cell";
      cell.textContent = wordStr[i] || "";
      rowElem.appendChild(cell);
    }
  }

  function renderBoard() {
    renderRowLetters(boundBeforeRow, boundBefore);
    renderRowLetters(boundAfterRow, boundAfter);
  }

  function updateInputDisplay() {
    if (!currentInputRow) return;
    currentInputRow.innerHTML = "";
    currentInputRow.style.gridTemplateColumns = `repeat(${selectedLength}, 1fr)`;

    for (let i = 0; i < selectedLength; i++) {
      const cell = document.createElement("div");
      cell.className = "letter-cell";
      const letter = currentInput[i] || "";
      cell.textContent = letter;

      if (letter) {
        cell.classList.add("filled");
      }
      if (isGameOver && isGameWon) {
        cell.classList.add("correct");
      }

      currentInputRow.appendChild(cell);
    }
  }

  function updateStatusBar() {
    if (attemptsCountText) {
      attemptsCountText.textContent = attemptsHistory.length;
    }
    if (rangeHintText) {
      if (isGameOver) {
        rangeHintText.textContent = isGameWon ? "Parola trovata! 🏆" : "Tentativi esauriti! 💀";
      } else {
        const remaining = MAX_ATTEMPTS - attemptsHistory.length;
        rangeHintText.textContent = `${remaining} ${remaining === 1 ? "tentativo rimasto" : "tentativi rimasti"}`;
      }
    }
  }

  function handleKeyPress(key) {
    if (isGameOver || isResetting) return;

    if (key === "BACKSPACE") {
      if (currentInput.length > 0) {
        currentInput = currentInput.slice(0, -1);
        updateInputDisplay();
      }
    } else if (key === "ENTER") {
      handleSubmitAttempt();
    } else if (/^[A-Z]$/.test(key)) {
      if (currentInput.length < selectedLength) {
        currentInput += key;
        updateInputDisplay();
      }
    }
  }

  function triggerShake() {
    if (!currentInputRow) return;
    currentInputRow.classList.remove("shake");
    void currentInputRow.offsetWidth;
    currentInputRow.classList.add("shake");
  }

  function handleSubmitAttempt() {
    if (currentInput.length !== selectedLength) {
      showToast(`Inserisci una parola di ${selectedLength} lettere`);
      triggerShake();
      return;
    }

    const candidate = currentInput.toUpperCase();

    if (!isWordInVocab(candidate)) {
      showToast("Parola non presente nel dizionario");
      triggerShake();
      return;
    }

    if (candidate.localeCompare(boundBefore, "it") <= 0) {
      showToast(`Deve venire DOPO "${boundBefore}"!`);
      triggerShake();
      return;
    }

    if (candidate.localeCompare(boundAfter, "it") >= 0) {
      showToast(`Deve venire PRIMA di "${boundAfter}"!`);
      triggerShake();
      return;
    }

    attemptsHistory.push(candidate);

    if (candidate === targetWord) {
      handleVictory();
      return;
    }

    if (candidate.localeCompare(targetWord, "it") < 0) {
      boundBefore = candidate;
      showToast(`"${candidate}" viene prima ▲`);
      if (boundBeforeRow) {
        boundBeforeRow.classList.remove("highlight-up");
        void boundBeforeRow.offsetWidth;
        boundBeforeRow.classList.add("highlight-up");
      }
    } else {
      boundAfter = candidate;
      showToast(`"${candidate}" viene dopo ▼`);
      if (boundAfterRow) {
        boundAfterRow.classList.remove("highlight-down");
        void boundAfterRow.offsetWidth;
        boundAfterRow.classList.add("highlight-down");
      }
    }

    currentInput = "";
    renderBoard();
    updateInputDisplay();
    renderAttemptsDots();
    updateStatusBar();
    updateProximityDisplay();

    if (attemptsHistory.length >= MAX_ATTEMPTS) {
      handleDefeat();
    } else {
      saveGameState();
    }
  }

  function handleVictory() {
    isGameOver = true;
    isGameWon = true;

    renderBoard();
    updateInputDisplay();
    renderAttemptsDots();
    updateStatusBar();
    if (proximityAside) proximityAside.classList.add("hidden");
    saveGameState();

    const updatedStats = saveGameStats(true, attemptsHistory.length);

    trackEvent("partita_terminata_parole_incrociate", {
      day_number: targetWordData.dayNumber,
      lunghezza_parola: selectedLength,
      esito: "vittoria",
      tentativi: attemptsHistory.length
    });

    showToast(`Fantastico! Trovata in ${attemptsHistory.length} tentativi! 🏆`);

    setTimeout(() => {
      openEndGameModal(true, updatedStats);
    }, 600);
  }

  function handleDefeat() {
    isGameOver = true;
    isGameWon = false;

    currentInput = targetWord;
    updateInputDisplay();
    renderAttemptsDots();
    updateStatusBar();
    if (proximityAside) proximityAside.classList.add("hidden");
    saveGameState();

    const updatedStats = saveGameStats(false, attemptsHistory.length);

    trackEvent("partita_terminata_parole_incrociate", {
      day_number: targetWordData.dayNumber,
      lunghezza_parola: selectedLength,
      esito: "sconfitta",
      tentativi: attemptsHistory.length
    });

    showToast(`Tentativi esauriti! La parola era "${targetWord}" 💀`);

    setTimeout(() => {
      openEndGameModal(false, updatedStats);
    }, 800);
  }

  function getStorageKey() {
    return `${STORAGE_KEY_PREFIX}${targetWordData.dayNumber}_len_${selectedLength}`;
  }

  function getStatsKey(len = selectedLength) {
    return `${STATS_KEY_PREFIX}${len}`;
  }

  function saveGameState() {
    if (isResetting) return;
    const state = {
      dayNumber: targetWordData.dayNumber,
      wordLength: selectedLength,
      boundBefore,
      boundAfter,
      attemptsHistory,
      isGameOver,
      isGameWon
    };
    localStorage.setItem(getStorageKey(), JSON.stringify(state));
  }

  function loadSavedGame() {
    try {
      const saved = localStorage.getItem(getStorageKey());
      if (!saved) return;
      const state = JSON.parse(saved);
      if (state.dayNumber !== targetWordData.dayNumber || state.wordLength !== selectedLength) return;

      boundBefore = state.boundBefore || getInitialBoundBefore(selectedLength);
      boundAfter = state.boundAfter || getInitialBoundAfter(selectedLength);
      attemptsHistory = state.attemptsHistory || [];
      isGameOver = state.isGameOver || false;
      isGameWon = state.isGameWon || false;

      if (isGameOver) {
        currentInput = targetWord;
        setTimeout(() => {
          openEndGameModal(isGameWon);
        }, 400);
      }
    } catch (e) {
      console.error("Errore ripristino salvataggio:", e);
    }
  }

  function getStats(len = selectedLength) {
    const defaultStats = {
      played: 0,
      wins: 0,
      currentStreak: 0,
      maxStreak: 0,
      bestAttempts: null,
      lastPlayedDay: null,
      guessesDistribution: {
        1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0,
        9: 0, 10: 0, 11: 0, 12: 0, 13: 0, 14: 0, 15: 0
      },
      history: {}
    };

    try {
      const saved = localStorage.getItem(getStatsKey(len));
      if (!saved) return defaultStats;
      const parsed = JSON.parse(saved);
      return {
        ...defaultStats,
        ...parsed,
        guessesDistribution: { ...defaultStats.guessesDistribution, ...(parsed.guessesDistribution || {}) },
        history: { ...(parsed.history || {}) }
      };
    } catch {
      return defaultStats;
    }
  }

  function saveGameStats(won, attemptsCount) {
    if (isResetting) return;
    const stats = getStats(selectedLength);
    const day = targetWordData.dayNumber;
    const todayISO = new Date().toISOString().slice(0, 10);

    const alreadyRecorded = stats.history && stats.history[todayISO];

    if (!alreadyRecorded) {
      stats.played++;
      if (won) {
        stats.wins++;
        stats.currentStreak++;
        if (stats.currentStreak > stats.maxStreak) {
          stats.maxStreak = stats.currentStreak;
        }
        if (stats.bestAttempts === null || attemptsCount < stats.bestAttempts) {
          stats.bestAttempts = attemptsCount;
        }
        if (stats.guessesDistribution[attemptsCount] !== undefined) {
          stats.guessesDistribution[attemptsCount]++;
        }
      } else {
        stats.currentStreak = 0;
      }
      stats.lastPlayedDay = day;

      stats.history[todayISO] = {
        dayNumber: day,
        dateISO: todayISO,
        wordLength: selectedLength,
        won: won,
        attemptsCount: attemptsCount,
        targetWord: targetWord,
        attempts: [...attemptsHistory]
      };

      localStorage.setItem(getStatsKey(selectedLength), JSON.stringify(stats));
    }

    return stats;
  }

  function ensureGameRecorded() {
    if (!isGameOver || isResetting) return;
    const stats = getStats(selectedLength);
    const todayISO = new Date().toISOString().slice(0, 10);
    if (!stats.history || !stats.history[todayISO] || stats.played === 0) {
      saveGameStats(isGameWon, attemptsHistory.length);
    }
  }

  function resetAllStats() {
    const confirmReset = window.confirm(
      `Vuoi azzerare le statistiche e la partita di oggi per la variante da ${selectedLength} lettere?\nPotrai rigiocare la sfida da zero.`
    );
    if (!confirmReset) return;

    isResetting = true;
    localStorage.removeItem(getStatsKey(selectedLength));
    localStorage.removeItem(getStorageKey());

    showToast(`Dati azzerati per ${selectedLength} lettere! 🗑️`);
    closeModal(modalSettings);

    setTimeout(() => {
      window.location.reload();
    }, 400);
  }

  function updateStatsModalView(stats, currentAttemptWon = null) {
    if (modalStatsTitle) {
      modalStatsTitle.textContent = `Statistiche (${selectedLength} lettere)`;
    }

    const played = stats.played || 0;
    const wins = stats.wins || 0;
    const winPct = played > 0 ? Math.round((wins / played) * 100) : 0;

    if (statPlayedElem) statPlayedElem.textContent = formatNumber(played);
    if (statWinPctElem) statWinPctElem.textContent = `${winPct}%`;
    if (statStreakElem) statStreakElem.innerHTML = `${formatNumber(stats.currentStreak || 0)} <span class="fire-icon">🔥</span>`;
    if (statBestAttemptsElem) statBestAttemptsElem.textContent = stats.bestAttempts ? `${stats.bestAttempts} tent.` : "-";

    renderDistributionChart(stats, currentAttemptWon);

    if (isGameOver) {
      if (gameResultBanner) {
        gameResultBanner.classList.remove("hidden", "win", "loss");
        if (isGameWon) {
          gameResultBanner.classList.add("win");
          gameResultBanner.textContent = `Vittoria in ${attemptsHistory.length} tentativi! 🏆`;
        } else {
          gameResultBanner.classList.add("loss");
          gameResultBanner.textContent = `Tentativi esauriti! Parola: ${targetWord} 💀`;
        }
      }

      if (solutionsList) {
        solutionsList.innerHTML = "";
        const tag = document.createElement("span");
        tag.className = "solution-tag";
        tag.textContent = targetWord;
        solutionsList.appendChild(tag);
      }
      if (solutionsReveal) solutionsReveal.classList.remove("hidden");
      if (shareSection) shareSection.classList.remove("hidden");
    } else {
      if (gameResultBanner) {
        gameResultBanner.className = "result-banner hidden";
      }
      if (solutionsReveal) solutionsReveal.classList.add("hidden");
      if (shareSection) shareSection.classList.add("hidden");
    }
  }

  function renderDistributionChart(stats, currentAttemptWon) {
    if (!distChart) return;
    distChart.innerHTML = "";

    const dist = stats.guessesDistribution || {};
    const maxVal = Math.max(...Object.values(dist), 1);

    for (let i = 1; i <= MAX_ATTEMPTS; i++) {
      const count = dist[i] || 0;
      const percentage = Math.max(8, Math.round((count / maxVal) * 100));

      const row = document.createElement("div");
      row.className = "dist-row";

      const label = document.createElement("span");
      label.className = "dist-label";
      label.textContent = i;

      const track = document.createElement("div");
      track.className = "dist-bar-track";

      const bar = document.createElement("div");
      bar.className = "dist-bar";
      bar.style.width = `${percentage}%`;
      bar.textContent = count;

      if (isGameWon && currentAttemptWon === i) {
        bar.classList.add("highlight");
      }

      track.appendChild(bar);
      row.appendChild(label);
      row.appendChild(track);
      distChart.appendChild(row);
    }
  }

  function renderCalendar() {
    if (!calendarGrid || !calendarMonthLabel) return;
    calendarGrid.innerHTML = "";
    if (dayDetailBox) dayDetailBox.classList.add("hidden");

    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();

    const monthNames = [
      "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
      "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
    ];
    calendarMonthLabel.textContent = `${monthNames[month]} ${year} (${selectedLength} lett.)`;

    const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7;
    const totalDays = new Date(year, month + 1, 0).getDate();

    const stats = getStats(selectedLength);
    const history = stats.history || {};
    const todayISO = new Date().toISOString().slice(0, 10);

    for (let i = 0; i < firstDayIndex; i++) {
      const emptyDiv = document.createElement("div");
      emptyDiv.className = "cal-day empty";
      calendarGrid.appendChild(emptyDiv);
    }

    for (let day = 1; day <= totalDays; day++) {
      const dayDiv = document.createElement("div");
      dayDiv.className = "cal-day";
      dayDiv.textContent = day;

      const currentDayISO = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      if (currentDayISO === todayISO) {
        dayDiv.classList.add("today");
      }

      if (history[currentDayISO]) {
        const record = history[currentDayISO];
        dayDiv.classList.add("has-game");
        dayDiv.classList.add(record.won ? "played-win" : "played-loss");

        dayDiv.addEventListener("click", () => {
          document.querySelectorAll(".cal-day").forEach((d) => d.classList.remove("selected-day"));
          dayDiv.classList.add("selected-day");
          showDayDetail(currentDayISO, record);
        });
      }

      calendarGrid.appendChild(dayDiv);
    }
  }

  function showDayDetail(dateStr, record) {
    if (!dayDetailBox) return;
    dayDetailBox.classList.remove("hidden");

    const parts = dateStr.split("-");
    dayDetailTitle.textContent = `Partita del ${parts[2]}/${parts[1]}/${parts[0]} - Giorno #${record.dayNumber} (${selectedLength} lettere)`;

    if (record.won) {
      dayDetailStatus.innerHTML = `Esito: <strong style="color:var(--color-green)">Vittoria in ${record.attemptsCount}/15 tentativi 🏆</strong>`;
    } else {
      dayDetailStatus.innerHTML = `Esito: <strong style="color:var(--color-fail)">Tentativi esauriti 💀</strong>`;
    }

    dayDetailWords.innerHTML = "";
    const span = document.createElement("span");
    span.className = "solution-tag";
    span.textContent = `Parola: ${record.targetWord || targetWord}`;
    dayDetailWords.appendChild(span);
  }

  function openModal(modal) {
    if (modal) modal.classList.remove("hidden");
  }

  function closeModal(modal) {
    if (modal) modal.classList.add("hidden");
  }

  function openEndGameModal(won, freshStats = null) {
    const stats = freshStats || getStats(selectedLength);
    updateStatsModalView(stats, won ? attemptsHistory.length : null);
    openModal(modalStats);
  }

  function generateShareText() {
    let text = `Parole Incrociate • Giorno #${targetWordData.dayNumber} (${selectedLength} lettere)\n`;
    text += isGameWon ? `Risolto in ${attemptsHistory.length}/15 tentativi! 🔤🏆\n\n` : `X/15 tentativi 💀\n\n`;

    const dots = attemptsHistory
      .map((_, i) => {
        if (isGameWon && i === attemptsHistory.length - 1) return "🟩";
        return "🟨";
      })
      .join("");

    text += `${dots}\n\n`;
    text += `https://daily-games-ita.vercel.app/parole-incrociate/`;
    return text;
  }

  function setupEventListeners() {
    if (lengthSelector) {
      lengthSelector.addEventListener("click", (e) => {
        const btn = e.target.closest(".length-btn");
        if (!btn) return;
        const newLen = Number(btn.dataset.length);
        if (newLen && newLen !== selectedLength) {
          selectedLength = newLen;
          saveSettings();
          updateLengthSelectorUI();

          if (appLoader) appLoader.classList.remove("hidden");

          setTimeout(async () => {
            await buildActiveDictionary(selectedLength);
            loadPuzzleForLength();
            if (appLoader) appLoader.classList.add("hidden");
            showToast(`Variante: ${selectedLength} lettere! 📏`);
            trackEvent("cambio_lunghezza_parole_incrociate", { nuova_lunghezza: selectedLength });
          }, 120);
        }
      });
    }

    if (keyboardElem) {
      keyboardElem.addEventListener("click", (e) => {
        const target = e.target.closest(".key-btn");
        if (!target) return;
        const key = target.dataset.key;
        if (key) handleKeyPress(key);
      });
    }

    window.addEventListener("keydown", (e) => {
      if (isGameOver || isResetting) return;
      if (e.key === "Enter") {
        handleKeyPress("ENTER");
      } else if (e.key === "Backspace") {
        handleKeyPress("BACKSPACE");
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        handleKeyPress(e.key.toUpperCase());
      }
    });

    if (btnHelp) btnHelp.addEventListener("click", () => openModal(modalHelp));

    if (btnStats) {
      btnStats.addEventListener("click", () => {
        ensureGameRecorded();
        const stats = getStats(selectedLength);
        updateStatsModalView(stats, isGameWon ? attemptsHistory.length : null);
        openModal(modalStats);
      });
    }

    if (btnSettings) btnSettings.addEventListener("click", () => openModal(modalSettings));

    if (btnOpenCalendar) {
      btnOpenCalendar.addEventListener("click", () => {
        calendarViewDate = new Date();
        renderCalendar();
        closeModal(modalStats);
        openModal(modalCalendar);
      });
    }

    if (btnPrevMonth) {
      btnPrevMonth.addEventListener("click", () => {
        calendarViewDate.setMonth(calendarViewDate.getMonth() - 1);
        renderCalendar();
      });
    }

    if (btnNextMonth) {
      btnNextMonth.addEventListener("click", () => {
        calendarViewDate.setMonth(calendarViewDate.getMonth() + 1);
        renderCalendar();
      });
    }

    document.querySelectorAll("[data-close]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const modalId = e.currentTarget.getAttribute("data-close");
        const modal = document.getElementById(modalId);
        if (modal) closeModal(modal);
      });
    });

    const btnHome = document.getElementById("btn-home");
    if (btnHome) {
      btnHome.addEventListener("click", () => {
        if (!isResetting) saveGameState();
      });
    }

    const btnBackHub = document.querySelector(".btn-back-hub");
    if (btnBackHub) {
      btnBackHub.addEventListener("click", () => {
        if (!isResetting) saveGameState();
      });
    }

    if (btnResetStats) btnResetStats.addEventListener("click", resetAllStats);

    if (btnShare) {
      btnShare.addEventListener("click", async () => {
        const shareText = generateShareText();
        trackEvent("risultato_condiviso_parole_incrociate", {
          day_number: targetWordData.dayNumber,
          lunghezza_parola: selectedLength,
          esito: isGameWon ? "vittoria" : "sconfitta"
        });

        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(shareText);
            showToast("Risultato copiato negli appunti! 📋");
          } else {
            const textArea = document.createElement("textarea");
            textArea.value = shareText;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand("copy");
            document.body.removeChild(textArea);
            showToast("Risultato copiato negli appunti! 📋");
          }
        } catch {
          showToast("Impossibile copiare automaticamente.");
        }
      });
    }

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && !isResetting) saveGameState();
    });

    window.addEventListener("beforeunload", () => {
      if (!isResetting) saveGameState();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();