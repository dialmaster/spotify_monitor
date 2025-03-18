document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const loadingEl = document.getElementById('loading');
  const notPlayingEl = document.getElementById('not-playing');
  const trackContainerEl = document.getElementById('track-container');
  const podcastContainerEl = document.getElementById('podcast-container');

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

  // Format time from milliseconds to MM:SS
  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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

  // Initial fetch
  fetchCurrentlyPlaying();

  // Refresh data every 30 seconds
  setInterval(fetchCurrentlyPlaying, 30000);
});
