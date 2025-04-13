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
      displayLyricsOrTranscript,
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

  const displayLyricsOrTranscript = (data) => {
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

  return {
    initialize
  };
})();