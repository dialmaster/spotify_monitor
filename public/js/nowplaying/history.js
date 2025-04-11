const History = (() => {
  let elements = null;
  let historyData = []; // Store the history data for use in the modal
  let historyModal = null;

  const initialize = (elementRefs, historyModalInstance) => {
    elements = elementRefs;
    historyModal = historyModalInstance;

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

      const items = await response.json();
      historyData = items; // Save the full data for use in the modal

      // Hide loading
      elements.historyLoadingEl.classList.add('hidden');

      // Show no history message if no items
      if (!items || items.length === 0) {
        elements.noHistoryEl.classList.remove('hidden');
        return;
      }

      // Clear existing items
      elements.historyListEl.innerHTML = '';

      // Add each history item
      items.forEach((item, index) => {
        const historyItemEl = document.createElement('div');
        historyItemEl.className = 'history-item';
        historyItemEl.setAttribute('data-index', index);

        // Make the item clickable
        historyItemEl.style.cursor = 'pointer';

        // Get the item details based on type
        const historyTrack = item.track;
        const isTrack = !!historyTrack;
        const isEpisode = item.track.type === 'episode';

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

        // AI Evaluation HTML
        let aiEvaluationHtml = '';
        if (item.aiEvaluation) {
          const { ageRating, level, confidenceLevel } = item.aiEvaluation;
          if (ageRating && level) {
            aiEvaluationHtml = `
              <div class="history-ai-section">
                <div class="history-ai-left">
                  <div class="history-age-rating">${ageRating}</div>
                  <div class="history-age-level age-level-${level}">${level}</div>
                  ${confidenceLevel ? `<div class="history-confidence confidence-${confidenceLevel}">CONFIDENCE: ${confidenceLevel}</div>` : ''}
                </div>
                <button class="show-details-btn">View details</button>
              </div>
            `;
          } else {
            // Check if the item is whitelisted
            if (item.aiEvaluation.ageRating === 'Whitelisted') {
              aiEvaluationHtml = `
                <div class="history-ai-section">
                  <div class="history-ai-left">
                    <div class="history-ai-not-available whitelisted-item">Item is whitelisted</div>
                  </div>
                  <button class="show-details-btn">View details</button>
                </div>
              `;
            } else {
              aiEvaluationHtml = `
                <div class="history-ai-section">
                  <div class="history-ai-not-available">AI evaluation not available</div>
                  <button class="show-details-btn">View details</button>
                </div>
              `;
            }
          }
        } else {
          aiEvaluationHtml = `
            <div class="history-ai-section">
              <div class="history-ai-not-available">AI evaluation not available</div>
              <button class="show-details-btn">View details</button>
            </div>
          `;
        }

        historyItemEl.innerHTML = `
          <div class="history-item-content">
            <div class="history-top-row">
              <img class="history-art" src="${imageUrl}" alt="${isTrack ? 'Album' : 'Podcast'} Art">
              <div class="history-main-content">
                <div class="history-title-artist">
                  <div class="history-title">${content.name || 'Unknown Title'}</div>
                  <div class="history-artist">${artistNames || 'Unknown Artist'}</div>
                </div>
                <div class="history-album-info">
                  ${isTrack && content.album ? `<span class="history-album">${content.album.name}</span>` : ''}
                  ${!isTrack && content.show ? `<span class="history-show">${content.show.name}</span>` : ''}
                </div>
              </div>
            </div>
            <div class="history-meta">
                <div>Played: ${playedAt.split(':').slice(0, 2).join(':')}</div>
                ${duration ? `<div>Duration: ${duration}</div>` : ''}
            </div>
            ${aiEvaluationHtml}
          </div>
        `;

        // Add click event to open modal
        const showDetailsBtn = historyItemEl.querySelector('.show-details-btn');
        showDetailsBtn.addEventListener('click', () => {
          if (historyModal && historyModal.showModal) {
            historyModal.showModal(historyData[index]);
          }
        });

        // Remove the cursor style since only the button is clickable now
        historyItemEl.style.cursor = 'default';

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