const Player = (() => {
  let elements = null;
  let ui = null;
  let lyrics = null;
  let transcript = null;
  let updateInterval = null;
  let ageEvaluation = null;
  let eventSource = null;
  let clientId = null;

  const initialize = (elementRefs, uiModule) => {
    elements = elementRefs;
    ui = uiModule;

    // Generate a client ID for SSE connections
    clientId = generateUUID();

    // Connect to SSE endpoint
    connectToEventStream();

    return {
      fetchCurrentlyPlaying,
      setLyricsModule: (lyricsModule) => { lyrics = lyricsModule; },
      setTranscriptModule: (transcriptModule) => { transcript = transcriptModule; },
      setAgeEvaluationModule: (ageEvalModule) => { ageEvaluation = ageEvalModule; },
      closeConnection
    };
  };

  // Generate a UUID v4
  const generateUUID = () => {
    if (window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }

    // Fallback for older browsers
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0,
            v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  // Connect to the SSE endpoint
  const connectToEventStream = () => {
    // Close any existing connection
    if (eventSource) {
      eventSource.close();
    }

    // Create a new connection
    eventSource = new EventSource(`/api/stream-events?clientId=${clientId}`);

    // Handle connection open
    eventSource.onopen = () => {
      console.log('SSE connection established');
    };

    // Handle incoming messages
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Process the data update
        if (data.track) {
          ui.updateUITrack(data.track);

          // Clear existing interval and start a new one
          if (updateInterval) {
            clearInterval(updateInterval);
          }

          // Update progress every second
          updateInterval = setInterval(() => {
            ui.updateProgress();
          }, 1000);

          // Handle lyrics/transcript and age evaluation
          if (lyrics) lyrics.displayLyricsOrTranscript(data);
          if (ageEvaluation) ageEvaluation.displayAgeEvaluation(data);
        }
      } catch (error) {
        console.error('Error processing SSE message:', error);
      }
    };

    // Handle connection error
    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);

      // Try to reconnect after a delay
      setTimeout(() => {
        console.log('Attempting to reconnect SSE...');
        connectToEventStream();
      }, 5000);
    };
  };

  // Legacy method kept for compatibility
  const fetchCurrentlyPlaying = async () => {
    // Only used for initial fetch or manual refresh
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

  // Close SSE connection
  const closeConnection = () => {
    if (eventSource) {
      console.log('Closing SSE connection');
      eventSource.close();
      eventSource = null;
    }
  };

  return {
    initialize
  };
})();