const Player = (() => {
  let elements = null;
  let ui = null;
  let lyrics = null;
  let transcript = null;
  let updateInterval = null;

  const initialize = (elementRefs, uiModule) => {
    elements = elementRefs;
    ui = uiModule;

    return {
      fetchCurrentlyPlaying,
      setLyricsModule: (lyricsModule) => { lyrics = lyricsModule; },
      setTranscriptModule: (transcriptModule) => { transcript = transcriptModule; }
    };
  };

  // Fetch currently playing data from the API
  const fetchCurrentlyPlaying = async () => {
    try {
      const response = await fetch('/api/currently-playing');

      if (!response.ok) {
        throw new Error(`Error fetching data: ${response.status}`);
      }

      const data = await response.json();

      // Check for authentication error
      if (data.error === "Not authenticated") {
        console.log("User not authenticated, redirecting to login page");
        window.location.href = "/";
        return;
      }

      ui.updateUI(data);

      // Clear existing interval and start a new one
      if (updateInterval) {
        clearInterval(updateInterval);
      }

      // Update progress every second
      updateInterval = setInterval(() => {
        const shouldRefresh = ui.updateProgress();
        if (shouldRefresh) {
          // Wait 1 second then fetch new data
          setTimeout(() => {
            fetchCurrentlyPlaying();
          }, 1000);
        }
      }, 1000);

      // If it's a track, fetch lyrics
      if (data && data.playing && data.type === 'track' && lyrics) {
        lyrics.fetchAndDisplayLyrics(data.item.name, data.item.artists[0].name);
      }
      // If it's a podcast, fetch transcript
      else if (data && data.playing && data.type === 'episode' && transcript) {
        // Check if we have a Spotify URL
        if (data.item.external_urls && data.item.external_urls.spotify) {
          transcript.fetchAndDisplayTranscript(data.item.name, data.item.external_urls.spotify);
        }
      }

    } catch (error) {
      console.error('Error fetching currently playing data:', error);
    }
  };

  return {
    initialize
  };
})();