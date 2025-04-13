document.addEventListener('DOMContentLoaded', () => {
  // Initialize all modules
  const elements = Elements.initialize();
  const toast = Toast.initialize();
  const ui = UI.initialize(elements);
  const lyrics = Lyrics.initialize(elements, ui);
  const transcript = Transcript.initialize(elements, ui);
  const ageEvaluation = AgeEvaluation.initialize(elements, ui);

  // Initialize history modal module
  const historyModal = HistoryModal.initialize(elements);

  // Initialize history module with modal
  const history = History.initialize(elements, historyModal);

  const userProfile = UserProfile.initialize(elements);
  const player = Player.initialize(elements, ui);

  // Connect related modules
  history.setToastModule(toast);
  player.setLyricsModule(lyrics);
  player.setTranscriptModule(transcript);
  player.setAgeEvaluationModule(ageEvaluation);
  ui.setHistoryModule(history);
  lyrics.setAgeEvaluationModule(ageEvaluation);
  transcript.setAgeEvaluationModule(ageEvaluation);
  transcript.setLyricsModule(lyrics);
  ageEvaluation.setToastModule(toast);

  // Fix for caches in Transcript module (needs access to Lyrics cache)
  if (Lyrics && typeof Lyrics.getCache === 'function') {
    const lyricsCache = Lyrics.getCache();
    Lyrics.addCacheMethods({
      checkCache: (key) => lyricsCache.has(key),
      getFromCache: (key) => lyricsCache.get(key),
      addToCache: (key, data) => {
        if (lyricsCache.size >= 50) {
          // Get the oldest key and delete it
          const oldestKey = lyricsCache.keys().next().value;
          lyricsCache.delete(oldestKey);
          console.log('Lyrics/transcript cache full, removed oldest entry');
        }
        lyricsCache.set(key, data);
      }
    });
  }

  // Initial data fetches
  player.fetchCurrentlyPlaying();
  history.fetchRecentlyPlayed();
  userProfile.fetchUserProfile();

  // Set up refresh intervals
  setInterval(player.fetchCurrentlyPlaying, 6000);
  const historyRefreshInterval = setInterval(history.fetchRecentlyPlayed, 240000);

  // Clear cache on page unload
  window.addEventListener('beforeunload', () => {
    clearInterval(historyRefreshInterval);
    lyrics.clearCache();
    ageEvaluation.clearCache();
    console.log('Caches cleared and intervals cleared');
  });
});