const HistoryModal = (() => {
  // Private variables
  let elements = null;
  let currentItem = null;

  // Initialize with element references
  const initialize = (elementRefs) => {
    elements = elementRefs;

    // Set up event listeners
    setupEventListeners();

    return {
      showModal
    };
  };

  // Setup event listeners
  const setupEventListeners = () => {
    // Close button click
    elements.modalCloseBtn.addEventListener('click', hideModal);

    // Close on background click
    elements.historyDetailsModal.addEventListener('click', (event) => {
      if (event.target === elements.historyDetailsModal) {
        hideModal();
      }
    });

    // Close on escape key
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !elements.historyDetailsModal.classList.contains('hidden')) {
        hideModal();
      }
    });
  };

  // Show modal with track/episode data
  const showModal = (item) => {
    if (!item) return;

    // Save reference to current item
    currentItem = item;

    // Clear previous content
    clearModalContent();

    // Determine if it's a track or episode
    const isTrack = !!item.track;
    const content = isTrack ? item.track : item.episode;

    if (!content) {
      console.error('Invalid content item');
      return;
    }

    // Set title
    elements.modalTitle.textContent = content.name || 'Unknown Title';

    // Set artist/podcast info
    let artistText = '';
    if (isTrack && content.artists) {
      artistText = content.artists.map(artist => artist.name).join(', ');
    } else if (!isTrack && content.show) {
      artistText = content.show.name;
    }
    elements.modalArtist.textContent = artistText || 'Unknown Artist';

    // Set album/show info
    let albumText = '';
    if (isTrack && content.album) {
      albumText = content.album.name;
    } else if (!isTrack) {
      albumText = 'Podcast Episode';
    }
    elements.modalAlbum.textContent = albumText || '';

    // Set image
    let imageUrl = '';
    if (isTrack && content.album && content.album.images && content.album.images.length > 0) {
      imageUrl = content.album.images[0].url;
    } else if (!isTrack && content.images && content.images.length > 0) {
      imageUrl = content.images[0].url;
    }

    if (imageUrl) {
      elements.modalArt.src = imageUrl;
      elements.modalArt.alt = isTrack ? 'Album Art' : 'Podcast Art';
    } else {
      elements.modalArt.src = '/img/default-album-art.png';
      elements.modalArt.alt = 'Default Art';
    }

    // Set played at time
    if (item.played_at) {
      elements.modalPlayedAt.textContent = `Played: ${Utils.formatDate(item.played_at)}`;
    } else {
      elements.modalPlayedAt.textContent = '';
    }

    // Set Spotify link
    if (content.external_urls && content.external_urls.spotify) {
      elements.modalSpotifyLink.href = content.external_urls.spotify;
      elements.modalSpotifyLink.classList.remove('hidden');
    } else {
      elements.modalSpotifyLink.classList.add('hidden');
    }

    // Set AI Evaluation if available
    if (item.aiEvaluation) {
      const { ageRating, level, confidenceLevel, confidenceExplanation, explanation } = item.aiEvaluation;

      if (ageRating === 'Whitelisted') {
        // Special handling for whitelisted content
        elements.modalAgeContainer.classList.remove('hidden');
        elements.modalAgeRating.textContent = 'Whitelisted';
        elements.modalAgeLevel.textContent = level || 'WARNING';
        elements.modalAgeLevel.className = `age-level age-level-${level || 'WARNING'}`;

        if (confidenceLevel) {
          elements.modalConfidenceLevel.classList.remove('hidden');
          elements.modalConfidenceText.textContent = confidenceLevel;
          elements.modalConfidenceLevel.className = `confidence-level confidence-${confidenceLevel}`;

          elements.modalConfidenceExplanation.textContent = confidenceExplanation || 'Track is in whitelist';
        } else {
          elements.modalConfidenceLevel.classList.add('hidden');
        }

        elements.modalAgeExplanation.textContent = explanation || 'This content has been whitelisted by the administrator.';
      } else if (ageRating && level) {
        elements.modalAgeContainer.classList.remove('hidden');
        elements.modalAgeRating.textContent = ageRating;
        elements.modalAgeLevel.textContent = level;
        elements.modalAgeLevel.className = `age-level age-level-${level}`;

        if (confidenceLevel) {
          elements.modalConfidenceLevel.classList.remove('hidden');
          elements.modalConfidenceText.textContent = confidenceLevel;
          elements.modalConfidenceLevel.className = `confidence-level confidence-${confidenceLevel}`;

          if (confidenceExplanation) {
            elements.modalConfidenceExplanation.textContent = confidenceExplanation;
          } else {
            elements.modalConfidenceExplanation.textContent = 'No explanation available for confidence level';
          }
        } else {
          elements.modalConfidenceLevel.classList.add('hidden');
        }

        if (explanation) {
          elements.modalAgeExplanation.textContent = explanation;
        } else {
          elements.modalAgeExplanation.textContent = 'No detailed explanation available';
        }
      } else {
        elements.modalAgeContainer.classList.add('hidden');
      }
    } else {
      elements.modalAgeContainer.classList.add('hidden');
    }

    // Set lyrics if available
    if (item.lyrics) {
      elements.modalLyricsContainer.classList.remove('hidden');
      elements.modalLyricsContent.textContent = item.lyrics;
      elements.modalLyricsContent.classList.remove('hidden');
      elements.modalLyricsNotFound.classList.add('hidden');
    } else {
      elements.modalLyricsContainer.classList.remove('hidden');
      elements.modalLyricsContent.classList.add('hidden');
      elements.modalLyricsNotFound.classList.remove('hidden');
    }

    // Show modal
    elements.historyDetailsModal.classList.remove('hidden');
    elements.historyDetailsModal.classList.add('visible');

    // Prevent body scrolling when modal is open
    document.body.style.overflow = 'hidden';
  };

  // Hide modal
  const hideModal = () => {
    elements.historyDetailsModal.classList.remove('visible');

    // After transition completes, hide completely
    setTimeout(() => {
      elements.historyDetailsModal.classList.add('hidden');
      // Re-enable body scrolling
      document.body.style.overflow = '';
    }, 300);
  };

  // Clear modal content
  const clearModalContent = () => {
    elements.modalTitle.textContent = '';
    elements.modalArtist.textContent = '';
    elements.modalAlbum.textContent = '';
    elements.modalArt.src = '';
    elements.modalPlayedAt.textContent = '';
    elements.modalSpotifyLink.href = '#';
    elements.modalAgeRating.textContent = '';
    elements.modalAgeLevel.textContent = '';
    elements.modalConfidenceText.textContent = '';
    elements.modalConfidenceExplanation.textContent = '';
    elements.modalAgeExplanation.textContent = '';
    elements.modalLyricsContent.textContent = '';
  };

  return {
    initialize
  };
})();