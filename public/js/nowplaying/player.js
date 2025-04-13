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
      fetchCurrentlyPlaying,
      setLyricsModule: (lyricsModule) => { lyrics = lyricsModule; },
      setTranscriptModule: (transcriptModule) => { transcript = transcriptModule; },
      setAgeEvaluationModule: (ageEvalModule) => { ageEvaluation = ageEvalModule; }
    };
  };

  const fetchCurrentlyPlaying = async () => {
    // This includes track, lyrics, and age evaluation
    const response = await fetch('/api/currently-playing');

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
    ui.updateUITrack(data.track);

    // Clear existing interval and start a new one
    if (updateInterval) {
      clearInterval(updateInterval);
    }

    // Update progress every second
    updateInterval = setInterval(() => {
      ui.updateProgress();
    }, 1000);

    lyrics.displayLyricsOrTranscript(data);

    ageEvaluation.displayAgeEvaluation(data);

  }

  return {
    initialize
  };
})();