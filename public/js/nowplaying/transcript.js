const Transcript = (() => {
  let elements = null;
  let ui = null;
  let ageEvaluation = null;
  let lyrics = null; // Reference to Lyrics module

  const initialize = (elementRefs, uiModule) => {
    elements = elementRefs;
    ui = uiModule;

    return {
      fetchAndDisplayTranscript,
      setAgeEvaluationModule: (ageEvalModule) => { ageEvaluation = ageEvalModule; },
      setLyricsModule: (lyricsModule) => { lyrics = lyricsModule; }
    };
  };

  // Fetch and display transcript for a podcast
  const fetchAndDisplayTranscript = async (episodeName, episodeUrl) => {
    try {
      // Reset transcript UI
      elements.podcastTranscriptContainerEl.classList.remove('hidden');
      elements.podcastTranscriptLoadingEl.classList.remove('hidden');
      elements.podcastTranscriptLoadingEl.textContent = `Attempting to fetch transcript for "${episodeName}"...`;
      elements.podcastTranscriptContentEl.classList.add('hidden');
      elements.podcastTranscriptNotFoundEl.classList.add('hidden');
      elements.podcastTranscriptSourceEl.classList.add('hidden');

      // Create a cache key from episode name
      const cacheKey = `podcast:::${episodeName}`;

      // Check if we already have transcript for this episode in cache
      // We need to access the Lyrics module's cache
      if (lyrics && typeof lyrics.checkCache === 'function' && lyrics.checkCache(cacheKey)) {
        console.log(`Using cached transcript for "${episodeName}"`);
        const cachedData = lyrics.getFromCache(cacheKey);
        displayTranscript(cachedData);
        return;
      }

      // Verify we have the Spotify URL
      if (!episodeUrl) {
        console.error('No Spotify URL available for this podcast episode');
        elements.podcastTranscriptLoadingEl.classList.add('hidden');
        elements.podcastTranscriptNotFoundEl.classList.remove('hidden');
        // Since we couldn't get transcript, pass null to age evaluation
        const currentData = ui.getCurrentData();
        if (currentData && currentData.item && ageEvaluation) {
          ageEvaluation.fetchAndDisplayAgeEvaluation(currentData.item, 'episode');
        }
        return;
      }

      console.log(`Including Spotify URL in transcript request: ${episodeUrl}`);

      // Fetch transcript from the API
      const response = await fetch(`/api/lyrics?title=${encodeURIComponent(episodeName)}&spotifyUrl=${encodeURIComponent(episodeUrl)}&contentType=episode`);

      if (!response.ok) {
        throw new Error(`Error fetching transcript: ${response.status}`);
      }

      const data = await response.json();
      console.log('Transcript API response:', data);

      // Store in cache if we have access to the Lyrics module
      if (lyrics && typeof lyrics.addToCache === 'function') {
        lyrics.addToCache(cacheKey, data);
      }

      // Display the transcript
      displayTranscript(data);

    } catch (error) {
      console.error('Error fetching podcast transcript:', error);
      elements.podcastTranscriptLoadingEl.classList.add('hidden');
      elements.podcastTranscriptNotFoundEl.classList.remove('hidden');
      elements.podcastTranscriptNotFoundEl.textContent = 'No transcript available for this podcast episode';

      // Even if transcript fetch fails, we should still do age evaluation
      const currentData = ui.getCurrentData();
      if (currentData && currentData.item && ageEvaluation) {
        ageEvaluation.fetchAndDisplayAgeEvaluation(currentData.item, 'episode');
      }
    }
  };

  // Helper function to display podcast transcript
  const displayTranscript = (data) => {
    // Hide loading
    elements.podcastTranscriptLoadingEl.classList.add('hidden');

    // If transcript was found
    if (data.lyrics) {
      // Format and display transcript
      elements.podcastTranscriptContentEl.innerHTML = data.lyrics.replace(/\n/g, '<br>');
      elements.podcastTranscriptContentEl.classList.remove('hidden');

      // Set up source link
      if (data.url) {
        elements.podcastTranscriptSourceLinkEl.href = data.url;
        elements.podcastTranscriptSourceLinkEl.textContent = 'Source: Spotify Podcast Transcript';
        elements.podcastTranscriptSourceEl.classList.remove('hidden');
      }

      // Now that we have transcript, fetch age evaluation
      const currentData = ui.getCurrentData();
      if (currentData && currentData.item && ageEvaluation) {
        ageEvaluation.fetchAndDisplayAgeEvaluation(currentData.item, 'episode');
      }
    } else {
      // Show not found message
      elements.podcastTranscriptNotFoundEl.classList.remove('hidden');
      elements.podcastTranscriptNotFoundEl.textContent = 'No transcript available for this podcast episode';

      if (data.error) {
        console.error('Transcript error:', data.error);
      }

      // Even without transcript, we can still evaluate based on episode info
      const currentData = ui.getCurrentData();
      if (currentData && currentData.item && ageEvaluation) {
        ageEvaluation.fetchAndDisplayAgeEvaluation(currentData.item, 'episode');
      }
    }
  };

  return {
    initialize
  };
})();