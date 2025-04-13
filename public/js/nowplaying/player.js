const Player = (() => {
  let elements = null;
  let ui = null;
  let lyrics = null;
  let transcript = null;
  let updateInterval = null;
  let ageEvaluation = null;

  const initialize = (elementRefs, uiModule) => {
    elements = elementRefs;
    ui = uiModule;

    return {
      fetchCurrentlyPlayingCached,
      setLyricsModule: (lyricsModule) => { lyrics = lyricsModule; },
      setTranscriptModule: (transcriptModule) => { transcript = transcriptModule; },
      setAgeEvaluationModule: (ageEvalModule) => { ageEvaluation = ageEvalModule; }
    };
  };

  const fetchCurrentlyPlayingCached = async () => {
    // This includes track, lyrics, and age evaluation
    const response = await fetch('/api/currently-playing-cache');

    if (!response.ok) {
      throw new Error(`Error fetching data: ${response.status}`);
    }

    const data = await response.json();
    if (data.status === 'UNAUTHORIZED') {
        console.log("User not authenticated, redirecting to login page");
        window.location.href = "/";
        return;
    }

    // Update TRACK information
    ui.updateUITrackCached(data.track);

    // Clear existing interval and start a new one
    if (updateInterval) {
      clearInterval(updateInterval);
    }

    // Update progress every second
    updateInterval = setInterval(() => {
      ui.updateProgress();
    }, 1000);

    lyrics.displayLyricsOrTranscriptCached(data);

    ageEvaluation.displayAgeEvaluationCached(data);

  }

  return {
    initialize
  };
})();