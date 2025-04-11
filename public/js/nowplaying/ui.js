const UI = (() => {
  let elements = null;
  let currentData = null;
  let updateInterval = null;
  let trackedProgress = null;

  const initialize = (elementRefs) => {
    elements = elementRefs;
    return {
      updateUI,
      updateUITrackCached,
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

  const updateUITrackCached = (data) => {
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

  }

  // Update UI based on currently playing data
  const updateUI = (data) => {
    console.log('UI: updateUI() and updating UI with track information: ' + JSON.stringify(data));
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
      const progressPercent = (data.progress / data.duration) * 100;
      elements.progressBarFillEl.style.width = `${progressPercent}%`;
      elements.currentTimeEl.textContent = Utils.formatTime(data.progress);
      elements.totalTimeEl.textContent = Utils.formatTime(data.duration);

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
      const progressPercent = (data.progress / data.duration) * 100;
      elements.podcastProgressBarFillEl.style.width = `${progressPercent}%`;
      elements.podcastCurrentTimeEl.textContent = Utils.formatTime(data.progress);
      elements.podcastTotalTimeEl.textContent = Utils.formatTime(data.duration);

      // Show podcast container
      elements.podcastContainerEl.classList.remove('hidden');
    }
  };

  return {
    initialize
  };
})();