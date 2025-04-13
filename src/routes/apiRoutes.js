const express = require('express');
const router = express.Router();
const spotifyService = require('../services/spotifyService');
const recentlyPlayedService = require('../services/recentlyPlayed');
const rateLimit = require('express-rate-limit');
const cacheService = require('../services/cacheService');
const sseService = require('../services/sseService');

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

// Apply rate limiting to all API routes except SSE endpoint
router.use(/^(?!\/stream-events).+/, apiLimiter);

// Get data about the currently playing track
router.get('/currently-playing', async (req, res) => {
    res.json(cacheService.getCurrentlyPlaying());
});

// Server-Sent Events (SSE) endpoint for real-time updates
router.get('/stream-events', async (req, res) => {
  const clientId = req.query.clientId;

  if (!clientId) {
    return res.status(400).json({
      error: 'Missing clientId parameter',
      status: 400
    });
  }

  // Set up SSE connection
  sseService.addClient(clientId, res);

  // Send initial data to the client
  const currentData = cacheService.getCurrentlyPlaying();
  res.write(`data: ${JSON.stringify(currentData)}\n\n`);
});

// Get user profile information
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

// Get recently played track history information
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

module.exports = router;