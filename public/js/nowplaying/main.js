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

  // Periodically check server connectivity with a ping
  const serverHealthCheckInterval = 10000; // 10 seconds
  let healthCheckIntervalId = setInterval(checkServerHealth, serverHealthCheckInterval);

  // Function to check server health
  async function checkServerHealth() {
    try {
      // Use the simple health endpoint that just returns OK
      const response = await fetch('/api/health', {
        method: 'GET',
        cache: 'no-store'
      });

      if (response.ok) {
        // If player is currently in a disconnected state but server is healthy,
        // the player module will automatically try to reconnect on its own schedule
        console.log('Server health check: OK');
      } else {
        console.log('Server health check failed with status:', response.status);
      }
    } catch (error) {
      console.log('Server health check failed:', error.message);
    }
  }

  // Initial data fetches
  player.fetchCurrentlyPlaying();
  history.fetchRecentlyPlayed();
  userProfile.fetchUserProfile();

  // Clear cache on page unload
  window.addEventListener('beforeunload', () => {
    lyrics.clearCache();
    ageEvaluation.clearCache();

    // Close SSE connection
    if (player && typeof player.closeConnection === 'function') {
      player.closeConnection();
    }

    // Clear health check interval
    if (healthCheckIntervalId) {
      clearInterval(healthCheckIntervalId);
    }

    console.log('Caches cleared and intervals cleared');
  });
});