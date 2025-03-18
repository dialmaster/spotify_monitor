// app.js - Main application file
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = 8888;

// Middleware
app.use(express.static(path.join(__dirname, 'public')))
  .use(cookieParser());

// Load config
const loadConfig = (configPath) => {
  try {
    const configData = fs.readFileSync(path.join(__dirname, configPath), 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    console.error('Error loading config:', error);
    process.exit(1);
  }
};

// Use command line arg to specify config file or default to config.json
const configPath = process.argv[2] || 'config.json';
const config = loadConfig(configPath);

// Set up configuration from the loaded file
const CLIENT_ID = config.clientId;
const CLIENT_SECRET = config.clientSecret;
const REDIRECT_URI = config.redirectUri || 'http://localhost:8888/callback';
const MONITOR_INTERVAL = config.monitorInterval || 30000; // Default 30 seconds

// Generate random string for state
const generateRandomString = (length) => {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

// Store token information
let tokenInfo = {
  access_token: null,
  refresh_token: null,
  expires_at: null
};

// Function to check if token is expired
const isTokenExpired = () => {
  return !tokenInfo.expires_at || Date.now() > tokenInfo.expires_at;
};

// Refresh the access token when it expires
const refreshAccessToken = async () => {
  if (!tokenInfo.refresh_token) {
    console.error('No refresh token available. Please authorize again.');
    return false;
  }

  try {
    const response = await axios({
      method: 'post',
      url: 'https://accounts.spotify.com/api/token',
      params: {
        grant_type: 'refresh_token',
        refresh_token: tokenInfo.refresh_token
      },
      headers: {
        'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const data = response.data;
    tokenInfo.access_token = data.access_token;
    tokenInfo.expires_at = Date.now() + (data.expires_in * 1000);

    if (data.refresh_token) {
      tokenInfo.refresh_token = data.refresh_token;
    }

    return true;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Token refresh error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
    } else {
      console.error('Unexpected error during token refresh:', error.message);
    }
    return false;
  }
};

// Route to start the authentication process
app.get('/login', (req, res) => {
  const state = generateRandomString(16);

  // Set cookie with state
  res.cookie('spotify_auth_state', state);

  // Redirect to Spotify auth page
  const scope = 'user-read-currently-playing user-read-playback-state';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: CLIENT_ID,
      scope: scope,
      redirect_uri: REDIRECT_URI,
      state: state
    }));
});

// Callback route after Spotify authorization
app.get('/callback', async (req, res) => {
  const code = req.query.code || null;
  const state = req.query.state || null;
  const storedState = req.cookies ? req.cookies['spotify_auth_state'] : null;

  if (state === null || state !== storedState) {
    res.send('State mismatch error');
    return;
  }

  res.clearCookie('spotify_auth_state');

  try {
    const response = await axios({
      method: 'post',
      url: 'https://accounts.spotify.com/api/token',
      params: {
        code: code,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const data = response.data;
    tokenInfo.access_token = data.access_token;
    tokenInfo.refresh_token = data.refresh_token;
    tokenInfo.expires_at = Date.now() + (data.expires_in * 1000);

    res.send('Authentication successful! You can close this window.');

    // Start monitoring after successful authentication
    startMonitoring();
  } catch (error) {
    console.error('Error during token exchange:', error.response ? error.response.data : error.message);
    res.send('Error during authentication');
  }
});

// Function to get currently playing track
const getCurrentlyPlaying = async () => {
  try {
    console.log('Checking if token is expired...');
    if (isTokenExpired()) {
      console.log('Token expired, attempting to refresh...');
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        throw new Error('Failed to refresh access token');
      }
      console.log('Token refreshed successfully');
    }

    if (!tokenInfo.access_token) {
      throw new Error('No access token available. Please authorize first.');
    }

    console.log('Making request to Spotify API...');
    const response = await axios({
      method: 'get',
      url: 'https://api.spotify.com/v1/me/player',
      params: {
        additional_types: 'episode'
      },
      headers: {
        'Authorization': 'Bearer ' + tokenInfo.access_token
      }
    });

    // If no content (204), nothing is playing
    if (response.status === 204) {
      console.log('Received 204 status - nothing playing');
      return { playing: false };
    }

    console.log('Received playing data from Spotify:', JSON.stringify(response.data, null, 2));

    // For podcast episodes, the item will be in response.data.item
    // For tracks, it will be in the same place
    return {
      playing: response.data.is_playing,
      type: response.data.currently_playing_type,
      progress_ms: response.data.progress_ms,
      item: response.data.item
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Spotify API Error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
    } else {
      console.error('Error in getCurrentlyPlaying:', error.message);
    }
    throw error; // Re-throw to handle it in the monitoring function
  }
};

// Monitor function
const monitorCurrentlyPlaying = async () => {
  try {
    console.log('\n--- Checking currently playing status ---');
    const data = await getCurrentlyPlaying();

    if (!data) {
      console.log('No data received from Spotify API');
      return;
    }

    const timestamp = new Date().toISOString();

    if (!data.playing) {
      console.log(`[${timestamp}] Nothing is currently playing`);
      return;
    }

    const progress = Math.floor(data.progress_ms / 1000);

    if (data.type === 'track' && data.item) {
      const duration = Math.floor(data.item.duration_ms / 1000);
      console.log(`[${timestamp}] Now playing: ${data.item.name} by ${data.item.artists.map(artist => artist.name).join(', ')} (${progress}s / ${duration}s)`);
    } else if (data.type === 'episode') {
      if (data.item) {
        const duration = Math.floor(data.item.duration_ms / 1000);
        const showName = data.item.show?.name || 'Unknown Show';
        const episodeName = data.item.name || 'Unknown Episode';
        const releaseDate = data.item.release_date || 'Unknown Date';
        console.log(`[${timestamp}] Now playing podcast: ${showName} - ${episodeName} (Released: ${releaseDate}) (${progress}s / ${duration}s)`);

        // Log description if available
        if (data.item.description) {
          console.log(`Episode description: ${data.item.description.slice(0, 200)}${data.item.description.length > 200 ? '...' : ''}`);
        }
      } else {
        console.log('Debug - Full response data:', JSON.stringify(data, null, 2));
        console.log(`[${timestamp}] Now playing podcast episode (${progress}s elapsed)`);
      }
    } else {
      console.log(`[${timestamp}] Playing content of type: ${data.type} (${progress}s elapsed)`);
      console.log('Debug - Unknown content type data:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Monitoring error:`, error.message);
    if (error.message.includes('401')) {
      console.error('Authentication error - you may need to re-authorize. Please visit http://localhost:8888/login');
    }
  }
};

// Function to start monitoring
const startMonitoring = () => {
  console.log('Starting Spotify monitoring...');

  // Run immediately
  monitorCurrentlyPlaying().catch(error => {
    console.error('Error in initial monitoring check:', error.message);
  });

  // Then set interval
  setInterval(() => {
    monitorCurrentlyPlaying().catch(error => {
      console.error('Error in monitoring interval:', error.message);
    });
  }, MONITOR_INTERVAL);
};

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Using config file: ${configPath}`);
  console.log(`To authorize Spotify, open http://localhost:${PORT}/login in your browser`);
});