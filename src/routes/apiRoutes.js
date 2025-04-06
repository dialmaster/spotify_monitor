const express = require('express');
const router = express.Router();
const spotifyService = require('../services/spotifyService');
const lyricsService = require('../services/lyricsService');
const ageEvaluationService = require('../services/ageEvaluationService');
const logService = require('../services/logService');
const recentlyPlayedService = require('../services/recentlyPlayed');
const config = require('../config');
const trackRepository = require('../repositories/trackRepository');
const recentlyPlayedRepository = require('../repositories/recentlyPlayedRepository');
const rateLimit = require('express-rate-limit');
const cacheService = require('../services/cacheService');

// Configure rate limiting middleware
// Note, it's not a super high rate limit, but enough to prevent DDOS attacks
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // limit each IP to 60 requests per minute (1 per second)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    error: 'Too many requests, please try again after a minute',
    status: 429
  }
});

// Apply rate limiting to all API routes
router.use(apiLimiter);

// This will be the only route the frontend will need to call in a loop
router.get('/currently-playing-cache', async (req, res) => {
    res.json(currentlyPlayingCacheService.getCurrentlyPlaying());
});

// API endpoint to get currently playing
router.get('/currently-playing', async (req, res) => {
  console.log('/currently-playing route called');
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

// API endpoint to get user profile
router.get('/user-profile', async (req, res) => {
  try {
    // If we don't have a token, return error
    if (!spotifyService.getCachedData.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get the user profile from cache
    let userProfile = spotifyService.getCachedData.userProfile();

    // If user profile isn't fetched yet, get it
    if (!userProfile.fetched) {
      try {
        userProfile = await spotifyService.getCurrentUserProfile();
      } catch (profileError) {
        console.error('Error fetching user profile:', profileError.message);
        return res.status(500).json({ error: 'Error fetching user profile' });
      }
    }

    // Return the display_name and email only
    res.json({
      display_name: userProfile.display_name || 'Unknown User',
      email: userProfile.email || 'No email available'
    });
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

    try {
      // Get recently played tracks using the service
      const mergedHistory = await recentlyPlayedService.getRecentlyPlayed(25);
      res.json(mergedHistory);
    } catch (error) {
      console.error('Error retrieving recently played history:', error.message);
      res.status(500).json({ error: 'Error retrieving play history' });
    }
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

      // Extract the episode ID from the URL
      const episodeIdMatch = spotifyUrl.match(/episode\/([a-zA-Z0-9]+)/);
      const episodeId = episodeIdMatch ? episodeIdMatch[1] : null;

      // Check if we already have the transcript in the database
      if (episodeId) {
        try {
          const storedTrack = await trackRepository.findTrackById(episodeId);
          if (storedTrack && storedTrack.lyrics) {
            console.log(`Found existing transcript in database for episode ${episodeId}`);
            return res.json({
              lyrics: storedTrack.lyrics,
              title,
              source: storedTrack.lyricsSource || 'database',
              url: spotifyUrl,
              sourceDetail: 'Retrieved from database (previously saved from Spotify)'
            });
          }
        } catch (dbError) {
          console.error('Error checking database for transcript:', dbError.message);
          // Continue to fetch from Spotify if database check fails
        }
      }

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

    // Extract the track ID from the URL if available
    let trackId = null;
    if (spotifyUrl) {
      const trackIdMatch = spotifyUrl.match(/track\/([a-zA-Z0-9]+)/);
      trackId = trackIdMatch ? trackIdMatch[1] : null;
    }

    // First, check if we already have lyrics in the database
    if (trackId) {
      try {
        const storedTrack = await trackRepository.findTrackById(trackId);
        if (storedTrack && storedTrack.lyrics) {
          console.log(`Found existing lyrics in database for track ${trackId}`);
          return res.json({
            lyrics: storedTrack.lyrics,
            title,
            artist,
            source: storedTrack.lyricsSource || 'database',
            url: spotifyUrl,
            sourceDetail: `Retrieved from database (previously saved from ${storedTrack.lyricsSource || 'unknown source'})`
          });
        }
      } catch (dbError) {
        console.error('Error checking database for lyrics:', dbError.message);
        // Continue to fetch lyrics from other sources if database check fails
      }
    }

    // If no lyrics in database and we have a Spotify URL, try the Spotify web page
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
    const geniusResult = await lyricsService.getGeniusLyrics(title, artist, trackId);

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
    const { id, type, title, artist, description, spotifyUrl } = req.body;

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
      id, type, title, artist, description, spotifyUrl
    });

    // Log the evaluation to file
    // Create a mock item object that contains the minimum information needed for logging
    const item = {
      id,
      name: title,
      artists: artist ? [{ name: artist }] : undefined,
      show: type === 'episode' && title ? { name: title.split(' - ')[0] } : undefined
    };

    // Log the evaluation results
    logService.logAgeEvaluation(item, evaluation);

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

          // Log the auto-skip to file
          logService.logAutoSkip(currentPlayback.item, 'BLOCK rating from age evaluation', evaluation);
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

// POST endpoint to skip a blocked track
router.post('/skip-blocked', async (req, res) => {
  try {
    const { id } = req.body;

    // Basic validation
    if (!id) {
      return res.status(400).json({
        error: 'Missing required parameter: id'
      });
    }

    // Get current playback to verify this is still the active track
    const currentPlayback = spotifyService.getCachedData.currentPlayback();

    // Only skip if this is still the currently playing track/episode
    if (currentPlayback && currentPlayback.playing && currentPlayback.item && currentPlayback.item.id === id) {
      const skipResult = await spotifyService.skipToNextTrack();

      if (skipResult) {
        console.log(`Successfully skipped blocked track "${currentPlayback.item.name}"`);

        // Log the auto-skip to file
        logService.logAutoSkip(currentPlayback.item, 'BLOCK rating from age evaluation (re-skip)', null);

        res.json({
          success: true,
          message: 'Track skipped successfully',
          skipMessage: `"${currentPlayback.item.name}" was auto-skipped again due to age restrictions. [${Date.now()}]`
        });
      } else {
        console.log(`Failed to skip blocked track "${currentPlayback.item.name}"`);
        res.status(500).json({ error: 'Failed to skip track' });
      }
    } else {
      console.log(`Not skipping track as it's no longer the active track`);
      res.status(400).json({ error: 'Track is no longer playing' });
    }
  } catch (error) {
    console.error('Skip blocked track API error:', error.message);
    res.status(500).json({ error: 'Error skipping blocked track' });
  }
});

module.exports = router;