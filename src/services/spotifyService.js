const axios = require('axios');
const querystring = require('querystring');
const config = require('../config');
const logService = require('./logService');
const trackRepository = require('../repositories/trackRepository');
const recentlyPlayedRepository = require('../repositories/recentlyPlayedRepository');
const spotifyAuthRepository = require('../repositories/spotifyAuthRepository');

// Helper function to generate a random string for state
const generateRandomString = (length) => {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

// Token storage
const tokenInfo = {
  access_token: null,
  refresh_token: null,
  expires_at: null
};

// User profile information storage
const userInfo = {
  id: null,
  display_name: null,
  email: null,
  explicit_content: null,
  fetched: false
};

let currentPlayback = null;
let playHistory = null;
let lastHistoryFetch = 0;

const loadTokensFromDatabase = async () => {
  try {
    const userTokens = await spotifyAuthRepository.getTokens(config.clientId);
    console.log('Found user tokens for clientId', config.clientId, JSON.stringify(userTokens));

    if (userTokens) {
      tokenInfo.access_token = userTokens.accessToken;
      tokenInfo.refresh_token = userTokens.refreshToken;
      tokenInfo.expires_at = userTokens.expiresAt ? new Date(userTokens.expiresAt).getTime() : null;

      console.log(`Loaded tokens for clientId ${userTokens.clientId} from database`);
      return true;
    } else {
      console.log('No tokens found in database');
      return false;
    }
  } catch (error) {
    console.error('Error loading tokens from database:', error.message);
    return false;
  }
};

const saveTokensToDatabase = async () => {
  try {
    // We can save tokens without a user ID since the primary key is client_id
    await spotifyAuthRepository.saveTokens({
      clientId: config.clientId,
      accessToken: tokenInfo.access_token,
      refreshToken: tokenInfo.refresh_token,
      expiresAt: tokenInfo.expires_at ? new Date(tokenInfo.expires_at) : null
    });

    console.log(`Saved tokens for clientId ${config.clientId} to database`);
    return true;
  } catch (error) {
    console.error('Error saving tokens to database:', error.message);
    return false;
  }
};

const isTokenExpired = () => {
  return !tokenInfo.expires_at || Date.now() > tokenInfo.expires_at;
};

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
        'Authorization': 'Basic ' + Buffer.from(config.clientId + ':' + config.clientSecret).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const data = response.data;
    tokenInfo.access_token = data.access_token;
    tokenInfo.expires_at = Date.now() + (data.expires_in * 1000);

    if (data.refresh_token) {
      tokenInfo.refresh_token = data.refresh_token;
    }

    try {
      if (userInfo.id) {
        await saveTokensToDatabase();
      } else {
        try {
          await getCurrentUserProfile();
        } catch (profileError) {
          console.error('Could not fetch user profile to get user ID:', profileError.message);
          // We'll continue even without saving to database
        }
      }
    } catch (dbError) {
      console.error('Failed to save tokens to database:', dbError.message);
      // Continue even if database save fails - we still have valid tokens in memory
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

const getCurrentUserProfile = async () => {
  if (userInfo.fetched) {
    console.log('User profile already fetched, using cached data');
    return userInfo;
  }

  try {
    if (isTokenExpired()) {
      console.log('Token expired, attempting to refresh before fetching user profile...');
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        throw new Error('Failed to refresh access token');
      }
    }

    if (!tokenInfo.access_token) {
      throw new Error('No access token available. Please authorize first.');
    }

    console.log('Fetching user profile information...');
    const response = await axios({
      method: 'get',
      url: 'https://api.spotify.com/v1/me',
      headers: {
        'Authorization': 'Bearer ' + tokenInfo.access_token
      }
    });

    // Store only the fields we're interested in
    userInfo.id = response.data.id;
    userInfo.display_name = response.data.display_name;
    userInfo.email = response.data.email;
    userInfo.explicit_content = response.data.explicit_content;
    userInfo.fetched = true;

    console.log('User profile fetched successfully:');
    console.log(`- User ID: ${userInfo.id}`);
    console.log(`- Display Name: ${userInfo.display_name}`);
    console.log(`- Email: ${userInfo.email}`);
    console.log(`- Explicit Content Filter Enabled: ${userInfo.explicit_content?.filter_enabled}`);
    console.log(`- Explicit Content Filter Locked: ${userInfo.explicit_content?.filter_locked}`);

    // Save tokens to database now that we have a user ID
    await saveTokensToDatabase();

    return userInfo;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Spotify API Error (User Profile):', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message
      });
    } else {
      console.error('Error in getCurrentUserProfile:', error.message);
    }
    throw error;
  }
};

