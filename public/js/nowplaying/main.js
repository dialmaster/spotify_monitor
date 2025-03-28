document.addEventListener('DOMContentLoaded', () => {
  // Initialize all modules
  const elements = Elements.initialize();
  const toast = Toast.initialize();
  const ui = UI.initialize(elements);
  const lyrics = Lyrics.initialize(elements, ui);
  const transcript = Transcript.initialize(elements, ui);
  const ageEvaluation = AgeEvaluation.initialize(elements, ui);
  const player = Player.initialize(elements, ui);
  const history = History.initialize(elements);
  const userProfile = UserProfile.initialize(elements);

  // Connect related modules
  player.setLyricsModule(lyrics);
  player.setTranscriptModule(transcript);
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
  setInterval(player.fetchCurrentlyPlaying, 7000);
  const historyRefreshInterval = setInterval(history.fetchRecentlyPlayed, 240000);

  // Clear cache on page unload
  window.addEventListener('beforeunload', () => {
    lyrics.clearCache();
    ageEvaluation.clearCache();
    console.log('Caches cleared');
  });
});