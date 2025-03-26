const UI = (() => {
  let elements = null;
  let currentData = null;
  let updateInterval = null;

  const initialize = (elementRefs) => {
    elements = elementRefs;
    return {
      updateUI,
      updateProgress,
      getCurrentData: () => currentData,
      setCurrentData: (data) => { currentData = data; },
      setUpdateInterval: (interval) => { updateInterval = interval; },
      clearUpdateInterval: () => {
        if (updateInterval) {
          clearInterval(updateInterval);
          updateInterval = null;
        }
      }
    };
  };

  // Update progress bar
  const updateProgress = () => {
    if (!currentData || !currentData.playing) return;

    // If we have data, increment the progress
    if (currentData.progress_ms !== undefined) {
      currentData.progress_ms += 1000; // Add 1 second

      if (currentData.type === 'track') {
        const progressPercent = (currentData.progress_ms / currentData.item.duration_ms) * 100;
        elements.progressBarFillEl.style.width = `${Math.min(progressPercent, 100)}%`;
        elements.currentTimeEl.textContent = Utils.formatTime(currentData.progress_ms);

        // Check if track has ended (reached end of duration)
        if (currentData.progress_ms >= currentData.item.duration_ms) {
          console.log('Track has ended, fetching new data in 1 second...');
          // Handled by the Player module
          return true;
        }
      } else if (currentData.type === 'episode') {
        const progressPercent = (currentData.progress_ms / currentData.item.duration_ms) * 100;
        elements.podcastProgressBarFillEl.style.width = `${Math.min(progressPercent, 100)}%`;
        elements.podcastCurrentTimeEl.textContent = Utils.formatTime(currentData.progress_ms);

        // Check if episode has ended (reached end of duration)
        if (currentData.progress_ms >= currentData.item.duration_ms) {
          console.log('Episode has ended, fetching new data in 1 second...');
          // Handled by the Player module
          return true;
        }
      }
    }
    return false;
  };

  // Update UI based on currently playing data
  const updateUI = (data) => {
    // Hide all containers initially
    elements.loadingEl.classList.add('hidden');
    elements.notPlayingEl.classList.add('hidden');
    elements.trackContainerEl.classList.add('hidden');
    elements.podcastContainerEl.classList.add('hidden');
    elements.lyricsContainerEl.classList.add('hidden');
    elements.podcastTranscriptContainerEl.classList.add('hidden');

    // Hide age containers
    if (elements.trackAgeContainerEl) elements.trackAgeContainerEl.classList.add('hidden');
    if (elements.podcastAgeContainerEl) elements.podcastAgeContainerEl.classList.add('hidden');

    currentData = data;

    // If nothing is playing
    if (!data || !data.playing) {
      elements.notPlayingEl.classList.remove('hidden');
      return;
    }

    // If it's a track
    if (data.type === 'track') {
      // Update track info
      elements.trackNameEl.textContent = data.item.name;
      elements.artistNameEl.textContent = data.item.artists.map(artist => artist.name).join(', ');
      elements.albumNameEl.textContent = data.item.album.name;

      // Set album art
      if (data.item.album.images && data.item.album.images.length > 0) {
        elements.albumArtEl.src = data.item.album.images[0].url;
      }

      // Set Spotify Link if available
      if (data.item.external_urls && data.item.external_urls.spotify) {
        elements.spotifyTrackLinkEl.href = data.item.external_urls.spotify;
        elements.spotifyTrackLinkEl.classList.remove('hidden');
      } else {
        elements.spotifyTrackLinkEl.classList.add('hidden');
      }

      // Update progress
      const progressPercent = (data.progress_ms / data.item.duration_ms) * 100;
      elements.progressBarFillEl.style.width = `${progressPercent}%`;
      elements.currentTimeEl.textContent = Utils.formatTime(data.progress_ms);
      elements.totalTimeEl.textContent = Utils.formatTime(data.item.duration_ms);

      // Show track container
      elements.trackContainerEl.classList.remove('hidden');
    }
    // If it's a podcast
    else if (data.type === 'episode') {
      // Update podcast info
      elements.podcastNameEl.textContent = data.item.show?.name || 'Unknown Show';
      elements.episodeNameEl.textContent = data.item.name;
      elements.releaseDateEl.textContent = `Released: ${data.item.release_date || 'Unknown'}`;

      // Set podcast description
      if (data.item.description) {
        elements.episodeDescriptionEl.textContent = data.item.description;
      } else {
        elements.episodeDescriptionEl.textContent = 'No description available';
      }

      // Set podcast art
      if (data.item.images && data.item.images.length > 0) {
        elements.podcastArtEl.src = data.item.images[0].url;
      }

      // Set Spotify Link if available
      if (data.item.external_urls && data.item.external_urls.spotify) {
        elements.spotifyPodcastLinkEl.href = data.item.external_urls.spotify;
        elements.spotifyPodcastLinkEl.classList.remove('hidden');
      } else {
        elements.spotifyPodcastLinkEl.classList.add('hidden');
      }

      // Update progress
      const progressPercent = (data.progress_ms / data.item.duration_ms) * 100;
      elements.podcastProgressBarFillEl.style.width = `${progressPercent}%`;
      elements.podcastCurrentTimeEl.textContent = Utils.formatTime(data.progress_ms);
      elements.podcastTotalTimeEl.textContent = Utils.formatTime(data.item.duration_ms);

      // Show podcast container
      elements.podcastContainerEl.classList.remove('hidden');
    }
  };

  return {
    initialize
  };
})();