const exchangeCodeForToken = async (code) => {
  try {
    const response = await axios({
      method: 'post',
      url: 'https://accounts.spotify.com/api/token',
      params: {
        code: code,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + Buffer.from(config.clientId + ':' + config.clientSecret).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const data = response.data;
    tokenInfo.access_token = data.access_token;
    tokenInfo.refresh_token = data.refresh_token;
    tokenInfo.expires_at = Date.now() + (data.expires_in * 1000);

    // Fetch user profile information after successful token exchange
    try {
      await getCurrentUserProfile();
    } catch (profileError) {
      console.error('Error fetching user profile:', profileError.message);
      // Continue even if profile fetch fails
    }

    return true;
  } catch (error) {
    console.error('Error during token exchange:', error.response ? error.response.data : error.message);
    return false;
  }
};

// Get currently playing track
const getCurrentlyPlaying = async () => {
  try {
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
      currentPlayback = { playing: false };
      return { playing: false };
    }

    // For podcast episodes or tracks, create the response object
    const playbackData = {
      playing: response.data.is_playing,
      type: response.data.currently_playing_type,
      progress_ms: response.data.progress_ms,
      item: response.data.item,
      timestamp: Date.now()
    };

    // Store the current playback for the API
    currentPlayback = playbackData;

    // Check if something is playing and we have a valid item
    if (playbackData.playing && playbackData.item && playbackData.item.id) {
      // First save the track to database
      try {
        const trackData = {
          trackId: playbackData.item.id,
          type: playbackData.type,
          title: playbackData.item.name,
          duration: playbackData.item.duration_ms
        };

        // Handle track-specific fields
        if (playbackData.type === 'track') {
          trackData.artist = playbackData.item.artists.map(artist => artist.name).join(', ');
          trackData.album = playbackData.item.album?.name;
          trackData.albumArt = playbackData.item.album?.images?.[0]?.url;
          trackData.imageUrl = playbackData.item.album?.images?.[0]?.url;
        }
        // Handle episode-specific fields
        else if (playbackData.type === 'episode') {
          trackData.artist = playbackData.item.show?.publisher;
          trackData.album = playbackData.item.show?.name;
          trackData.albumArt = playbackData.item.images?.[0]?.url;
          trackData.imageUrl = playbackData.item.images?.[0]?.url;
          trackData.description = playbackData.item.description;
        }

        const result = await trackRepository.saveTrack(trackData);
        if (result.created) {
          console.log(`New ${playbackData.type} saved to database with ID: ${trackData.trackId}`);
        } else {
          console.log(`${playbackData.type} already exists in database with ID: ${trackData.trackId}`);
        }
      } catch (dbError) {
        console.error('Error saving track to database:', dbError.message);
        console.error('Database error details:', dbError);
        // Continue execution even if database save fails
      }
    }

    return playbackData;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Spotify API Error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message
      });
    } else {
      console.error('Error in getCurrentlyPlaying:', error.message);
    }
    throw error;
  }
};

// Get recently played tracks
const getRecentlyPlayed = async () => {
  try {
    if (isTokenExpired()) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        throw new Error('Failed to refresh access token');
      }
    }

    if (!tokenInfo.access_token) {
      throw new Error('No access token available. Please authorize first.');
    }

    console.log('Fetching recently played tracks...');
    const response = await axios({
      method: 'get',
      url: 'https://api.spotify.com/v1/me/player/recently-played',
      params: {
        limit: 25,
        additional_types: 'episode,show'
      },
      headers: {
        'Authorization': 'Bearer ' + tokenInfo.access_token
      }
    });

    playHistory = response.data.items;
    lastHistoryFetch = Date.now();

    return playHistory;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Spotify API Error (Recently Played):', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message
      });
    } else {
      console.error('Error in getRecentlyPlayed:', error.message);
    }
    throw error;
  }
};

// Skip to the next track
const skipToNextTrack = async () => {
  try {
    console.log('Attempting to skip to next track due to age restriction...');

    if (isTokenExpired()) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        throw new Error('Failed to refresh access token');
      }
    }

    if (!tokenInfo.access_token) {
      throw new Error('No access token available. Please authorize first.');
    }

    // Call the Spotify API to skip to the next track
    const response = await axios({
      method: 'post',
      url: 'https://api.spotify.com/v1/me/player/next',
      headers: {
        'Authorization': 'Bearer ' + tokenInfo.access_token
      }
    });

    // Status 204 means success with no content, 200 is also a success
    if (response.status === 204 || response.status === 200) {
      console.log('Successfully skipped to next track');
      return true;
    } else {
      console.error('Unexpected response from Spotify skip API:', response.status, response.statusText);
      return false;
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Spotify API Error (Skip Track):', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message
      });
    } else {
      console.error('Error in skipToNextTrack:', error.message);
    }
    return false;
  }
};

