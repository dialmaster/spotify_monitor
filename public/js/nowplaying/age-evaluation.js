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
      displayAgeEvaluationCached,
      clearCache: () => ageEvalCache.clear(),
      setToastModule: (toastModule) => { toast = toastModule; }
    };
  };

  const displayAgeEvaluationCached = (data) => {
    const type = data.track.contentType;

    // Select the appropriate age evaluation elements based on content type
    const ageContainerEl = type === 'track' ? elements.trackAgeContainerEl : elements.podcastAgeContainerEl;
    const ageLoadingEl = type === 'track' ? elements.trackAgeLoadingEl : elements.podcastAgeLoadingEl;
    const ageContentEl = type === 'track' ? elements.trackAgeContentEl : elements.podcastAgeContentEl;
    const ageRatingEl = type === 'track' ? elements.trackAgeRatingEl : elements.podcastAgeRatingEl;
    const ageExplanationEl = type === 'track' ? elements.trackAgeExplanationEl : elements.podcastAgeExplanationEl;
    const ageErrorEl = type === 'track' ? elements.trackAgeErrorEl : elements.podcastAgeErrorEl;
    const confidenceLevelEl = type === 'track' ? elements.trackConfidenceLevelEl : elements.podcastConfidenceLevelEl;
    // Skip if elements don't exist
    if (!ageContainerEl) return;

    // If no age evaluation data, just return
    if (!data.ageEvaluation || !data.ageEvaluation.evaluation || !data.ageEvaluation.evaluation.ageRating) {
      console.log('AgeEvaluation: displayAgeEvaluationCached() and no age evaluation data found, nothing to do');
      return;
    }

    // If currently fetching, display the loading spinner
    if (data.ageEvaluation.currentlyFetching) {
        ageContainerEl.classList.remove('hidden');
        ageLoadingEl.classList.remove('hidden');
        ageContentEl.classList.add('hidden');
        ageRatingEl.classList.add('hidden');
        ageExplanationEl.classList.add('hidden');
        return;
    }

    // If there is an error, display it
    if (data.ageEvaluation.error) {
        ageContainerEl.classList.remove('hidden');
        ageLoadingEl.classList.add('hidden');
        ageErrorEl.classList.remove('hidden');
        ageErrorEl.textContent = data.ageEvaluation.error;
        ageContentEl.classList.add('hidden');
        ageRatingEl.classList.add('hidden');
        ageExplanationEl.classList.add('hidden');
        return;
    }



    // Else display the age evaluation from the data
    ageContainerEl.classList.remove('hidden');
    ageLoadingEl.classList.add('hidden');
    ageContentEl.classList.remove('hidden');
    ageRatingEl.classList.remove('hidden');
    ageExplanationEl.classList.remove('hidden');

    ageRatingEl.textContent = data.ageEvaluation.evaluation.ageRating;

    // Clean up the explanation if needed
    let explanation = data.ageEvaluation.evaluation.explanation;
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

    ageExplanationEl.textContent = explanation;

    // Handle the level indicator (if it exists in the DOM)
    const levelEl = data.track.contentType === 'track' ? elements.trackAgeLevelEl : elements.podcastAgeLevelEl;
    if (levelEl && data.ageEvaluation.evaluation.level) {
      // Set the level text
      levelEl.textContent = data.ageEvaluation.evaluation.level;

      // Remove any existing level classes
      levelEl.classList.remove('age-level-OK', 'age-level-WARNING', 'age-level-BLOCK');

      // Add the appropriate class based on level
      levelEl.classList.add(`age-level-${data.ageEvaluation.evaluation.level}`);

      // Make sure it's visible
      levelEl.classList.remove('hidden');
    }

    let confidenceText = 'Confidence: ' + data.ageEvaluation.evaluation.confidence.level;
    let tooltipText = getDefaultTooltipText(data.ageEvaluation.evaluation.confidence.level);
    confidenceLevelEl.innerHTML = confidenceText +
          ` <span class="confidence-info">i<span class="confidence-tooltip">${tooltipText}</span></span>`;

    // Remove any existing confidence classes
    confidenceLevelEl.classList.remove('confidence-HIGH', 'confidence-MEDIUM', 'confidence-LOW');

    // Add the appropriate class based on confidence
    confidenceLevelEl.classList.add(`confidence-${data.ageEvaluation.evaluation.confidence.level}`);

    // Make sure it's visible
    confidenceLevelEl.classList.remove('hidden');
  }

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

  return {
    initialize
  };
})();