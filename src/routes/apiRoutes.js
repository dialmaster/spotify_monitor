const express = require('express');
const router = express.Router();
const spotifyService = require('../services/spotifyService');
const lyricsService = require('../services/lyricsService');
const ageEvaluationService = require('../services/ageEvaluationService');
const config = require('../config');

// API endpoint to get currently playing
router.get('/currently-playing', async (req, res) => {
  try {
    // If we don't have a token, return error
    if (!spotifyService.getCachedData.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Use the existing currentPlayback data if it exists and is recent
    // Otherwise, fetch fresh data
    let currentPlayback = spotifyService.getCachedData.currentPlayback();
    if (!currentPlayback || Date.now() - (currentPlayback.timestamp || 0) > 5000) {
      await spotifyService.getCurrentlyPlaying();
      currentPlayback = spotifyService.getCachedData.currentPlayback();
    }

    res.json(currentPlayback || { playing: false });
  } catch (error) {
    console.error('API error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint to get recently played
router.get('/recently-played', async (req, res) => {
  try {
    // If we don't have a token, return error
    if (!spotifyService.getCachedData.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Only fetch new data every 5 minutes
    const fiveMinutesMs = 5 * 60 * 1000;
    let playHistory = spotifyService.getCachedData.playHistory();
    const lastHistoryFetch = spotifyService.getCachedData.lastHistoryFetch();

    if (!playHistory || Date.now() - lastHistoryFetch > fiveMinutesMs) {
      await spotifyService.getRecentlyPlayed();
      playHistory = spotifyService.getCachedData.playHistory();
    }

    res.json(playHistory || []);
  } catch (error) {
    console.error('API error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint to fetch lyrics for a track
router.get('/lyrics', async (req, res) => {
  try {
    const { title, artist, spotifyUrl, contentType } = req.query;

    // If this is a podcast episode request
    if (contentType === 'episode') {
      if (!title || !spotifyUrl) {
        return res.status(400).json({ error: 'Missing required parameters for podcast: title and spotifyUrl' });
      }

      console.log(`Fetching transcript for podcast episode: "${title}"`);

      // Try to get transcript from the Spotify web page
      const transcript = await lyricsService.getSpotifyPodcastTranscript(spotifyUrl);

      if (transcript) {
        console.log('Successfully fetched podcast transcript from Spotify');
        return res.json({
          lyrics: transcript, // We use the lyrics field for consistency with the frontend
          title,
          source: 'spotify-podcast-transcript',
          url: spotifyUrl,
          sourceDetail: 'Official transcript from Spotify podcast'
        });
      } else {
        console.log('Could not fetch transcript for podcast episode');
        return res.json({
          lyrics: null,
          error: 'No transcript available for this podcast episode'
        });
      }
    }

    // Regular track lyrics request
    if (!title || !artist) {
      return res.status(400).json({ error: 'Missing required parameters: title and artist' });
    }

    console.log(`Fetching lyrics for "${title}" by ${artist}`);

    // Variables to hold our results
    let lyrics = null;
    let source = null;

    // First, try the Spotify web page if we have a URL
    if (spotifyUrl) {
      console.log(`Using Spotify URL: ${spotifyUrl}`);

      // Try to get lyrics from the Spotify web page
      lyrics = await lyricsService.getSpotifyLyrics(spotifyUrl);

      if (lyrics) {
        source = 'spotify-web';
        console.log('Successfully fetched lyrics from Spotify web page');

        return res.json({
          lyrics,
          title,
          artist,
          source,
          url: spotifyUrl,
          sourceDetail: 'Official lyrics from Spotify web player'
        });
      } else {
        console.log('Could not fetch lyrics from Spotify web page, falling back to Genius');
      }
    }

    // Fall back to Genius if Spotify methods failed or weren't attempted
    const geniusResult = await lyricsService.getGeniusLyrics(title, artist);

    if (geniusResult) {
      console.log('Successfully fetched lyrics from Genius');
      res.json(geniusResult);
    } else {
      console.log('No lyrics found');
      res.json({
        lyrics: null,
        error: 'Could not find lyrics. Consider configuring Genius API key or Spotify cookies for better results.',
        suggestion: 'See config.json.example for setup instructions'
      });
    }
  } catch (error) {
    console.error('Lyrics API error:', error.message);
    res.status(500).json({ error: 'Error fetching lyrics' });
  }
});

// POST endpoint for age evaluation
router.post('/age-evaluation', async (req, res) => {
  try {
    const { id, type, title, artist, description, lyrics, lyricsSource, spotifyUrl } = req.body;

    // Basic validation
    if (!id || !type || !title) {
      return res.status(400).json({
        error: 'Missing required parameters: id, type, and title'
      });
    }

    // Check if OpenAI is configured
    if (!ageEvaluationService.isAgeEvaluationAvailable()) {
      return res.status(503).json({
        error: 'OpenAI API not configured',
        message: 'Age evaluation requires an OpenAI API key. Please add a valid key to your config file.',
        suggestion: 'You can get an API key at https://platform.openai.com/api-keys'
      });
    }

    // Evaluate the content
    const evaluation = await ageEvaluationService.evaluateContentAge({
      id, type, title, artist, description, lyrics, lyricsSource, spotifyUrl
    });

    // Check if content is blocked and auto-skip is enabled
    if (config.autoSkipBlocked && evaluation.level === 'BLOCK') {
      console.log(`Content "${title}" rated as BLOCK level. Auto-skip is enabled, attempting to skip...`);

      // Get current playback to verify this is still the active track
      const currentPlayback = spotifyService.getCachedData.currentPlayback();

      // Only skip if this is still the currently playing track/episode
      if (currentPlayback && currentPlayback.playing && currentPlayback.item && currentPlayback.item.id === id) {
        const skipResult = await spotifyService.skipToNextTrack();

        // Add the skip result to the evaluation response
        evaluation.autoSkipped = skipResult;

        // Add skip message for the frontend to display
        if (skipResult) {
          evaluation.skipMessage = `"${title}" was auto-skipped due to AI content evaluation. [${Date.now()}]`;
          console.log(`Auto-skipped "${title}" due to BLOCK rating`);
        } else {
          console.log(`Failed to auto-skip "${title}" despite BLOCK rating`);
        }
      } else {
        console.log(`Not auto-skipping "${title}" as it's no longer the active track`);
        evaluation.autoSkipped = false;
      }
    }

    res.json(evaluation);
  } catch (error) {
    console.error('Age evaluation API error:', error.message);
    res.status(500).json({ error: 'Error evaluating content age appropriateness' });
  }
});

module.exports = router;