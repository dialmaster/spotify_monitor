const AgeEvaluation = (() => {
  let elements = null;
  let ui = null;
  let toast = null;
  // Age evaluation cache
  const ageEvalCache = new Map();

  const initialize = (elementRefs, uiModule) => {
    elements = elementRefs;
    ui = uiModule;

    return {
      fetchAndDisplayAgeEvaluation,
      clearCache: () => ageEvalCache.clear(),
      setToastModule: (toastModule) => { toast = toastModule; }
    };
  };

  // Fetch and display age evaluation for a track or podcast
  const fetchAndDisplayAgeEvaluation = async (item, type) => {
    console.log('Fetching age evaluation for:', item, type);
    try {
      // Select the appropriate age evaluation elements based on content type
      const ageContainerEl = type === 'track' ? elements.trackAgeContainerEl : elements.podcastAgeContainerEl;
      const ageLoadingEl = type === 'track' ? elements.trackAgeLoadingEl : elements.podcastAgeLoadingEl;
      const ageContentEl = type === 'track' ? elements.trackAgeContentEl : elements.podcastAgeContentEl;
      const ageRatingEl = type === 'track' ? elements.trackAgeRatingEl : elements.podcastAgeRatingEl;
      const ageExplanationEl = type === 'track' ? elements.trackAgeExplanationEl : elements.podcastAgeExplanationEl;
      const ageErrorEl = type === 'track' ? elements.trackAgeErrorEl : elements.podcastAgeErrorEl;

      // Skip if elements don't exist
      if (!ageContainerEl) return;

      // Reset age evaluation UI
      ageContainerEl.classList.remove('hidden');
      ageLoadingEl.classList.remove('hidden');
      ageLoadingEl.textContent = `Evaluating ${type === 'track' ? 'track' : 'podcast'} "${item.name}" with AI...`;
      ageContentEl.classList.add('hidden');
      ageErrorEl.classList.add('hidden');

      // Check for required data
      if (!item || !item.id) {
        console.error('Missing item data for age evaluation');
        showAgeError(ageLoadingEl, ageErrorEl, 'Cannot evaluate: Missing data');
        return;
      }

      // Create cache key
      const cacheKey = item.id;

      // Check local cache first
      if (ageEvalCache.has(cacheKey)) {
        console.log(`Using local cache for age evaluation of "${item.name}"`);
        const cachedData = ageEvalCache.get(cacheKey);

        // If this song was previously blocked and auto-skipped, skip it again
        if (cachedData.level === 'BLOCK' && cachedData.autoSkipped === true) {
          console.log(`Song "${item.name}" was previously blocked and auto-skipped. Skipping again...`);

          // Call the skip-blocked endpoint
          try {
            const response = await fetch('/api/skip-blocked', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ id: item.id })
            });

            if (!response.ok) {
              throw new Error(`Error: ${response.status}`);
            }

            const result = await response.json();
            if (result.success) {
              // Show skip notification
              if (result.skipMessage && toast) {
                // Clean up the message to remove timestamp if present
                const cleanMessage = result.skipMessage.replace(/\s*\[\d+\]$/, '');
                toast.showToast(cleanMessage);
              } else if (toast) {
                toast.showToast(`"${item.name}" was auto-skipped again due to age restrictions.`);
              }
            }
          } catch (error) {
            console.error('Error skipping blocked track:', error);
          }
        }

        // Add the type to the cached data for level element selection
        cachedData.type = type;

        displayAgeEvaluation(
          cachedData,
          ageLoadingEl,
          ageContentEl,
          ageRatingEl,
          ageExplanationEl,
          ageErrorEl
        );
        return;
      }

      // Create request data object
      const requestData = {
        id: item.id,
        type: type,
        title: item.name || 'Unknown'
      };

      // Add additional data based on content type
      if (type === 'track') {
        requestData.artist = item.artists?.[0]?.name || 'Unknown';
      } else if (type === 'episode') {
        if (item.description) {
          requestData.description = item.description;
        }
      }

      // Also pass spotifyUrl if available
      if (item.external_urls && item.external_urls.spotify) {
        requestData.spotifyUrl = item.external_urls.spotify;
      }

      console.log(`Requesting age evaluation for "${item.name}"`);

      console.log('Making age evaluation request...');
      const response = await fetch('/api/age-evaluation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Error: ${response.status}`);
      }

      const data = await response.json();
      console.log('Age evaluation response:', data);

      // Add the type to the data for level element selection
      data.type = type;

      // Store in local cache
      ageEvalCache.set(cacheKey, data);

      // Display the evaluation
      displayAgeEvaluation(
        data,
        ageLoadingEl,
        ageContentEl,
        ageRatingEl,
        ageExplanationEl,
        ageErrorEl
      );
    } catch (error) {
      console.error('Error fetching age evaluation:', error);
      const ageLoadingEl = type === 'track' ? elements.trackAgeLoadingEl : elements.podcastAgeLoadingEl;
      const ageErrorEl = type === 'track' ? elements.trackAgeErrorEl : elements.podcastAgeErrorEl;
      showAgeError(ageLoadingEl, ageErrorEl, error.message || 'Error evaluating content');
    }
  };

  // Helper function to display age evaluation
  const displayAgeEvaluation = (data, loadingEl, contentEl, ratingEl, explanationEl, errorEl) => {
    // Hide loading
    loadingEl.classList.add('hidden');

    // If evaluation data exists
    if (data && data.ageRating) {
      // Set content
      ratingEl.textContent = data.ageRating;

      // Clean up the explanation if needed
      let explanation = data.explanation;
      // If the explanation still has JSON format strings, extract just the explanation text
      if (explanation.includes('"explanation":')) {
        try {
          // Try to parse it as JSON
          const parsed = JSON.parse(explanation);
          explanation = parsed.explanation || explanation;
        } catch (e) {
          // If parsing fails, try to extract the explanation using regex
          const match = explanation.match(/"explanation"\s*:\s*"([^"]+)"/);
          if (match && match[1]) {
            explanation = match[1];
          }
        }
      }

      // Check if content was auto-skipped and show toast notification
      if (data.autoSkipped === true && data.skipMessage && toast) {
        // Clean up the message to remove timestamp if present
        const cleanMessage = data.skipMessage.replace(/\s*\[\d+\]$/, '');
        toast.showToast(cleanMessage);
      }

      // Add auto-skip notification if the track was skipped
      if (data.level === 'BLOCK' && data.autoSkipped === true) {
        explanation += ' \n\n⚠️ This content was automatically skipped due to your age settings.';
      }

      // Set the explanation text
      explanationEl.textContent = explanation;

      // Handle the level indicator (if it exists in the DOM)
      const levelEl = data.type === 'track' ? elements.trackAgeLevelEl : elements.podcastAgeLevelEl;
      if (levelEl && data.level) {
        // Set the level text
        levelEl.textContent = data.level;

        // Remove any existing level classes
        levelEl.classList.remove('age-level-OK', 'age-level-WARNING', 'age-level-BLOCK');

        // Add the appropriate class based on level
        levelEl.classList.add(`age-level-${data.level}`);

        // Make sure it's visible
        levelEl.classList.remove('hidden');
      }

      // Handle the confidence level
      const confidenceLevelEl = data.type === 'track' ? elements.trackConfidenceLevelEl : elements.podcastConfidenceLevelEl;
      if (confidenceLevelEl) {
        // Get confidence level from data or determine it based on lyrics source
        let confidenceLevel;
        let confidenceText = 'Confidence: ';
        let tooltipText = '';

        // First check if server provided confidence info
        if (data.confidence && data.confidence.level) {
          confidenceLevel = data.confidence.level;
          tooltipText = data.confidence.explanation || getDefaultTooltipText(confidenceLevel);
        }
        // Otherwise determine based solely on lyrics source, regardless of content type
        else {
          // Check if we have lyrics and determine the source
          if (data.lyricsSource) {
            // Spotify sources get HIGH confidence
            if (data.lyricsSource === 'spotify-web' ||
                data.lyricsSource === 'spotify-api' ||
                data.lyricsSource === 'spotify-podcast-transcript') {
              confidenceLevel = 'HIGH';
              tooltipText = data.sourceDetail || getDefaultTooltipText('HIGH');
            }
            // Genius gets MEDIUM confidence
            else if (data.lyricsSource === 'genius') {
              confidenceLevel = 'MEDIUM';
              tooltipText = data.sourceDetail || getDefaultTooltipText('MEDIUM');
            }
            // Any other source gets LOW confidence
            else {
              confidenceLevel = 'LOW';
              tooltipText = getDefaultTooltipText('LOW');
            }
          }
          // No lyrics = LOW confidence
          else {
            confidenceLevel = 'LOW';
            tooltipText = getDefaultTooltipText('LOW');
          }
        }

        // Set the confidence level text with info icon and tooltip
        confidenceLevelEl.innerHTML = confidenceText + confidenceLevel +
          ` <span class="confidence-info">i<span class="confidence-tooltip">${tooltipText}</span></span>`;

        // Remove any existing confidence classes
        confidenceLevelEl.classList.remove('confidence-HIGH', 'confidence-MEDIUM', 'confidence-LOW');

        // Add the appropriate class based on confidence
        confidenceLevelEl.classList.add(`confidence-${confidenceLevel}`);

        // Make sure it's visible
        confidenceLevelEl.classList.remove('hidden');

        // Store the confidence level in the data for cache
        data.confidenceLevel = confidenceLevel;
      }

      // Show content
      contentEl.classList.remove('hidden');
    } else {
      // Show error if no valid data
      showAgeError(loadingEl, errorEl, 'No age evaluation available');
    }
  };

  // Helper function to get default tooltip text based on confidence level
  const getDefaultTooltipText = (confidenceLevel) => {
    switch(confidenceLevel) {
      case 'HIGH':
        return 'HIGH confidence: Evaluation based on complete lyrics/transcript directly from Spotify.';
      case 'MEDIUM':
        return 'MEDIUM confidence: Evaluation based on lyrics from a third-party source (Genius).';
      case 'LOW':
        return 'LOW confidence: No lyrics/transcript available for analysis.';
      default:
        return 'Confidence level indicates how reliable this evaluation is based on available lyrics or transcript.';
    }
  };

  // Helper function to show age evaluation errors
  const showAgeError = (loadingEl, errorEl, message) => {
    loadingEl.classList.add('hidden');
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  };

  return {
    initialize
  };
})();