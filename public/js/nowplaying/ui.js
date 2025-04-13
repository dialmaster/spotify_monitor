const UI = (() => {
  let elements = null;
  let currentData = null;
  let updateInterval = null;
  let trackedProgress = null;
  let history = null;
  const initialize = (elementRefs) => {
    elements = elementRefs;
    return {
      updateUITrack,
      updateProgress,
      setHistoryModule: (historyModule) => { history = historyModule; },
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
    if (trackedProgress !== undefined && trackedProgress < currentData.duration) {
      trackedProgress += 1000; // Add 1 second

      if (currentData.contentType === 'track') {
        const progressPercent = (trackedProgress / currentData.duration) * 100;
        elements.progressBarFillEl.style.width = `${Math.min(progressPercent, 100)}%`;
        elements.currentTimeEl.textContent = Utils.formatTime(trackedProgress);

        // Check if track has ended (reached end of duration)
        if (trackedProgress >= currentData.duration) {
          console.log('Track has ended, fetching new data in 1 second...');
          return true;
        }
      } else if (currentData.contentType === 'episode') {
        const progressPercent = (trackedProgress / currentData.duration) * 100;
        elements.podcastProgressBarFillEl.style.width = `${Math.min(progressPercent, 100)}%`;
        elements.podcastCurrentTimeEl.textContent = Utils.formatTime(trackedProgress);

        // Check if episode has ended (reached end of duration)
        if (trackedProgress >= currentData.duration) {
          console.log('Episode has ended');
          return true;
        }
      }
    }
    return false;
  };

  const updateHistory = (previouslyPlayingData, nowPlayingData) => {
    // If nothing is playing, and nowthing was playing, then don't fetch history
    if ((!nowPlayingData || !nowPlayingData.playing) && (!previouslyPlayingData || !previouslyPlayingData.playing)) {
      return;
    }

    // If the same track is still playing, then don't fetch history
    if (previouslyPlayingData && nowPlayingData && nowPlayingData.playing && previouslyPlayingData.spotifyUrl === nowPlayingData.spotifyUrl) {
      return;
    }

    if (previouslyPlayingData && nowPlayingData && nowPlayingData.playing && previouslyPlayingData.spotifyUrl !== nowPlayingData.spotifyUrl) {
        // If a track is still playing, then we should show a toast in history.js
        // This is to display the blocked content notification for the previous track
        history.fetchRecentlyPlayed(true, true);
    }

    // If no track was playing, but now one is, then fetch history, but don't show a toast
    // But set currentlyPlaying to true so we don't show THIS (the last) item in the history list
    if (previouslyPlayingData === null && (nowPlayingData && nowPlayingData.playing)) {
        history.fetchRecentlyPlayed(false, true);
    }

    // If no track IS playing, but one WAS, then fetch history, don't show a toast
    // But set currentlyPlaying to false so we don't show the last item in the history list
    if ((!nowPlayingData || !nowPlayingData.playing) && previouslyPlayingData !== null) {
        history.fetchRecentlyPlayed(false, false);
    }
  }

  const updateUITrack = (data) => {
    const previouslyPlayingData = currentData;

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

    if (trackedProgress === null) {
        trackedProgress = data.progress;
    }

    // If trackedProgress is more than 5 seconds different from data.progress, update the tracked progress
    if (trackedProgress && data.progress && Math.abs(trackedProgress - data.progress) > 5000) {
        trackedProgress = data.progress;
    }

    // Ew global variable
    currentData = data;

    // If nothing is playing
    if (!data || !data.playing) {
        elements.notPlayingEl.classList.remove('hidden');
        updateHistory(previouslyPlayingData, data);
        return;
    }
    // If it's a track
    if (data.contentType === 'track') {
        // Update track info
        elements.trackNameEl.textContent = data.title;
        elements.artistNameEl.textContent = data.artist;
        elements.albumNameEl.textContent = data.album;

        // Set album art
        if (data.imageUrl) {
        elements.albumArtEl.src = data.imageUrl;
        }

        // Set Spotify Link if available
        if (data.spotifyUrl) {
        elements.spotifyTrackLinkEl.href = data.spotifyUrl;
        elements.spotifyTrackLinkEl.classList.remove('hidden');
        } else {
        elements.spotifyTrackLinkEl.classList.add('hidden');
        }

        // Update progress
        const progressPercent = (trackedProgress / data.duration) * 100;
        elements.progressBarFillEl.style.width = `${progressPercent}%`;
        elements.currentTimeEl.textContent = Utils.formatTime(trackedProgress);
        elements.totalTimeEl.textContent = Utils.formatTime(data.duration);

        // Show track container
        elements.trackContainerEl.classList.remove('hidden');
    }
    // If it's a podcast
    else if (data.contentType === 'episode') {
        // Update podcast info
        elements.podcastNameEl.textContent = data.artist || 'Unknown Show';
        elements.episodeNameEl.textContent = data.title;
        elements.releaseDateEl.textContent = `Released: ${data.releaseDate || 'Unknown'}`;

        // Note: The PODCAST description is in data.description!
        if (data.description) {
            elements.podcastDescriptionEl.textContent = data.description.length > 200 ? data.description.substring(0, 200) + '...' : data.description;
            elements.podcastDescriptionEl.classList.remove('hidden');
        } else {
            elements.podcastDescriptionEl.textContent = '';
            elements.podcastDescriptionEl.classList.add('hidden');
        }

        // Set podcast episode description
        if (data.htmlDescription) {
        elements.episodeDescriptionEl.innerHTML = data.htmlDescription;
        } else {
        elements.episodeDescriptionEl.textContent = 'No description available';
        }

        // Set podcast art
        if (data.imageUrl) {
        elements.podcastArtEl.src = data.imageUrl;
        }

        // Set Spotify Link if available
        if (data.spotifyUrl) {
        elements.spotifyPodcastLinkEl.href = data.spotifyUrl;
        elements.spotifyPodcastLinkEl.classList.remove('hidden');
        } else {
        elements.spotifyPodcastLinkEl.classList.add('hidden');
        }

        // Update progress
        const progressPercent = (data.progress / data.duration) * 100;
        elements.podcastProgressBarFillEl.style.width = `${progressPercent}%`;
        elements.podcastCurrentTimeEl.textContent = Utils.formatTime(data.progress);
        elements.podcastTotalTimeEl.textContent = Utils.formatTime(data.duration);

        // Show podcast container
        elements.podcastContainerEl.classList.remove('hidden');
    }

    updateHistory(previouslyPlayingData, data);
  }

  return {
    initialize
  };
})();