const Lyrics = (() => {
  let elements = null;
  let ui = null;
  let ageEvaluation = null;
  // Lyrics cache to avoid re-fetching
  const lyricsCache = new Map();

  const initialize = (elementRefs, uiModule) => {
    elements = elementRefs;
    ui = uiModule;

    return {
      fetchAndDisplayLyrics,
      clearCache: () => lyricsCache.clear(),
      setAgeEvaluationModule: (ageEvalModule) => { ageEvaluation = ageEvalModule; },
      // Add cache access methods
      getCache: () => lyricsCache,
      checkCache: (key) => lyricsCache.has(key),
      getFromCache: (key) => lyricsCache.get(key),
      addToCache: (key, data) => {
        // Limit cache size (keep no more than 50 entries)
        if (lyricsCache.size >= 50) {
          // Get the oldest key and delete it
          const oldestKey = lyricsCache.keys().next().value;
          lyricsCache.delete(oldestKey);
          console.log('Lyrics/transcript cache full, removed oldest entry');
        }
        lyricsCache.set(key, data);
      },
      addCacheMethods: (methods) => {
        // This is a placeholder that will be overwritten in main.js
        // to avoid circular dependencies
      }
    };
  };

  // Fetch and display lyrics for a track
  const fetchAndDisplayLyrics = async (trackName, artistName) => {
    try {
      // Reset UI
      elements.lyricsContainerEl.classList.remove('hidden');
      elements.lyricsContentEl.classList.add('hidden');
      elements.lyricsNotFoundEl.classList.add('hidden');
      elements.lyricsSourceEl.classList.add('hidden');
      elements.lyricsLoadingEl.classList.remove('hidden');
      elements.lyricsLoadingEl.textContent = `Attempting to fetch lyrics for "${trackName}"...`;

      // Get current data to extract Spotify URL
      const currentData = ui.getCurrentData();

      // Get Spotify URL for the current track if available
      let spotifyUrl = '';
      if (currentData && currentData.item && currentData.item.external_urls && currentData.item.external_urls.spotify) {
        spotifyUrl = currentData.item.external_urls.spotify;
      }

      // Check cache first
      const cacheKey = `${trackName}-${artistName}`;
      if (lyricsCache.has(cacheKey)) {
        console.log(`Using cached lyrics for "${trackName}" by ${artistName}`);
        const cachedData = lyricsCache.get(cacheKey);
        displayLyrics(cachedData);
        return;
      }

      // Fetch lyrics from the API with the spotify URL included
      const apiUrl = `/api/lyrics?title=${encodeURIComponent(trackName)}&artist=${encodeURIComponent(artistName)}${spotifyUrl ? `&spotifyUrl=${encodeURIComponent(spotifyUrl)}` : ''}`;
      console.log(`Fetching lyrics from: ${apiUrl}`);
      const response = await fetch(apiUrl);

      if (!response.ok) {
        throw new Error(`Error fetching lyrics: ${response.status}`);
      }

      const data = await response.json();

      // Store in cache
      lyricsCache.set(cacheKey, data);

      displayLyrics(data);
    } catch (error) {
      console.error('Error fetching lyrics:', error);
      elements.lyricsLoadingEl.classList.add('hidden');
      elements.lyricsNotFoundEl.classList.remove('hidden');
      elements.lyricsNotFoundEl.textContent = `Error: ${error.message}`;

      // Even if lyrics fetch fails, we should still do age evaluation
      const currentData = ui.getCurrentData();
      if (currentData && currentData.item && ageEvaluation) {
        ageEvaluation.fetchAndDisplayAgeEvaluation(currentData.item, currentData.type);
      }
    }
  };

  // Helper function to display lyrics
  const displayLyrics = (data) => {
    // Hide loading
    elements.lyricsLoadingEl.classList.add('hidden');

    // If lyrics were found
    if (data.lyrics) {
      // Format and display lyrics
      elements.lyricsContentEl.innerHTML = data.lyrics.replace(/\n/g, '<br>');
      elements.lyricsContentEl.classList.remove('hidden');

      // Set up source link
      if (data.url) {
        elements.lyricsSourceLinkEl.href = data.url;

        // Update source text based on where the lyrics came from
        if (data.source === 'spotify-api') {
          elements.lyricsSourceLinkEl.textContent = 'Source: Spotify API';
        } else if (data.source === 'spotify-web') {
          elements.lyricsSourceLinkEl.textContent = 'Source: Spotify Web';
        } else if (data.source === 'genius') {
          elements.lyricsSourceLinkEl.textContent = 'Source: Genius';
        } else {
          elements.lyricsSourceLinkEl.textContent = 'View source';
        }

        elements.lyricsSourceEl.classList.remove('hidden');
      }

      // Now that we have lyrics, fetch age evaluation
      const currentData = ui.getCurrentData();
      if (currentData && currentData.item && currentData.type === 'track' && ageEvaluation) {
        ageEvaluation.fetchAndDisplayAgeEvaluation(currentData.item, currentData.type);
      }
    } else {
      // Show not found message
      elements.lyricsNotFoundEl.classList.remove('hidden');
      elements.lyricsNotFoundEl.textContent = 'No lyrics found for this track';

      if (data.error) {
        console.error('Lyrics error:', data.error);
      }

      // Even without lyrics, we can still evaluate based on track info
      const currentData = ui.getCurrentData();
      if (currentData && currentData.item && currentData.type === 'track' && ageEvaluation) {
        ageEvaluation.fetchAndDisplayAgeEvaluation(currentData.item, currentData.type);
      }
    }
  };

  return {
    initialize
  };
})();