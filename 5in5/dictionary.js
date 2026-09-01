// ==========================================================================
// 5 IN 5 - GESTORE DIZIONARIO ESTESO E BUFFER DI CARICAMENTO (dictionary.js)
// ==========================================================================

(() => {
  "use strict";

  const fullDictionarySet = new Set();
  let isLoaded = false;

  const appLoader = document.getElementById("app-loader");
  const loaderStatus = document.getElementById("loader-status");

  async function initializeDictionary() {
    try {
      if (loaderStatus) loaderStatus.textContent = "Caricamento vocabolario...";

      const response = await fetch("dictionary.json");
      if (!response.ok) {
        throw new Error(`Errore HTTP: ${response.status}`);
      }

      const wordsArray = await response.json();
      for (let i = 0; i < wordsArray.length; i++) {
        const w = wordsArray[i];
        if (w && w.length >= 4 && w.length <= 8) {
          fullDictionarySet.add(w.toUpperCase().trim());
        }
      }

      // Inserisce anche tutte le parole della pool di words.js
      if (typeof WORDS_POOL_4 !== "undefined") {
        WORDS_POOL_4.forEach(w => fullDictionarySet.add(w));
        WORDS_POOL_5.forEach(w => fullDictionarySet.add(w));
        WORDS_POOL_6.forEach(w => fullDictionarySet.add(w));
        WORDS_POOL_7.forEach(w => fullDictionarySet.add(w));
        WORDS_POOL_8.forEach(w => fullDictionarySet.add(w));
      }

      isLoaded = true;

      // Rimuove il loader con animazione
      if (appLoader) {
        appLoader.classList.add("hidden");
      }

      // Avvia il gioco
      window.dispatchEvent(new CustomEvent("dictionary-ready"));
    } catch (err) {
      console.error("[5in5] Errore nel caricamento del dizionario:", err);
      if (loaderStatus) {
        loaderStatus.textContent = "Errore di connessione. Ricarica la pagina.";
        loaderStatus.style.color = "var(--color-error)";
      }
    }
  }

  // Funzione globale di controllo anti-cheat
  window.isWordInDictionary = function (word) {
    if (!isLoaded || !word || typeof word !== "string") return false;
    return fullDictionarySet.has(word.toUpperCase().trim());
  };

  window.isDictionaryReady = function () {
    return isLoaded;
  };

  document.addEventListener("DOMContentLoaded", initializeDictionary);
})();