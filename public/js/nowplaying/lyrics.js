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
      displayLyricsOrTranscriptCached,
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

  const displayLyricsOrTranscriptCached = (data) => {
    const isTrack = data.track.contentType === 'track';
    const contentType = isTrack ? 'track' : 'episode';

    // Select the appropriate elements based on content type
    const containers = {
      container: isTrack ? elements.lyricsContainerEl : elements.podcastTranscriptContainerEl,
      otherContainer: isTrack ? elements.podcastTranscriptContainerEl : elements.lyricsContainerEl,
      loading: isTrack ? elements.lyricsLoadingEl : elements.podcastTranscriptLoadingEl,
      notFound: isTrack ? elements.lyricsNotFoundEl : elements.podcastTranscriptNotFoundEl,
      content: isTrack ? elements.lyricsContentEl : elements.podcastTranscriptContentEl,
      sourceLink: isTrack ? elements.lyricsSourceLinkEl : elements.podcastTranscriptSourceLinkEl,
      sourceContainer: isTrack ? elements.lyricsSourceEl : elements.podcastTranscriptSourceEl
    };

    // Show the appropriate container and hide the other
    containers.container.classList.remove('hidden');
    containers.otherContainer.classList.add('hidden');

    // Handle cases where lyrics/transcript data is missing or has errors
    if (!data.lyrics || !data.lyrics.lyrics) {
      return handleMissingContent(data, containers, contentType);
    }

    // Check if content is already displayed and return early if it is
    const formattedContent = data.lyrics.lyrics.replace(/\n/g, '<br>');
    if (containers.content.innerHTML === formattedContent) {
      containers.loading.classList.add('hidden');
      containers.content.classList.remove('hidden');
      return;
    }

    // Display source URL if available
    if (data.track.spotifyUrl) {
      setupSourceLink(data, containers, contentType);
    }

    // Display the content
    containers.loading.classList.add('hidden');
    containers.content.innerHTML = formattedContent;
    containers.content.classList.remove('hidden');
  };

  /**
   * Handles the case when content (lyrics or transcript) is missing
   */
  const handleMissingContent = (data, containers, contentType) => {
    const contentLabel = contentType === 'track' ? 'lyrics' : 'transcript';

    if (data.lyrics?.error?.includes('Could not find lyrics') || data.lyrics?.error?.includes('No transcript available')) {
      containers.loading.classList.add('hidden');
      containers.notFound.classList.remove('hidden');
      containers.notFound.textContent = `No ${contentLabel} found for this ${contentType}`;
      containers.content.classList.add('hidden');
    } else if (data.lyrics?.error) {
      containers.loading.classList.add('hidden');
      containers.notFound.classList.remove('hidden');
      containers.notFound.textContent = `Error fetching ${contentLabel}`;
      containers.content.classList.add('hidden');
      containers.sourceLink.classList.add('hidden');
    } else {
      containers.notFound.classList.add('hidden');
      containers.loading.classList.remove('hidden');
      containers.loading.textContent = `Attempting to fetch ${contentLabel} for ${contentType === 'track' ? contentType : `"${data.track.title}"`}...`;
      containers.content.classList.add('hidden');
      containers.sourceLink.classList.add('hidden');
    }
  };

  /**
   * Sets up the source link for the content
   */
  const setupSourceLink = (data, containers, contentType) => {
    containers.sourceLink.href = data.track.spotifyUrl;

    if (contentType === 'track') {
      // Update source text based on where the lyrics came from
      if (data.lyrics.source === 'spotify-api') {
        containers.sourceLink.textContent = 'Source: Spotify API';
      } else if (data.lyrics.source === 'spotify-web') {
        containers.sourceLink.textContent = 'Source: Spotify Web';
      } else if (data.lyrics.source === 'genius') {
        containers.sourceLink.textContent = 'Source: Genius';
      } else {
        containers.sourceLink.textContent = 'View source';
      }
    } else {
      containers.sourceLink.textContent = 'Source: Spotify Podcast Transcript';
    }

    containers.sourceContainer.classList.remove('hidden');
  };

  // Fetch and display lyrics for a track
  // To be deprecated
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