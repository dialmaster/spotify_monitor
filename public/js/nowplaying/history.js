const History = (() => {
  let elements = null;

  const initialize = (elementRefs) => {
    elements = elementRefs;

    return {
      fetchRecentlyPlayed
    };
  };

  // Fetch recently played tracks and update UI
  const fetchRecentlyPlayed = async () => {
    try {
      elements.historyLoadingEl.classList.remove('hidden');
      elements.noHistoryEl.classList.add('hidden');

      const response = await fetch('/api/recently-played');

      if (!response.ok) {
        throw new Error(`Error fetching data: ${response.status}`);
      }

      const historyItems = await response.json();

      // Hide loading
      elements.historyLoadingEl.classList.add('hidden');

      // Show no history message if no items
      if (!historyItems || historyItems.length === 0) {
        elements.noHistoryEl.classList.remove('hidden');
        return;
      }

      // Clear existing items
      elements.historyListEl.innerHTML = '';

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
        const playedAt = Utils.formatDate(item.played_at);

        // Duration if available
        let duration = '';
        if (content.duration_ms) {
          duration = Utils.formatTime(content.duration_ms);
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

        elements.historyListEl.appendChild(historyItemEl);
      });

      // Show history container
      elements.historyContainerEl.classList.remove('hidden');

    } catch (error) {
      console.error('Error fetching recently played data:', error);
      elements.historyLoadingEl.classList.add('hidden');
      elements.noHistoryEl.classList.remove('hidden');
    }
  };

  return {
    initialize
  };
})();