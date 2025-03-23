const express = require('express');
const router = express.Router();
const spotifyService = require('../services/spotifyService');

// Route to start the authentication process
router.get('/login', (req, res) => {
  const state = spotifyService.generateRandomString(16);

  // Set cookie with state
  res.cookie('spotify_auth_state', state);

  // Redirect to Spotify auth page
  res.redirect(spotifyService.getAuthorizationUrl(state));
});

// Callback route after Spotify authorization
router.get('/callback', async (req, res) => {
  const code = req.query.code || null;
  const state = req.query.state || null;
  const storedState = req.cookies ? req.cookies['spotify_auth_state'] : null;

  if (state === null || state !== storedState) {
    res.send('State mismatch error');
    return;
  }

  res.clearCookie('spotify_auth_state');

  try {
    const success = await spotifyService.exchangeCodeForToken(code);

    if (success) {
      // Redirect to the now playing page
      res.redirect('/nowplaying');

      // Start monitoring after successful authentication
      spotifyService.startMonitoring();
    } else {
      res.send('Error during authentication');
    }
  } catch (error) {
    console.error('Error during token exchange:', error.message);
    res.send('Error during authentication');
  }
});

module.exports = router;