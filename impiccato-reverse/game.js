// ==========================================================================
// IMPICCATO REVERSE - MOTORE DI GIOCO PRINCIPALE (game.js)
// Statistiche, Storico e Grafici 100% INDIPENDENTI per ciascuna lunghezza (4-8)
// Con tracciamento completo Google Analytics (GA4) e Reset Protetto
// ==========================================================================

(() => {
  "use strict";

  const MAX_WORDS = 7;
  const STORAGE_KEY_PREFIX = "impiccato_reverse_save_day_";
  const STATS_KEY_PREFIX = "impiccato_reverse_stats_len_";
  const SETTINGS_KEY = "impiccato_reverse_settings";

  let selectedLength = 5;
  let dailyPuzzle = null;
  let activeWordsCount = 1;
  let guessedLetters = new Set();
  let missedLetters = new Set();

  let isGameOver = false;
  let isGameWon = false;
  let isResetting = false;

  let calendarViewDate = new Date();

  // Riferimenti DOM
  const gameTag = document.getElementById("game-tag");
  const boardElem = document.getElementById("board");
  const activeWordsCountElem = document.getElementById("active-words-count");
  const statusHintElem = document.getElementById("status-hint");
  const keyboardElem = document.getElementById("keyboard");
  const toastContainer = document.getElementById("toast-container");
  const lengthSelector = document.getElementById("length-selector");

  // Modali e Pulsanti
  const modalHelp = document.getElementById("modal-help");
  const modalStats = document.getElementById("modal-stats");
  const modalSettings = document.getElementById("modal-settings");
  const modalCalendar = document.getElementById("modal-calendar");

  const btnHelp = document.getElementById("btn-help");
  const btnStats = document.getElementById("btn-stats");
  const btnSettings = document.getElementById("btn-settings");
  const btnOpenCalendar = document.getElementById("btn-open-calendar");

  // Statistiche e Grafico
  const modalStatsTitle = modalStats ? modalStats.querySelector(".modal-header h2") : null;
  const statPlayedElem = document.getElementById("stat-played");
  const statWinPctElem = document.getElementById("stat-win-pct");
  const statStreakElem = document.getElementById("stat-streak");
  const statBestWordsElem = document.getElementById("stat-best-words");
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

  // --- TRACCIAMENTO GOOGLE ANALYTICS (GA4) ---
  function trackEvent(name, params = {}) {
    if (typeof window.gtag === "function") {
      window.gtag("event", name, params);
    }
  }

  // --- INIZIALIZZAZIONE ---
  function init() {
    loadSettings();
    loadPuzzleForCurrentLength();
    setupEventListeners();

    if (!localStorage.getItem("impiccato_reverse_seen_help")) {
      openModal(modalHelp);
      localStorage.setItem("impiccato_reverse_seen_help", "true");
    }
  }

  function loadSettings() {
    try {
      const savedSettings = JSON.parse(localStorage.getItem(SETTINGS_KEY));
      if (savedSettings && savedSettings.wordLength) {
        selectedLength = Number(savedSettings.wordLength);
      }
    } catch (e) {
      selectedLength = 5;
    }
    updateLengthSelectorUI();
  }

  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ wordLength: selectedLength }));
  }

  function updateLengthSelectorUI() {
    if (!lengthSelector) return;
    const buttons = lengthSelector.querySelectorAll(".length-btn");
    buttons.forEach((btn) => {
      const len = Number(btn.dataset.length);
      if (len === selectedLength) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

  function loadPuzzleForCurrentLength() {
    dailyPuzzle = getDailyPuzzle(selectedLength);

    if (gameTag) {
      gameTag.textContent = `GIORNO #${dailyPuzzle.dayNumber} • ${selectedLength} LETTERE`;
    }

    activeWordsCount = 1;
    guessedLetters.clear();
    missedLetters.clear();
    isGameOver = false;
    isGameWon = false;

    loadSavedGame();
    renderBoard();
    updateKeyboardUI();
    updateStatusBar();

    if (!isGameOver) {
      checkVictoryCondition();
    } else {
      ensureGameRecorded();
    }
  }

  // --- RENDERING TABELLONE ---
  function renderBoard() {
    if (!boardElem) return;
    boardElem.innerHTML = "";

    for (let rowIdx = 0; rowIdx < activeWordsCount; rowIdx++) {
      const word = dailyPuzzle.words[rowIdx];
      const rowDiv = document.createElement("div");
      rowDiv.className = "word-row";
      rowDiv.style.gridTemplateColumns = `repeat(${dailyPuzzle.wordLength}, 1fr)`;

      for (let colIdx = 0; colIdx < dailyPuzzle.wordLength; colIdx++) {
        const letter = word[colIdx];
        const cell = document.createElement("div");
        cell.className = "letter-cell";

        if (guessedLetters.has(letter)) {
          cell.textContent = letter;
          cell.classList.add("hit");
        } else if (missedLetters.has(letter)) {
          cell.textContent = letter;
          cell.classList.add("miss");
        } else if (isGameOver && !isGameWon) {
          cell.textContent = letter;
          cell.classList.add("fail-reveal");
        } else {
          cell.textContent = "";
        }

        rowDiv.appendChild(cell);
      }

      boardElem.appendChild(rowDiv);
    }
  }

  // --- STATO TASTIERA & BARRA DI STATO ---
  function updateKeyboardUI() {
    if (!keyboardElem) return;
    const keys = keyboardElem.querySelectorAll(".key-btn");
    keys.forEach((keyBtn) => {
      const letter = keyBtn.dataset.key;
      keyBtn.className = "key-btn";
      keyBtn.disabled = isGameOver;

      if (guessedLetters.has(letter)) {
        keyBtn.classList.add("hit");
      } else if (missedLetters.has(letter)) {
        keyBtn.classList.add("miss");
        keyBtn.disabled = true;
      }
    });
  }

  function updateStatusBar() {
    if (activeWordsCountElem) {
      activeWordsCountElem.textContent = activeWordsCount;
    }
    if (statusHintElem) {
      if (isGameOver) {
        statusHintElem.textContent = isGameWon ? "Sfida completata! 🏆" : "Partita terminata 💀";
      } else {
        const count = missedLetters.size;
        statusHintElem.textContent = `${count} ${count === 1 ? 'errore commesso' : 'errori commessi'}`;
      }
    }
  }

  // --- GESTIONE PRESSIONE LETTERA ---
  function handleLetterChoice(letter) {
    if (isGameOver || isResetting) return;
    if (guessedLetters.has(letter) || missedLetters.has(letter)) {
      return;
    }

    let hitFound = false;
    for (let i = 0; i < activeWordsCount; i++) {
      if (dailyPuzzle.words[i].includes(letter)) {
        hitFound = true;
        break;
      }
    }

    if (hitFound) {
      guessedLetters.add(letter);
      showToast(`Lettera "${letter}" presente! 🎯`);
      renderBoard();
      updateKeyboardUI();
      checkVictoryCondition();
    } else {
      missedLetters.add(letter);

      if (activeWordsCount < MAX_WORDS) {
        activeWordsCount++;
        showToast(`Errore! Aggiunta parola #${activeWordsCount} 🪢`);
        renderBoard();
        updateKeyboardUI();
        updateStatusBar();
        checkVictoryCondition();
      } else {
        handleDefeat();
      }
    }

    saveGameState();
  }

  // --- VERIFICA VITTORIA ---
  function checkVictoryCondition() {
    let allCompleted = true;

    for (let i = 0; i < activeWordsCount; i++) {
      const word = dailyPuzzle.words[i];
      for (let j = 0; j < word.length; j++) {
        const char = word[j];
        const isRevealed = guessedLetters.has(char) || missedLetters.has(char);
        if (!isRevealed) {
          allCompleted = false;
          break;
        }
      }
      if (!allCompleted) break;
    }

    if (allCompleted) {
      handleVictory();
    }
  }

  function handleVictory() {
    isGameOver = true;
    isGameWon = true;

    updateKeyboardUI();
    updateStatusBar();
    saveGameState();
    const updatedStats = saveGameStats(true, activeWordsCount);

    trackEvent("partita_terminata_impiccato", {
      day_number: dailyPuzzle.dayNumber,
      lunghezza_parola: selectedLength,
      esito: "vittoria",
      parole_usate: activeWordsCount,
      errori: missedLetters.size
    });

    showToast("Complimenti, hai vinto! 🏆");

    setTimeout(() => {
      openEndGameModal(true, updatedStats);
    }, 600);
  }

  function handleDefeat() {
    isGameOver = true;
    isGameWon = false;

    renderBoard();
    updateKeyboardUI();
    updateStatusBar();
    saveGameState();
    const updatedStats = saveGameStats(false, activeWordsCount);

    trackEvent("partita_terminata_impiccato", {
      day_number: dailyPuzzle.dayNumber,
      lunghezza_parola: selectedLength,
      esito: "limite_parole",
      parole_usate: activeWordsCount,
      errori: missedLetters.size
    });

    showToast("Hai esaurito le 7 parole disponibili! 💀");

    setTimeout(() => {
      openEndGameModal(false, updatedStats);
    }, 900);
  }

  // --- PERSISTENZA E STATISTICHE ISOLATE PER MODALITÀ ---
  function getStorageKey() {
    return `${STORAGE_KEY_PREFIX}${dailyPuzzle.dayNumber}_len_${selectedLength}`;
  }

  function getStatsKey(len = selectedLength) {
    return `${STATS_KEY_PREFIX}${len}`;
  }

  function saveGameState() {
    if (isResetting) return;
    const state = {
      dayNumber: dailyPuzzle.dayNumber,
      wordLength: selectedLength,
      activeWordsCount,
      guessedLetters: Array.from(guessedLetters),
      missedLetters: Array.from(missedLetters),
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
      if (state.dayNumber !== dailyPuzzle.dayNumber || state.wordLength !== selectedLength) return;

      activeWordsCount = state.activeWordsCount || 1;
      guessedLetters = new Set(state.guessedLetters || []);
      missedLetters = new Set(state.missedLetters || []);
      isGameOver = state.isGameOver || false;
      isGameWon = state.isGameWon || false;

      if (isGameOver) {
        setTimeout(() => {
          openEndGameModal(isGameWon);
        }, 400);
      }
    } catch (e) {
      console.error("Errore nel ripristino salvataggio:", e);
    }
  }

  function getStats(len = selectedLength) {
    const defaultStats = {
      played: 0,
      wins: 0,
      currentStreak: 0,
      maxStreak: 0,
      bestWords: null,
      lastPlayedDay: null,
      guessesDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
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

  function saveGameStats(won, wordsUsed) {
    if (isResetting) return;
    const stats = getStats(selectedLength);
    const day = dailyPuzzle.dayNumber;
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
        if (stats.bestWords === null || wordsUsed < stats.bestWords) {
          stats.bestWords = wordsUsed;
        }
        if (stats.guessesDistribution[wordsUsed] !== undefined) {
          stats.guessesDistribution[wordsUsed]++;
        }
      } else {
        stats.currentStreak = 0;
      }
      stats.lastPlayedDay = day;

      const playedWords = [];
      for (let i = 0; i < wordsUsed; i++) {
        playedWords.push(dailyPuzzle.words[i]);
      }

      stats.history[todayISO] = {
        dayNumber: day,
        dateISO: todayISO,
        wordLength: selectedLength,
        won: won,
        wordsCount: wordsUsed,
        misses: missedLetters.size,
        words: playedWords
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
      saveGameStats(isGameWon, activeWordsCount);
    }
  }

  function resetAllStats() {
    const confirmReset = window.confirm(
      `Sei sicuro di voler azzerare le statistiche e la partita di oggi per la variante da ${selectedLength} lettere?\nPotrai rigiocare la sfida del giorno da zero.`
    );
    if (!confirmReset) return;

    isResetting = true;

    // Rimuove statistiche e cronologia per la lunghezza attiva
    localStorage.removeItem(getStatsKey(selectedLength));
    
    // Rimuove la sessione di gioco attiva per il giorno e la lunghezza corrente
    localStorage.removeItem(getStorageKey());

    // Pulizia variabili di stato locali
    activeWordsCount = 1;
    guessedLetters.clear();
    missedLetters.clear();
    isGameOver = false;
    isGameWon = false;

    showToast(`Statistiche e partita (${selectedLength} lettere) azzerate! 🗑️`);
    closeModal(modalSettings);

    setTimeout(() => {
      window.location.reload();
    }, 400);
  }

  // --- POPOLAMENTO MODALE STATISTICHE ---
  function updateStatsModalView(stats, currentWordsWon = null) {
    if (modalStatsTitle) {
      modalStatsTitle.textContent = `Statistiche (${selectedLength} lettere)`;
    }

    const played = stats.played || 0;
    const wins = stats.wins || 0;
    const winPct = played > 0 ? Math.round((wins / played) * 100) : 0;

    if (statPlayedElem) statPlayedElem.textContent = played;
    if (statWinPctElem) statWinPctElem.textContent = `${winPct}%`;
    if (statStreakElem) statStreakElem.innerHTML = `${stats.currentStreak || 0} <span class="fire-icon">🔥</span>`;
    if (statBestWordsElem) statBestWordsElem.textContent = stats.bestWords ? `${stats.bestWords} par.` : "-";

    renderDistributionChart(stats, currentWordsWon);

    if (isGameOver) {
      if (gameResultBanner) {
        gameResultBanner.classList.remove("hidden", "win", "loss");
        if (isGameWon) {
          gameResultBanner.classList.add("win");
          gameResultBanner.textContent = `Vittoria (${selectedLength} lettere) con ${activeWordsCount} ${activeWordsCount === 1 ? 'parola' : 'parole'}! 🏆`;
        } else {
          gameResultBanner.classList.add("loss");
          gameResultBanner.textContent = "Limite di 7 parole raggiunto! Ritenta domani 💀";
        }
      }

      if (solutionsList) {
        solutionsList.innerHTML = "";
        for (let i = 0; i < activeWordsCount; i++) {
          const tag = document.createElement("span");
          tag.className = "solution-tag";
          tag.textContent = dailyPuzzle.words[i];
          solutionsList.appendChild(tag);
        }
      }
      if (solutionsReveal) solutionsReveal.classList.remove("hidden");
      if (shareSection) shareSection.classList.remove("hidden");
    } else {
      if (gameResultBanner) {
        gameResultBanner.className = "result-banner hidden";
        gameResultBanner.textContent = "";
      }
      if (solutionsReveal) solutionsReveal.classList.add("hidden");
      if (solutionsList) solutionsList.innerHTML = "";
      if (shareSection) shareSection.classList.add("hidden");
    }
  }

  // --- GRAFICO DISTRIBUZIONE (1-7 PAROLE) ---
  function renderDistributionChart(stats, currentWordsWon) {
    if (!distChart) return;
    distChart.innerHTML = "";

    const dist = stats.guessesDistribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
    const maxVal = Math.max(...Object.values(dist), 1);

    for (let i = 1; i <= MAX_WORDS; i++) {
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

      if (isGameWon && currentWordsWon === i) {
        bar.classList.add("highlight");
      }

      track.appendChild(bar);
      row.appendChild(label);
      row.appendChild(track);
      distChart.appendChild(row);
    }
  }

  // --- CALENDARIO (ISOLATO PER LA VARIANTE ATTIVA) ---
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
    calendarMonthLabel.textContent = `${monthNames[month]} ${year} (${selectedLength} lettere)`;

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
    dayDetailTitle.textContent = `Partita del ${parts[2]}/${parts[1]}/${parts[0]} - Giorno #${record.dayNumber} (${selectedLength} lettere)`;

    if (record.won) {
      dayDetailStatus.innerHTML = `Esito: <strong style="color:var(--color-green)">Vittoria con ${record.wordsCount} parole 🏆</strong> (Errori: ${record.misses || 0})`;
    } else {
      dayDetailStatus.innerHTML = `Esito: <strong style="color:var(--color-fail)">Limite parole raggiunto 💀</strong>`;
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

  function openEndGameModal(won, freshStats = null) {
    const stats = freshStats || getStats(selectedLength);
    updateStatsModalView(stats, won ? activeWordsCount : null);
    openModal(modalStats);
  }

  function generateShareText() {
    let text = `Impiccato Reverse • Giorno #${dailyPuzzle.dayNumber} (${selectedLength} lettere)\n`;
    text += isGameWon ? `Risolto in ${activeWordsCount}/7 parole! 🪢🏆\n\n` : `X/7 parole 💀\n\n`;

    for (let r = 0; r < activeWordsCount; r++) {
      const word = dailyPuzzle.words[r];
      let rowEmojis = "";
      for (let c = 0; c < dailyPuzzle.wordLength; c++) {
        const char = word[c];
        if (guessedLetters.has(char)) {
          rowEmojis += "🟩";
        } else {
          rowEmojis += "⬛";
        }
      }
      text += `${rowEmojis}\n`;
    }

    text += `\nErrori: ${missedLetters.size} • Gioca a Impiccato Reverse!`;
    return text;
  }

  // --- LISTENERS ---
  function setupEventListeners() {
    if (lengthSelector) {
      lengthSelector.addEventListener("click", (e) => {
        const btn = e.target.closest(".length-btn");
        if (!btn) return;
        const newLength = Number(btn.dataset.length);
        if (newLength && newLength !== selectedLength) {
          selectedLength = newLength;
          saveSettings();
          updateLengthSelectorUI();
          loadPuzzleForCurrentLength();
          showToast(`Variante: ${selectedLength} lettere! 📏`);

          trackEvent("cambio_lunghezza_impiccato", {
            nuova_lunghezza: selectedLength
          });
        }
      });
    }

    if (keyboardElem) {
      keyboardElem.addEventListener("click", (e) => {
        const target = e.target.closest(".key-btn");
        if (!target || target.disabled) return;
        const key = target.dataset.key;
        if (key) handleLetterChoice(key);
      });
    }

    window.addEventListener("keydown", (e) => {
      if (isGameOver || isResetting) return;
      if (/^[a-zA-Z]$/.test(e.key)) {
        handleLetterChoice(e.key.toUpperCase());
      }
    });

    if (btnHelp) btnHelp.addEventListener("click", () => openModal(modalHelp));

    if (btnStats) {
      btnStats.addEventListener("click", () => {
        ensureGameRecorded();
        const stats = getStats(selectedLength);
        updateStatsModalView(stats, isGameWon ? activeWordsCount : null);
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

        trackEvent("risultato_condiviso_impiccato", {
          day_number: dailyPuzzle.dayNumber,
          lunghezza_parola: selectedLength,
          esito: isGameWon ? "vittoria" : "limite_parole"
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
      if (document.hidden && !isResetting) {
        saveGameState();
      }
    });

    window.addEventListener("beforeunload", () => {
      if (!isResetting) {
        saveGameState();
      }
    });
  }

  function showToast(message) {
    if (!toastContainer) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 2200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();