// Monitor function
const monitorCurrentlyPlaying = async () => {
  try {
    const data = await getCurrentlyPlaying();

    if (!data) {
      console.log('No data received from Spotify API');
      return;
    }

    const timestamp = new Date().toISOString();

    if (!data.playing) {
      // Clean up tracking when nothing is playing
      logService.cleanupTracking(null);
      return;
    }

    const progress = Math.floor(data.progress_ms / 1000);
    // Make sure we have user information
    if (!userInfo.id) {
      await getCurrentUserProfile();
    }
    data.item.spotifyUserId = userInfo.id;

    if (data.type === 'track' && data.item) {
      const duration = Math.floor(data.item.duration_ms / 1000);
      console.log(`[${timestamp}] Now playing: ${data.item.name} by ${data.item.artists.map(artist => artist.name).join(', ')} (${progress}s / ${duration}s)`);
      // Log playback to file (will only log new tracks)
      logService.logPlaybackStarted(data.item, 'track');
    } else if (data.type === 'episode') {
      if (data.item) {
        const duration = Math.floor(data.item.duration_ms / 1000);
        const showName = data.item.show?.name || 'Unknown Show';
        const episodeName = data.item.name || 'Unknown Episode';
        const releaseDate = data.item.release_date || 'Unknown Date';
        console.log(`[${timestamp}] Now playing podcast: ${showName} - ${episodeName} (Released: ${releaseDate}) (${progress}s / ${duration}s)`);

        // Log podcast playback to file (will only log new episodes)
        logService.logPlaybackStarted(data.item, 'episode');
      } else {
        console.log(`[${timestamp}] Now playing podcast episode (${progress}s elapsed)`);
      }
    } else {
      console.log(`[${timestamp}] Playing content of type: ${data.type} (${progress}s elapsed)`);
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Monitoring error:`, error.message);
    if (error.message.includes('401')) {
      console.error('Authentication error - you may need to re-authorize. Please visit http://localhost:' + config.port + '/login');
    }
  }
};

// Initialize the Spotify service - load tokens and start monitoring if available
const initialize = async () => {
  console.log('Initializing Spotify service...');
  const tokensLoaded = await loadTokensFromDatabase();

  if (tokensLoaded) {
    console.log('Found saved tokens, attempting to refresh if needed...');
    if (isTokenExpired()) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        console.log('Successfully refreshed token from saved refresh token');
        return true;
      } else {
        console.log('Failed to refresh token, user will need to re-authenticate');
        return false;
      }
    } else {
      console.log('Saved token is still valid');
      return true;
    }
  } else {
    console.log('No saved tokens found, user will need to authenticate');
    return false;
  }
};

// Start monitoring
const startMonitoring = async () => {
  console.log('Starting Spotify monitoring...');

  // If tokens are already loaded, we can skip initialization
  // This is needed because app.js might have already initialized the service
  const tokensAvailable = tokenInfo.access_token && tokenInfo.refresh_token;

  // Only run initialize if not already authenticated
  if (!tokensAvailable) {
    const initialized = await initialize();

    if (!initialized) {
      console.log('Not authenticated. Please visit http://localhost:' + config.port + '/login');
      return;
    }
  }

  // Run immediately
  monitorCurrentlyPlaying().catch(error => {
    console.error('Error in initial monitoring check:', error.message);
  });

  // Then set interval
  setInterval(() => {
    monitorCurrentlyPlaying().catch(error => {
      console.error('Error in monitoring interval:', error.message);
    });
  }, config.monitorInterval);
};

// Get authorization URL
const getAuthorizationUrl = (state) => {
  const scope = 'user-read-currently-playing user-read-playback-state user-read-recently-played user-modify-playback-state user-read-private user-read-email';
  return 'https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: config.clientId,
      scope: scope,
      redirect_uri: config.redirectUri,
      state: state
    });
};

// Get cached data
const getCachedData = {
  currentPlayback: () => currentPlayback,
  playHistory: () => playHistory,
  lastHistoryFetch: () => lastHistoryFetch,
  isAuthenticated: () => !!tokenInfo.access_token,
  userProfile: () => userInfo
};

module.exports = {
  generateRandomString,
  isTokenExpired,
  refreshAccessToken,
  exchangeCodeForToken,
  getCurrentlyPlaying,
  getRecentlyPlayed,
  monitorCurrentlyPlaying,
  startMonitoring,
  getAuthorizationUrl,
  getCachedData,
  skipToNextTrack,
  getCurrentUserProfile,
  initialize
};