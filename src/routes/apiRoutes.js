const express = require('express');
const router = express.Router();
const spotifyService = require('../services/spotifyService');
const recentlyPlayedService = require('../services/recentlyPlayed');
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
    console.log('currently-playing-cache route called');
    res.json(cacheService.getCurrentlyPlaying());
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

module.exports = router;