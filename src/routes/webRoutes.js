const express = require('express');
const router = express.Router();
const spotifyService = require('../services/spotifyService');

// Home route - render the main page
router.get('/', (req, res) => {
  // If already authenticated, redirect to now playing
  if (spotifyService.getCachedData.isAuthenticated() && !spotifyService.isTokenExpired()) {
    return res.redirect('/nowplaying');
  }

  // Otherwise show the login page
  res.render('index');
});

// Now playing route
router.get('/nowplaying', (req, res) => {
  // If not authorized, redirect to login
  if (!spotifyService.getCachedData.isAuthenticated() || spotifyService.isTokenExpired()) {
    return res.redirect('/');
  }

  res.render('nowplaying');
});

// Helper route for Spotify cookies setup
router.get('/cookies-help', (req, res) => {
  res.render('cookies-help');
});

module.exports = router;