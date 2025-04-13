const Player = (() => {
  let elements = null;
  let ui = null;
  let lyrics = null;
  let transcript = null;
  let updateInterval = null;
  let ageEvaluation = null;
  let eventSource = null;
  let clientId = null;
  let connectionStatus = 'connected'; // 'connected', 'disconnected', 'connecting'
  let reconnectTimeout = null;
  let disconnectedStartTime = null;
  let disconnectionTimer = null;

  const initialize = (elementRefs, uiModule) => {
    elements = elementRefs;
    ui = uiModule;

    // Generate a client ID for SSE connections
    clientId = generateUUID();

    // Connect to event stream
    connectToEventStream();

    return {
      fetchCurrentlyPlaying,
      setLyricsModule: (lyricsModule) => { lyrics = lyricsModule; },
      setTranscriptModule: (transcriptModule) => { transcript = transcriptModule; },
      setAgeEvaluationModule: (ageEvalModule) => { ageEvaluation = ageEvalModule; },
      closeConnection,
      getConnectionStatus: () => connectionStatus
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

  // Format the disconnection time
  const formatDisconnectionTime = () => {
    if (!disconnectedStartTime) return '';

    const now = new Date();
    const diffMs = now - disconnectedStartTime;
    const seconds = Math.floor((diffMs / 1000) % 60);
    const minutes = Math.floor((diffMs / (1000 * 60)) % 60);
    const hours = Math.floor((diffMs / (1000 * 60 * 60)));

    if (hours > 0) {
      return `Disconnected for ${hours}h${minutes}m${seconds}s`;
    } else if (minutes > 0) {
      return `Disconnected for ${minutes}m${seconds}s`;
    } else {
      return `Disconnected for ${seconds}s`;
    }
  };

  // Update the disconnection timer in the UI
  const updateDisconnectionTimer = () => {
    if (elements.connectionStatusTextEl && connectionStatus === 'disconnected') {
      elements.connectionStatusTextEl.textContent = formatDisconnectionTime();
    }
  };

  const updateConnectionStatus = (status) => {
    // If status hasn't changed, don't do anything (except for disconnection timer updates)
    if (connectionStatus === status) {
      if (status === 'disconnected') {
        updateDisconnectionTimer();
      }
      return;
    }

    connectionStatus = status;

    // Update UI via elements
    if (elements.connectionStatusContainerEl) {
      if (status === 'connected') {
        // Hide the indicator when connected
        elements.connectionStatusContainerEl.classList.add('hidden');

        // Clear disconnection timer if it exists
        if (disconnectionTimer) {
          clearInterval(disconnectionTimer);
          disconnectionTimer = null;
        }

        // Reset disconnected start time
        disconnectedStartTime = null;
      } else {
        // Show the indicator when disconnected or connecting
        elements.connectionStatusContainerEl.classList.remove('hidden');

        if (elements.connectionStatusTextEl) {
          if (status === 'connecting') {
            elements.connectionStatusTextEl.textContent = 'Connecting...';
            elements.connectionStatusTextEl.className = ''; // Reset classes
            elements.connectionStatusTextEl.classList.add('connection-status-connecting');
          } else if (status === 'disconnected') {
            // If we just became disconnected, start tracking the time
            if (!disconnectedStartTime) {
              disconnectedStartTime = new Date();

              // Start the disconnection timer
              if (disconnectionTimer) {
                clearInterval(disconnectionTimer);
              }
              disconnectionTimer = setInterval(updateDisconnectionTimer, 1000);

              // Initial update
              updateDisconnectionTimer();
            }

            elements.connectionStatusTextEl.className = ''; // Reset classes
            elements.connectionStatusTextEl.classList.add('connection-status-disconnected');
          }
        }
      }
    }
  };

  // Connect to the SSE endpoint
  const connectToEventStream = () => {
    // Close any existing connection
    if (eventSource) {
      eventSource.close();
    }

    // Clear any pending reconnect timeout
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }

    updateConnectionStatus('connecting');

    // Create a new connection
    eventSource = new EventSource(`/api/stream-events?clientId=${clientId}`);

    // Handle connection open
    eventSource.onopen = () => {
      console.log('SSE connection established');
      updateConnectionStatus('connected');
    };

    // Handle incoming messages
    eventSource.onmessage = (event) => {
      try {
        updateConnectionStatus('connected');
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
      updateConnectionStatus('disconnected');

      // Try to reconnect after 10 seconds
      reconnectTimeout = setTimeout(() => {
        console.log('Attempting to reconnect SSE...');
        connectToEventStream();
      }, 10000);
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

    // Clear any pending reconnect timeout
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }

    // Clear disconnection timer if it exists
    if (disconnectionTimer) {
      clearInterval(disconnectionTimer);
      disconnectionTimer = null;
    }

    updateConnectionStatus('disconnected');
  };

  return {
    initialize
  };
})();