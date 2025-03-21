document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const loadingEl = document.getElementById('loading');
  const notPlayingEl = document.getElementById('not-playing');
  const trackContainerEl = document.getElementById('track-container');
  const podcastContainerEl = document.getElementById('podcast-container');
  const historyContainerEl = document.getElementById('history-container');
  const historyLoadingEl = document.getElementById('history-loading');
  const noHistoryEl = document.getElementById('no-history');
  const historyListEl = document.getElementById('history-list');

  // Track Elements
  const albumArtEl = document.getElementById('album-art');
  const trackNameEl = document.getElementById('track-name');
  const artistNameEl = document.getElementById('artist-name');
  const albumNameEl = document.getElementById('album-name');
  const progressBarFillEl = document.getElementById('progress-bar-fill');
  const currentTimeEl = document.getElementById('current-time');
  const totalTimeEl = document.getElementById('total-time');

  // Podcast Elements
  const podcastArtEl = document.getElementById('podcast-art');
  const podcastNameEl = document.getElementById('podcast-name');
  const episodeNameEl = document.getElementById('episode-name');
  const releaseDateEl = document.getElementById('release-date');
  const episodeDescriptionEl = document.getElementById('episode-description');
  const podcastProgressBarFillEl = document.getElementById('podcast-progress-bar-fill');
  const podcastCurrentTimeEl = document.getElementById('podcast-current-time');
  const podcastTotalTimeEl = document.getElementById('podcast-total-time');

  // Current state
  let currentData = null;
  let updateInterval = null;
  let historyRefreshInterval = null;

  // Format time from milliseconds to MM:SS
  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Format date to a readable format
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Update progress bar
  const updateProgress = () => {
    if (!currentData || !currentData.playing) return;

    // If we have data, increment the progress
    if (currentData.progress_ms !== undefined) {
      currentData.progress_ms += 1000; // Add 1 second

      if (currentData.type === 'track') {
        const progressPercent = (currentData.progress_ms / currentData.item.duration_ms) * 100;
        progressBarFillEl.style.width = `${Math.min(progressPercent, 100)}%`;
        currentTimeEl.textContent = formatTime(currentData.progress_ms);
      } else if (currentData.type === 'episode') {
        const progressPercent = (currentData.progress_ms / currentData.item.duration_ms) * 100;
        podcastProgressBarFillEl.style.width = `${Math.min(progressPercent, 100)}%`;
        podcastCurrentTimeEl.textContent = formatTime(currentData.progress_ms);
      }
    }
  };

  // Update UI based on currently playing data
  const updateUI = (data) => {
    // Hide all containers initially
    loadingEl.classList.add('hidden');
    notPlayingEl.classList.add('hidden');
    trackContainerEl.classList.add('hidden');
    podcastContainerEl.classList.add('hidden');

    currentData = data;

    // If nothing is playing
    if (!data || !data.playing) {
      notPlayingEl.classList.remove('hidden');
      return;
    }

    // If it's a track
    if (data.type === 'track') {
      // Update track info
      trackNameEl.textContent = data.item.name;
      artistNameEl.textContent = data.item.artists.map(artist => artist.name).join(', ');
      albumNameEl.textContent = data.item.album.name;

      // Set album art
      if (data.item.album.images && data.item.album.images.length > 0) {
        albumArtEl.src = data.item.album.images[0].url;
      }

      // Update progress
      const progressPercent = (data.progress_ms / data.item.duration_ms) * 100;
      progressBarFillEl.style.width = `${progressPercent}%`;
      currentTimeEl.textContent = formatTime(data.progress_ms);
      totalTimeEl.textContent = formatTime(data.item.duration_ms);

      // Show track container
      trackContainerEl.classList.remove('hidden');
    }
    // If it's a podcast
    else if (data.type === 'episode') {
      // Update podcast info
      podcastNameEl.textContent = data.item.show?.name || 'Unknown Show';
      episodeNameEl.textContent = data.item.name;
      releaseDateEl.textContent = `Released: ${data.item.release_date || 'Unknown'}`;

      // Set podcast description with truncation if needed
      if (data.item.description) {
        episodeDescriptionEl.textContent = data.item.description;
      } else {
        episodeDescriptionEl.textContent = 'No description available';
      }

      // Set podcast art
      if (data.item.images && data.item.images.length > 0) {
        podcastArtEl.src = data.item.images[0].url;
      }

      // Update progress
      const progressPercent = (data.progress_ms / data.item.duration_ms) * 100;
      podcastProgressBarFillEl.style.width = `${progressPercent}%`;
      podcastCurrentTimeEl.textContent = formatTime(data.progress_ms);
      podcastTotalTimeEl.textContent = formatTime(data.item.duration_ms);

      // Show podcast container
      podcastContainerEl.classList.remove('hidden');
    }
  };

  // Fetch recently played tracks and update UI
  const fetchRecentlyPlayed = async () => {
    try {
      historyLoadingEl.classList.remove('hidden');
      noHistoryEl.classList.add('hidden');

      const response = await fetch('/api/recently-played');

      if (!response.ok) {
        throw new Error(`Error fetching data: ${response.status}`);
      }

      const historyItems = await response.json();

      // Hide loading
      historyLoadingEl.classList.add('hidden');

      // Show no history message if no items
      if (!historyItems || historyItems.length === 0) {
        noHistoryEl.classList.remove('hidden');
        return;
      }

      // Clear existing items
      historyListEl.innerHTML = '';

      // Add each history item
      historyItems.forEach(item => {
        const historyItemEl = document.createElement('div');
        historyItemEl.className = 'history-item';

        // Get the item details based on type
        const historyTrack = item.track;
        const isTrack = !!historyTrack;

        // For episodes, the item itself is the content
        const content = isTrack ? historyTrack : item.episode;

        if (!content) return; // Skip if no content

        // Get image
        let imageUrl = '';
        if (isTrack && content.album && content.album.images && content.album.images.length > 0) {
          imageUrl = content.album.images[0].url;
        } else if (!isTrack && content.images && content.images.length > 0) {
          imageUrl = content.images[0].url;
        }

        // Get artist(s)
        let artistNames = '';
        if (isTrack && content.artists) {
          artistNames = content.artists.map(artist => artist.name).join(', ');
        } else if (!isTrack && content.show) {
          artistNames = content.show.name;
        }

        // Get description
        let description = '';
        if (isTrack && content.album) {
          description = `Album: ${content.album.name}`;
        } else if (!isTrack) {
          description = content.description || 'No description available';
        }

        // Format the played at time
        const playedAt = formatDate(item.played_at);

        // Duration if available
        let duration = '';
        if (content.duration_ms) {
          duration = formatTime(content.duration_ms);
        }

        historyItemEl.innerHTML = `
          <img class="history-art" src="${imageUrl}" alt="${isTrack ? 'Album' : 'Podcast'} Art">
          <div class="history-info">
            <div class="history-title">${content.name || 'Unknown Title'}</div>
            <div class="history-artist">${artistNames || 'Unknown Artist'}</div>
            <div class="history-description">${description}</div>
            <div class="history-meta">Played: ${playedAt} ${duration ? `• Duration: ${duration}` : ''}</div>
          </div>
        `;

        historyListEl.appendChild(historyItemEl);
      });

      // Show history container
      historyContainerEl.classList.remove('hidden');

    } catch (error) {
      console.error('Error fetching recently played data:', error);
      historyLoadingEl.classList.add('hidden');
      noHistoryEl.classList.remove('hidden');
    }
  };

  // Fetch currently playing data from the API
  const fetchCurrentlyPlaying = async () => {
    try {
      const response = await fetch('/api/currently-playing');

      if (!response.ok) {
        throw new Error(`Error fetching data: ${response.status}`);
      }

      const data = await response.json();
      updateUI(data);

      // Clear existing interval and start a new one
      if (updateInterval) {
        clearInterval(updateInterval);
      }

      // Update progress every second
      updateInterval = setInterval(updateProgress, 1000);

    } catch (error) {
      console.error('Error fetching currently playing data:', error);
    }
  };

  // Initial fetches
  fetchCurrentlyPlaying();
  fetchRecentlyPlayed();

  // Refresh currently playing data every 30 seconds
  setInterval(fetchCurrentlyPlaying, 30000);

  // Refresh history data every 5 minutes (300,000 ms)
  historyRefreshInterval = setInterval(fetchRecentlyPlayed, 300000);
});
