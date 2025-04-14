const Elements = (() => {
  // All DOM element references
  let elements = {};

  // Initialize and get all DOM elements
  const initialize = () => {
    // Main elements
    elements.loadingEl = document.getElementById('loading');
    elements.notPlayingEl = document.getElementById('not-playing');
    elements.trackContainerEl = document.getElementById('track-container');
    elements.podcastContainerEl = document.getElementById('podcast-container');
    elements.historyContainerEl = document.getElementById('history-container');
    elements.historyLoadingEl = document.getElementById('history-loading');
    elements.noHistoryEl = document.getElementById('no-history');
    elements.historyListEl = document.getElementById('history-list');

    // User info elements
    elements.userInfoContainerEl = document.getElementById('user-info-container');
    elements.userDisplayNameEl = document.getElementById('user-display-name');
    elements.userEmailEl = document.getElementById('user-email');

    // Connection status elements
    elements.connectionStatusContainerEl = document.getElementById('connection-status-container');
    elements.connectionStatusTextEl = document.getElementById('connection-status-text');

    // Track Elements
    elements.albumArtEl = document.getElementById('album-art');
    elements.trackNameEl = document.getElementById('track-name');
    elements.artistNameEl = document.getElementById('artist-name');
    elements.albumNameEl = document.getElementById('album-name');
    elements.progressBarFillEl = document.getElementById('progress-bar-fill');
    elements.currentTimeEl = document.getElementById('current-time');
    elements.totalTimeEl = document.getElementById('total-time');
    elements.spotifyTrackLinkEl = document.getElementById('spotify-track-link');

    // Lyrics Elements
    elements.lyricsContainerEl = document.getElementById('lyrics-container');
    elements.lyricsLoadingEl = document.getElementById('lyrics-loading');
    elements.lyricsContentEl = document.getElementById('lyrics-content');
    elements.lyricsNotFoundEl = document.getElementById('lyrics-not-found');
    elements.lyricsSourceEl = document.getElementById('lyrics-source');
    elements.lyricsSourceLinkEl = document.getElementById('lyrics-source-link');

    // Podcast Elements
    elements.podcastArtEl = document.getElementById('podcast-art');
    elements.podcastNameEl = document.getElementById('podcast-name');
    elements.episodeNameEl = document.getElementById('episode-name');
    elements.releaseDateEl = document.getElementById('release-date');
    elements.episodeDescriptionEl = document.getElementById('episode-description');
    elements.podcastDescriptionEl = document.getElementById('podcast-description');
    elements.podcastProgressBarFillEl = document.getElementById('podcast-progress-bar-fill');
    elements.podcastCurrentTimeEl = document.getElementById('podcast-current-time');
    elements.podcastTotalTimeEl = document.getElementById('podcast-total-time');
    elements.spotifyPodcastLinkEl = document.getElementById('spotify-podcast-link');

    // Podcast Transcript Elements
    elements.podcastTranscriptContainerEl = document.getElementById('podcast-transcript-container');
    elements.podcastTranscriptLoadingEl = document.getElementById('podcast-transcript-loading');
    elements.podcastTranscriptContentEl = document.getElementById('podcast-transcript-content');
    elements.podcastTranscriptNotFoundEl = document.getElementById('podcast-transcript-not-found');
    elements.podcastTranscriptSourceEl = document.getElementById('podcast-transcript-source');
    elements.podcastTranscriptSourceLinkEl = document.getElementById('podcast-transcript-source-link');

    // Track Age Evaluation Elements
    elements.trackAgeContainerEl = document.getElementById('track-age-container');
    elements.trackAgeLoadingEl = document.getElementById('track-age-loading');
    elements.trackAgeContentEl = document.getElementById('track-age-content');
    elements.trackAgeRatingEl = document.getElementById('track-age-rating');
    elements.trackAgeLevelEl = document.getElementById('track-age-level');
    elements.trackAgeExplanationEl = document.getElementById('track-age-explanation');
    elements.trackAgeErrorEl = document.getElementById('track-age-error');
    elements.trackConfidenceLevelEl = document.getElementById('track-confidence-level');

    // Podcast Age Evaluation Elements
    elements.podcastAgeContainerEl = document.getElementById('podcast-age-container');
    elements.podcastAgeLoadingEl = document.getElementById('podcast-age-loading');
    elements.podcastAgeContentEl = document.getElementById('podcast-age-content');
    elements.podcastAgeRatingEl = document.getElementById('podcast-age-rating');
    elements.podcastAgeLevelEl = document.getElementById('podcast-age-level');
    elements.podcastAgeExplanationEl = document.getElementById('podcast-age-explanation');
    elements.podcastAgeErrorEl = document.getElementById('podcast-age-error');
    elements.podcastConfidenceLevelEl = document.getElementById('podcast-confidence-level');

    // Modal elements
    elements.historyDetailsModal = document.getElementById('history-details-modal');
    elements.modalTitle = document.getElementById('modal-title');
    elements.modalCloseBtn = document.getElementById('modal-close-btn');
    elements.modalArt = document.getElementById('modal-art');
    elements.modalArtist = document.getElementById('modal-artist');
    elements.modalAlbum = document.getElementById('modal-album');
    elements.modalPlayedAt = document.getElementById('modal-played-at');
    elements.modalSpotifyLink = document.getElementById('modal-spotify-link');
    elements.modalAgeContainer = document.getElementById('modal-age-container');
    elements.modalAgeRating = document.getElementById('modal-age-rating');
    elements.modalAgeLevel = document.getElementById('modal-age-level');
    elements.modalConfidenceLevel = document.getElementById('modal-confidence-level');
    elements.modalConfidenceText = document.getElementById('modal-confidence-text');
    elements.modalConfidenceExplanation = document.getElementById('modal-confidence-explanation');
    elements.modalAgeExplanation = document.getElementById('modal-age-explanation');
    elements.modalLyricsContainer = document.getElementById('modal-lyrics-container');
    elements.modalLyricsContent = document.getElementById('modal-lyrics-content');
    elements.modalLyricsNotFound = document.getElementById('modal-lyrics-not-found');

    return elements;
  };

  return {
    initialize
  };
})();