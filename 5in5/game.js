// ==========================================================================
// 5 IN 5 - MOTORE DI GIOCO PRINCIPALE (game.js)
// ==========================================================================

(() => {
  "use strict";

  const TOTAL_SECONDS = 300; // 5 minuti totali
  const ROUND_LENGTHS = [4, 5, 6, 7, 8];
  const HINT_INTERVAL_SECONDS = 45; // Indizio ogni 45 secondi per turno

  let currentPuzzle = null;
  let currentRoundIndex = 0;
  let activeWordLength = ROUND_LENGTHS[0];

  // Griglia: 30 oggetti { id: number, letter: string, isUsed: boolean }
  let gridLetters = [];
  let currentSelection = [];
  
  let yellowTileIds = new Set();
  let discoveredLetters = new Set();
  let revealedSlotIndices = new Set();
  let roundSecondsElapsed = 0;

  let timeRemaining = TOTAL_SECONDS;
  let timerEndTime = null;
  let timerInterval = null;
  let isTimerRunning = false;
  let isPaused = false;
  let isGameOver = false;
  let isGameWon = false;
  let isResetting = false;

  let roundAttempts = [0, 0, 0, 0, 0];

  // Vista Mese Calendario
  let calendarViewDate = new Date();

  // --- RIFERIMENTI DOM ---
  const gameTag = document.getElementById("game-tag");
  const timerDisplay = document.getElementById("timer-display");
  const roundTracker = document.getElementById("round-tracker");
  const slotsContainer = document.getElementById("current-word-slots");
  const hintTextElem = document.getElementById("hint-text");
  const letterGrid = document.getElementById("letter-grid");
  const toastContainer = document.getElementById("toast-container");

  const btnBackspace = document.getElementById("btn-backspace");
  const btnPause = document.getElementById("btn-pause");
  const btnSubmit = document.getElementById("btn-submit");

  const btnHelp = document.getElementById("btn-help");
  const btnAbout = document.getElementById("btn-about");
  const btnStats = document.getElementById("btn-stats");
  const btnSettings = document.getElementById("btn-settings");
  const btnOpenCalendar = document.getElementById("btn-open-calendar");

  const modalHelp = document.getElementById("modal-help");
  const modalAbout = document.getElementById("modal-about");
  const modalStats = document.getElementById("modal-stats");
  const modalPause = document.getElementById("modal-pause");
  const modalSettings = document.getElementById("modal-settings");
  const modalCalendar = document.getElementById("modal-calendar");

  const btnResume = document.getElementById("btn-resume");
  const btnResetStats = document.getElementById("btn-reset-stats");

  const calendarMonthLabel = document.getElementById("calendar-month-label");
  const calendarGrid = document.getElementById("calendar-grid");
  const btnPrevMonth = document.getElementById("btn-prev-month");
  const btnNextMonth = document.getElementById("btn-next-month");
  const dayDetailBox = document.getElementById("day-detail-box");
  const dayDetailTitle = document.getElementById("day-detail-title");
  const dayDetailStatus = document.getElementById("day-detail-status");
  const dayDetailWords = document.getElementById("day-detail-words");

  const gameResultBanner = document.getElementById("game-result-banner");
  const solutionsReveal = document.getElementById("solutions-reveal");
  const solutionsList = document.getElementById("solutions-list");
  const shareSection = document.getElementById("share-section");
  const btnShare = document.getElementById("btn-share");

  // --- TRACCIAMENTO EVENTI ANALYTICS ---
  function trackAnalyticsEvent(eventName, params = {}) {
    if (typeof window.gtag === "function") {
      window.gtag("event", eventName, params);
    }
  }

  // --- INIZIALIZZAZIONE GIOCO ---
  function initGame() {
    currentPuzzle = getDailyPuzzle();
    activeWordLength = ROUND_LENGTHS[currentRoundIndex];

    if (gameTag) {
      gameTag.textContent = `Giorno #${currentPuzzle.dayNumber}`;
    }

    setupGridData();
    loadSavedState(); 

    renderRoundTracker();
    renderSlots();
    renderGrid();
    updateHintDisplay();
    updateTimerDisplay();
    setupEventListeners();

    if (!localStorage.getItem("cinque_in_cinque_seen_help")) {
      openModal(modalHelp);
      localStorage.setItem("cinque_in_cinque_seen_help", "true");
    }
  }

  function setupGridData() {
    const allLetters = currentPuzzle.words.join("").split("");
    const shuffled = shuffleArrayWithSeed(allLetters, currentPuzzle.dayNumber * 7919);

    gridLetters = shuffled.map((char, index) => ({
      id: Number(index),
      letter: char.toUpperCase(),
      isUsed: false
    }));
  }

  // --- RENDER UI ---

  function renderRoundTracker() {
    if (!roundTracker) return;
    const dots = roundTracker.querySelectorAll(".tracker-dot");
    dots.forEach((dot, idx) => {
      dot.className = "tracker-dot";
      if (idx < currentRoundIndex) {
        dot.classList.add("completed");
      } else if (idx === currentRoundIndex) {
        dot.classList.add("active");
      }
    });
  }

  function renderSlots() {
    if (!slotsContainer) return;
    slotsContainer.innerHTML = "";
    activeWordLength = ROUND_LENGTHS[currentRoundIndex];
    const targetWord = currentPuzzle.words[currentRoundIndex] || "";

    for (let i = 0; i < activeWordLength; i++) {
      const slot = document.createElement("div");
      slot.className = "word-slot";

      if (i < currentSelection.length) {
        const item = currentSelection[i];
        slot.textContent = item.letter;
        slot.classList.add("filled");
      } else if (revealedSlotIndices.has(i)) {
        slot.textContent = targetWord[i];
        slot.classList.add("hint-revealed");
      } else {
        slot.textContent = "";
      }

      slotsContainer.appendChild(slot);
    }
  }

  function renderGrid() {
    if (!letterGrid) return;
    letterGrid.innerHTML = "";

    const targetWord = currentPuzzle.words[currentRoundIndex] || "";
    const targetCounts = {};
    for (const char of targetWord) {
      targetCounts[char] = (targetCounts[char] || 0) + 1;
    }

    const yellowRenderedCounts = {};
    const selectedTileIds = new Set(currentSelection.map(item => Number(item.tileId)));

    gridLetters.forEach((tile) => {
      const btn = document.createElement("button");
      btn.className = "tile-btn";
      btn.textContent = tile.letter;
      btn.dataset.id = String(tile.id);

      if (tile.isUsed) {
        btn.classList.add("used-letter");
        btn.disabled = true;
      } else {
        if (yellowTileIds.has(tile.id)) {
          const currentCount = yellowRenderedCounts[tile.letter] || 0;
          const maxAllowed = targetCounts[tile.letter] || 0;
          if (currentCount < maxAllowed) {
            btn.classList.add("present-hint");
            yellowRenderedCounts[tile.letter] = currentCount + 1;
          }
        }

        if (selectedTileIds.has(tile.id)) {
          btn.classList.add("selected");
        }
      }

      btn.addEventListener("click", () => handleTileClick(tile.id));
      letterGrid.appendChild(btn);
    });
  }

  function updateHintDisplay() {
    if (!hintTextElem) return;

    if (discoveredLetters.size > 0) {
      const sortedChars = Array.from(discoveredLetters).sort().join(", ");
      hintTextElem.textContent = `Lettere contenute: ${sortedChars}`;
    } else {
      hintTextElem.textContent = "";
    }
  }

  // --- LOGICA INDIZIO A TEMPO (45s) IN POSIZIONE CASUALE ---

  function checkTurnHintTimer() {
    if (isGameOver || isPaused || isResetting) return;

    const targetWord = currentPuzzle.words[currentRoundIndex] || "";
    
    if (roundSecondsElapsed > 0 && roundSecondsElapsed % HINT_INTERVAL_SECONDS === 0) {
      const unrevealedIndices = [];
      for (let i = 0; i < targetWord.length; i++) {
        if (!revealedSlotIndices.has(i)) {
          unrevealedIndices.push(i);
        }
      }

      if (unrevealedIndices.length > 0) {
        const randomIndex = unrevealedIndices[Math.floor(Math.random() * unrevealedIndices.length)];
        revealedSlotIndices.add(randomIndex);

        const char = targetWord[randomIndex];
        discoveredLetters.add(char);

        const matchingTile = gridLetters.find(t => t.letter === char && !t.isUsed && !yellowTileIds.has(t.id));
        if (matchingTile) {
          yellowTileIds.add(matchingTile.id);
        }
        
        showToast(`💡 Indizio: la lettera #${randomIndex + 1} è "${char}"!`);
        renderSlots();
        renderGrid();
        updateHintDisplay();
        saveGameState();
      }
    }
  }

  // --- GESTIONE INPUT & CLICK ---

  function handleTileClick(tileId) {
    if (isGameOver || isPaused || isResetting) return;
    startTimerIfNeeded();

    const numericId = Number(tileId);
    const tile = gridLetters.find(t => t.id === numericId);
    if (!tile || tile.isUsed) return;

    const existingIndex = currentSelection.findIndex(item => item.tileId === numericId);

    if (existingIndex !== -1) {
      currentSelection.splice(existingIndex, 1);
    } else {
      if (currentSelection.length < activeWordLength) {
        currentSelection.push({
          tileId: numericId,
          letter: tile.letter
        });
      } else {
        showToast(`Lunghezza massima: ${activeWordLength} lettere!`);
        return;
      }
    }

    renderSlots();
    renderGrid();
    saveGameState();
  }

  function handleBackspace() {
    if (isGameOver || isPaused || isResetting || currentSelection.length === 0) return;
    currentSelection.pop();
    renderSlots();
    renderGrid();
    saveGameState();
  }

  function handleSubmit() {
    if (isGameOver || isPaused || isResetting) return;
    startTimerIfNeeded();

    if (currentSelection.length < activeWordLength) {
      showToast(`Inserisci tutte le ${activeWordLength} lettere!`);
      if (slotsContainer) shakeElement(slotsContainer);
      return;
    }

    const enteredWord = currentSelection.map(item => item.letter).join("");
    const targetWord = currentPuzzle.words[currentRoundIndex];

    const isTarget = (enteredWord === targetWord);
    const isValidDictionaryWord = isWordInDictionary(enteredWord);

    if (!isTarget && !isValidDictionaryWord) {
      showToast("Parola non presente nel database! ❌");
      if (slotsContainer) shakeElement(slotsContainer);
      
      currentSelection = [];
      renderSlots();
      renderGrid();
      saveGameState();
      return;
    }

    roundAttempts[currentRoundIndex]++;

    if (isTarget) {
      handleRoundSuccess();
    } else {
      handleRoundError(enteredWord, targetWord);
    }
  }

  // --- ESITO ROUND ---

  function handleRoundSuccess() {
    if (slotsContainer) {
      const slots = slotsContainer.querySelectorAll(".word-slot");
      slots.forEach(slot => slot.classList.add("correct"));
    }

    currentSelection.forEach(item => {
      const tile = gridLetters.find(t => t.id === item.tileId);
      if (tile) tile.isUsed = true;
    });

    yellowTileIds.clear();
    discoveredLetters.clear();
    revealedSlotIndices.clear();
    roundSecondsElapsed = 0;
    updateHintDisplay();

    showToast("Parola corretta! 🎉");

    setTimeout(() => {
      currentRoundIndex++;
      currentSelection = [];

      if (currentRoundIndex >= ROUND_LENGTHS.length) {
        handleGameVictory();
      } else {
        activeWordLength = ROUND_LENGTHS[currentRoundIndex];
        renderRoundTracker();
        renderSlots();
        renderGrid();
        saveGameState();
      }
    }, 600);
  }

  function handleRoundError(enteredWord, targetWord) {
    if (slotsContainer) shakeElement(slotsContainer);

    const targetCounts = {};
    for (let i = 0; i < targetWord.length; i++) {
      const ch = targetWord[i];
      targetCounts[ch] = (targetCounts[ch] || 0) + 1;
    }

    let exactMatchesCount = 0;

    for (let i = 0; i < activeWordLength; i++) {
      if (enteredWord[i] === targetWord[i]) {
        revealedSlotIndices.add(i);
        discoveredLetters.add(enteredWord[i]);
        targetCounts[enteredWord[i]]--;
        exactMatchesCount++;

        const tileId = currentSelection[i].tileId;
        yellowTileIds.add(tileId);
      }
    }

    for (let i = 0; i < activeWordLength; i++) {
      const ch = enteredWord[i];
      if (ch !== targetWord[i] && targetCounts[ch] && targetCounts[ch] > 0) {
        discoveredLetters.add(ch);
        targetCounts[ch]--;

        const tileId = currentSelection[i].tileId;
        yellowTileIds.add(tileId);
      }
    }

    if (exactMatchesCount > 0) {
      showToast(`${exactMatchesCount} ${exactMatchesCount === 1 ? 'lettera posizionata' : 'lettere posizionate'} negli slot! 📍`);
    } else {
      showToast("Non è la parola corretta!");
    }

    currentSelection = [];

    updateHintDisplay();
    renderSlots();
    renderGrid();
    saveGameState();
  }

  // --- TIMER ---

  function startTimerIfNeeded() {
    if (isTimerRunning || isGameOver || isPaused || isResetting) return;
    isTimerRunning = true;
    
    timerEndTime = Date.now() + (timeRemaining * 1000);

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      syncTimer();
    }, 250);
  }

  function syncTimer() {
    if (!isTimerRunning || isGameOver || isPaused || isResetting) return;

    const msRemaining = Math.max(0, timerEndTime - Date.now());
    const secondsCalc = Math.ceil(msRemaining / 1000);

    if (secondsCalc !== timeRemaining) {
      const elapsedDelta = timeRemaining - secondsCalc;
      timeRemaining = secondsCalc;
      roundSecondsElapsed += Math.max(1, elapsedDelta);
      
      checkTurnHintTimer();
      updateTimerDisplay();
      saveGameState();
    }

    if (msRemaining <= 0) {
      clearInterval(timerInterval);
      handleTimeExpired();
    }
  }

  function pauseGame() {
    if (isGameOver || isPaused || isResetting) return;
    
    if (isTimerRunning) {
      clearInterval(timerInterval);
      isTimerRunning = false;
      timeRemaining = Math.max(0, Math.ceil((timerEndTime - Date.now()) / 1000));
    }
    isPaused = true;
    saveGameState();

    openModal(modalPause);
  }

  function resumeGame() {
    if (!isPaused || isGameOver || isResetting) return;
    closeModal(modalPause);
    isPaused = false;
    startTimerIfNeeded();
    saveGameState();
  }

  function updateTimerDisplay() {
    if (!timerDisplay) return;
    const minutes = Math.floor(Math.max(0, timeRemaining) / 60);
    const seconds = Math.max(0, timeRemaining) % 60;
    const formatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

    timerDisplay.textContent = formatted;

    if (timeRemaining <= 60) {
      timerDisplay.classList.add("urgent");
    } else {
      timerDisplay.classList.remove("urgent");
    }
  }

  function handleVisibilityOrFocus() {
    if (isTimerRunning && !isPaused && !isGameOver && !isResetting) {
      syncTimer();
    }
  }

  // --- FINE PARTITA & ANALYTICS ---

  function handleGameVictory() {
    isGameOver = true;
    isGameWon = true;
    clearInterval(timerInterval);

    const elapsedSeconds = TOTAL_SECONDS - timeRemaining;
    saveGameStats(true, elapsedSeconds);
    saveGameState();

    trackAnalyticsEvent("partita_terminata", {
      day_number: currentPuzzle.dayNumber,
      esito: "vittoria",
      tempo_secondi: elapsedSeconds,
      round_completati: 5
    });

    setTimeout(() => {
      openEndGameModal(true);
    }, 500);
  }

  function handleTimeExpired() {
    isGameOver = true;
    isGameWon = false;
    timeRemaining = 0;
    updateTimerDisplay();

    showToast("Tempo scaduto! ⌛");
    saveGameStats(false, null);
    saveGameState();

    trackAnalyticsEvent("partita_terminata", {
      day_number: currentPuzzle.dayNumber,
      esito: "tempo_scaduto",
      tempo_secondi: TOTAL_SECONDS,
      round_completati: currentRoundIndex
    });

    setTimeout(() => {
      openEndGameModal(false);
    }, 800);
  }

  // --- STORAGE & STATISTICHE ---

  function getStats() {
    const defaultStats = {
      played: 0,
      wins: 0,
      currentStreak: 0,
      maxStreak: 0,
      bestTimeSeconds: null,
      lastPlayedDay: null,
      history: {}
    };
    try {
      const stored = localStorage.getItem("cinque_in_cinque_stats");
      return stored ? { ...defaultStats, ...JSON.parse(stored) } : defaultStats;
    } catch {
      return defaultStats;
    }
  }

  function saveGameStats(won, elapsedSeconds) {
    if (isResetting) return;
    const stats = getStats();
    const dayKey = currentPuzzle.dayNumber;
    const todayISO = new Date().toISOString().slice(0, 10);

    if (stats.lastPlayedDay !== dayKey) {
      stats.played++;
      if (won) {
        stats.wins++;
        stats.currentStreak++;
        if (stats.currentStreak > stats.maxStreak) {
          stats.maxStreak = stats.currentStreak;
        }
      } else {
        stats.currentStreak = 0;
      }
      stats.lastPlayedDay = dayKey;
    } else if (won && stats.wins === 0) {
      stats.wins = 1;
      stats.currentStreak = 1;
      stats.maxStreak = Math.max(stats.maxStreak, 1);
    }

    if (won && elapsedSeconds !== null) {
      if (stats.bestTimeSeconds === null || elapsedSeconds < stats.bestTimeSeconds) {
        stats.bestTimeSeconds = elapsedSeconds;
      }
    }

    if (!stats.history) stats.history = {};
    stats.history[todayISO] = {
      dayNumber: currentPuzzle.dayNumber,
      won: won,
      timeSeconds: elapsedSeconds,
      roundAttempts: [...roundAttempts],
      words: [...currentPuzzle.words]
    };

    localStorage.setItem("cinque_in_cinque_stats", JSON.stringify(stats));
  }

  function resetAllStats() {
    const confirmReset = window.confirm(
      "Sei sicuro di voler resettare tutte le statistiche e la partita di oggi?\nPotrai rigiocare la sfida del giorno da zero."
    );

    if (!confirmReset) return;

    isResetting = true;
    clearInterval(timerInterval);

    // Rimozione dati
    localStorage.removeItem("cinque_in_cinque_stats");
    const saveKey = `cinque_save_day_${currentPuzzle.dayNumber}`;
    localStorage.removeItem(saveKey);

    // Pulizia variabili di stato
    currentRoundIndex = 0;
    currentSelection = [];
    yellowTileIds.clear();
    discoveredLetters.clear();
    revealedSlotIndices.clear();
    roundSecondsElapsed = 0;
    timeRemaining = TOTAL_SECONDS;
    isTimerRunning = false;
    isPaused = false;
    isGameOver = false;
    isGameWon = false;
    roundAttempts = [0, 0, 0, 0, 0];

    showToast("Statistiche e partita azzerate! 🗑️");
    closeModal(modalSettings);

    setTimeout(() => {
      window.location.reload();
    }, 400);
  }

  function saveGameState() {
    if (isResetting) return;
    const saveKey = `cinque_save_day_${currentPuzzle.dayNumber}`;
    const state = {
      dayNumber: currentPuzzle.dayNumber,
      currentRoundIndex,
      gridLetters,
      yellowTileIds: Array.from(yellowTileIds),
      discoveredLetters: Array.from(discoveredLetters),
      revealedSlotIndices: Array.from(revealedSlotIndices),
      roundSecondsElapsed,
      timeRemaining,
      isTimerStarted: isTimerRunning || isPaused || timeRemaining < TOTAL_SECONDS,
      isGameOver,
      isGameWon,
      roundAttempts
    };
    localStorage.setItem(saveKey, JSON.stringify(state));
  }

  function loadSavedState() {
    try {
      const saveKey = `cinque_save_day_${currentPuzzle.dayNumber}`;
      const saved = localStorage.getItem(saveKey);
      if (!saved) return;

      const state = JSON.parse(saved);

      if (state.dayNumber !== currentPuzzle.dayNumber || !state.gridLetters || state.gridLetters.length !== 30) {
        localStorage.removeItem(saveKey);
        return;
      }

      currentRoundIndex = state.currentRoundIndex || 0;
      gridLetters = state.gridLetters || gridLetters;
      yellowTileIds = new Set(state.yellowTileIds || []);
      discoveredLetters = new Set(state.discoveredLetters || []);
      revealedSlotIndices = new Set(state.revealedSlotIndices || []);
      roundSecondsElapsed = state.roundSecondsElapsed || 0;
      timeRemaining = state.timeRemaining !== undefined ? state.timeRemaining : TOTAL_SECONDS;
      isGameOver = state.isGameOver || false;
      isGameWon = state.isGameWon || false;
      roundAttempts = state.roundAttempts || [0, 0, 0, 0, 0];

      if (state.isTimerStarted && !isGameOver) {
        startTimerIfNeeded();
      }

      updateTimerDisplay();
      renderRoundTracker();
      renderSlots();
      renderGrid();
      updateHintDisplay();

      if (isGameOver) {
        openEndGameModal(isGameWon);
      }
    } catch (e) {
      console.error("Errore nel ripristino", e);
    }
  }

  function formatSeconds(secs) {
    if (secs === null || secs === undefined) return "--:--";
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${String(s).padStart(2, "0")}s`;
  }

  // --- CALENDARIO DELLE PARTITE ---

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
    calendarMonthLabel.textContent = `${monthNames[month]} ${year}`;

    const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7;
    const totalDays = new Date(year, month + 1, 0).getDate();

    const stats = getStats();
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
        
        if (record.won) {
          dayDiv.classList.add("played-win");
        } else {
          dayDiv.classList.add("played-loss");
        }

        dayDiv.addEventListener("click", () => {
          document.querySelectorAll(".cal-day").forEach(d => d.classList.remove("selected-day"));
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
    dayDetailTitle.textContent = `Partita del ${parts[2]}/${parts[1]}/${parts[0]} (Giorno #${record.dayNumber})`;

    if (record.won) {
      dayDetailStatus.innerHTML = `Esito: <strong style="color:var(--color-accent)">Vittoria 🏆</strong> in ${formatSeconds(record.timeSeconds)}`;
    } else {
      dayDetailStatus.innerHTML = `Esito: <strong style="color:var(--color-error)">Tempo Scaduto ⌛</strong>`;
    }

    dayDetailWords.innerHTML = "";
    if (record.words && record.words.length > 0) {
      record.words.forEach(word => {
        const span = document.createElement("span");
        span.className = "solution-tag";
        span.textContent = word;
        dayDetailWords.appendChild(span);
      });
    }
  }

  // --- MODALI & CONDIVISIONE ---

  function openModal(modal) {
    if (modal) modal.classList.remove("hidden");
  }

  function closeModal(modal) {
    if (modal) modal.classList.add("hidden");
  }

  function openEndGameModal(won) {
    const stats = getStats();

    const elPlayed = document.getElementById("stat-played");
    const elWinPct = document.getElementById("stat-win-pct");
    const elStreak = document.getElementById("stat-streak");
    const elBestTime = document.getElementById("stat-best-time");

    if (elPlayed) elPlayed.textContent = stats.played;
    const winPct = stats.played > 0 ? Math.round((stats.wins / stats.played) * 100) : 0;
    if (elWinPct) elWinPct.textContent = `${winPct}%`;
    if (elStreak) elStreak.innerHTML = `${stats.currentStreak} <span class="fire-icon">🔥</span>`;
    if (elBestTime) elBestTime.textContent = formatSeconds(stats.bestTimeSeconds);

    if (gameResultBanner) {
      gameResultBanner.classList.remove("hidden", "win", "loss");
      if (won) {
        const elapsed = TOTAL_SECONDS - timeRemaining;
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        gameResultBanner.classList.add("win");
        gameResultBanner.textContent = `Vittoria in ${mins}m ${secs}s! 🎉`;
      } else {
        gameResultBanner.classList.add("loss");
        gameResultBanner.textContent = "Tempo Scaduto! Ritenta domani ⌛";
      }
    }

    if (solutionsList) {
      solutionsList.innerHTML = "";
      currentPuzzle.words.forEach(w => {
        const span = document.createElement("span");
        span.className = "solution-tag";
        span.textContent = w;
        solutionsList.appendChild(span);
      });
    }
    if (solutionsReveal) solutionsReveal.classList.remove("hidden");
    if (shareSection) shareSection.classList.remove("hidden");

    openModal(modalStats);
  }

  function generateShareText() {
    const elapsed = TOTAL_SECONDS - timeRemaining;
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const timeStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

    let text = `5 in 5 • Giorno #${currentPuzzle.dayNumber}\n`;
    text += isGameWon ? `Completato in ${timeStr} ⏱️\n\n` : `Tempo scaduto ⌛\n\n`;

    for (let i = 0; i < ROUND_LENGTHS.length; i++) {
      if (i < currentRoundIndex || isGameWon) {
        text += `Round ${i + 1} (${ROUND_LENGTHS[i]} lett.): 🟩 (${roundAttempts[i]} tent.)\n`;
      } else {
        text += `Round ${i + 1} (${ROUND_LENGTHS[i]} lett.): 🟥\n`;
      }
    }

    text += "\nGioca a 5 in 5!";
    return text;
  }

  // --- LISTENERS ---

  function setupEventListeners() {
    if (btnBackspace) btnBackspace.addEventListener("click", handleBackspace);
    if (btnSubmit) btnSubmit.addEventListener("click", handleSubmit);

    if (btnPause) btnPause.addEventListener("click", pauseGame);
    if (btnResume) btnResume.addEventListener("click", resumeGame);

    if (btnHelp) {
      btnHelp.addEventListener("click", () => {
        if (isTimerRunning) pauseGame();
        openModal(modalHelp);
      });
    }

    if (btnAbout) {
      btnAbout.addEventListener("click", () => {
        if (isTimerRunning) pauseGame();
        openModal(modalAbout);
      });
    }

    if (btnSettings) {
      btnSettings.addEventListener("click", () => {
        if (isTimerRunning) pauseGame();
        openModal(modalSettings);
      });
    }

    if (btnResetStats) {
      btnResetStats.addEventListener("click", resetAllStats);
    }

    if (btnStats) {
      btnStats.addEventListener("click", () => {
        const stats = getStats();
        const elPlayed = document.getElementById("stat-played");
        const elWinPct = document.getElementById("stat-win-pct");
        const elStreak = document.getElementById("stat-streak");
        const elBestTime = document.getElementById("stat-best-time");

        if (elPlayed) elPlayed.textContent = stats.played;
        const winPct = stats.played > 0 ? Math.round((stats.wins / stats.played) * 100) : 0;
        if (elWinPct) elWinPct.textContent = `${winPct}%`;
        if (elStreak) elStreak.innerHTML = `${stats.currentStreak} <span class="fire-icon">🔥</span>`;
        if (elBestTime) elBestTime.textContent = formatSeconds(stats.bestTimeSeconds);

        if (isTimerRunning) pauseGame();
        openModal(modalStats);
      });
    }

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

    const btnHome = document.getElementById("btn-home");
    if (btnHome) {
      btnHome.addEventListener("click", () => {
        if (isTimerRunning && !isResetting) {
          timeRemaining = Math.max(0, Math.ceil((timerEndTime - Date.now()) / 1000));
        }
        saveGameState();
      });
    }

    const btnBackHub = document.querySelector(".btn-back-hub");
    if (btnBackHub) {
      btnBackHub.addEventListener("click", () => {
        if (isTimerRunning && !isResetting) {
          timeRemaining = Math.max(0, Math.ceil((timerEndTime - Date.now()) / 1000));
        }
        saveGameState();
      });
    }

    document.querySelectorAll("[data-close]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const modalId = e.currentTarget.getAttribute("data-close");
        const targetModal = document.getElementById(modalId);
        if (targetModal) closeModal(targetModal);
      });
    });

    if (btnShare) {
      btnShare.addEventListener("click", async () => {
        const shareText = generateShareText();
        
        trackAnalyticsEvent("risultato_condiviso", {
          day_number: currentPuzzle.dayNumber,
          esito: isGameWon ? "vittoria" : "tempo_scaduto"
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
      if (!document.hidden) {
        handleVisibilityOrFocus();
      } else {
        if (!isResetting) saveGameState();
      }
    });

    window.addEventListener("focus", handleVisibilityOrFocus);

    window.addEventListener("beforeunload", () => {
      if (isResetting) return;
      if (isTimerRunning) {
        timeRemaining = Math.max(0, Math.ceil((timerEndTime - Date.now()) / 1000));
      }
      saveGameState();
    });

    // Supporto tastiera fisica
    window.addEventListener("keydown", (e) => {
      if (isGameOver || isPaused || isResetting) return;

      if (e.key === "Enter") {
        handleSubmit();
      } else if (e.key === "Backspace") {
        handleBackspace();
      } else if (e.key === "Escape" || e.key.toLowerCase() === "p") {
        pauseGame();
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        const pressedChar = e.key.toUpperCase();
        const selectedIds = new Set(currentSelection.map(item => item.tileId));
        
        let matchingTiles = gridLetters.filter(t => 
          t.letter === pressedChar && 
          !t.isUsed && 
          yellowTileIds.has(t.id) &&
          !selectedIds.has(t.id)
        );

        if (matchingTiles.length === 0) {
          matchingTiles = gridLetters.filter(t => 
            t.letter === pressedChar && 
            !t.isUsed && 
            !selectedIds.has(t.id)
          );
        }

        if (matchingTiles.length > 0) {
          handleTileClick(matchingTiles[0].id);
        }
      }
    });
  }

  // --- UTILITY ---

  function showToast(message) {
    if (!toastContainer) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 2000);
  }

  function shakeElement(elem) {
    if (!elem) return;
    elem.classList.remove("shake");
    void elem.offsetWidth;
    elem.classList.add("shake");
  }

  if (typeof window.isDictionaryReady === "function" && window.isDictionaryReady()) {
    initGame();
  } else {
    window.addEventListener("dictionary-ready", initGame, { once: true });
  }
})();