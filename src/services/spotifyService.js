const axios = require('axios');
const querystring = require('querystring');
const config = require('../config');
const trackRepository = require('../repositories/trackRepository');
const spotifyAuthRepository = require('../repositories/spotifyAuthRepository');
const { logger } = require('./logService');

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
    logger.info('Found user tokens for clientId', config.clientId, JSON.stringify(userTokens));

    if (userTokens) {
      tokenInfo.access_token = userTokens.accessToken;
      tokenInfo.refresh_token = userTokens.refreshToken;
      tokenInfo.expires_at = userTokens.expiresAt ? new Date(userTokens.expiresAt).getTime() : null;

      logger.info(`Loaded tokens for clientId ${userTokens.clientId} from database`);
      return true;
    } else {
      logger.info('No tokens found in database');
      return false;
    }
  } catch (error) {
    logger.error('Error loading tokens from database:', error.message);
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

    logger.info(`Saved tokens for clientId ${config.clientId} to database`);
    return true;
  } catch (error) {
    logger.error('Error saving tokens to database:', error.message);
    return false;
  }
};

// Consider expired if the token is less than 2 minutes from expiration
const isTokenExpired = () => {
  return !tokenInfo.expires_at || Date.now() > tokenInfo.expires_at - (2 * 60 * 1000);
};

const refreshAccessToken = async () => {
  if (!tokenInfo.refresh_token) {
    logger.error('No refresh token available. Please authorize again.');
    return false;
  }

  logger.info('Refreshing access token...');

  const MAX_RETRIES = 3;
  let retryCount = 0;

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  while (retryCount < MAX_RETRIES) {
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
            logger.error('Could not fetch user profile to get user ID:', profileError.message);
            // We'll continue even without saving to database
          }
        }
      } catch (dbError) {
        logger.error('Failed to save tokens to database:', dbError.message);
        // Continue even if database save fails - we still have valid tokens in memory
      }

      return true;
    } catch (error) {
      retryCount++;
      if (axios.isAxiosError(error)) {
        logger.error(`Token refresh error (attempt ${retryCount}/${MAX_RETRIES}):`, {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        });
      } else {
        logger.error(`Unexpected error during token refresh (attempt ${retryCount}/${MAX_RETRIES}):`, error.message);
      }

      if (retryCount < MAX_RETRIES) {
        logger.info(`Waiting 5 seconds before retry attempt ${retryCount + 1}...`);
        await delay(5000);
      }
    }
  }

  logger.error(`Failed to refresh token after ${MAX_RETRIES} attempts`);
  return false;
};

const getCurrentUserProfile = async () => {
  if (userInfo.fetched) {
    return userInfo;
  }

  try {
    if (isTokenExpired()) {
      logger.info('Token expired, attempting to refresh before fetching user profile...');
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        throw new Error('Failed to refresh access token');
      }
    }

    if (!tokenInfo.access_token) {
      throw new Error('No access token available. Please authorize first.');
    }

    logger.info('Fetching user profile information...');
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

    logger.info('User profile fetched successfully:');
    logger.info(`- User ID: ${userInfo.id}`);
    logger.info(`- Display Name: ${userInfo.display_name}`);
    logger.info(`- Email: ${userInfo.email}`);
    logger.info(`- Explicit Content Filter Enabled: ${userInfo.explicit_content?.filter_enabled}`);
    logger.info(`- Explicit Content Filter Locked: ${userInfo.explicit_content?.filter_locked}`);

    // Save tokens to database now that we have a user ID
    await saveTokensToDatabase();

    return userInfo;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error('Spotify API Error (User Profile):', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message
      });
    } else {
      logger.error('Error in getCurrentUserProfile:', error.message);
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
      logger.error('Error fetching user profile:', profileError.message);
      // Continue even if profile fetch fails
    }

    return true;
  } catch (error) {
    logger.error('Error during token exchange:', error.response ? error.response.data : error.message);
    return false;
  }
};

// Get currently playing track
const getCurrentlyPlaying = async () => {
  try {
    if (isTokenExpired()) {
      logger.info('Token expired, attempting to refresh...');
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        throw new Error('Failed to refresh access token');
      }
      logger.info('Token refreshed successfully');
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
      logger.info('Received 204 status - nothing playing');
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
          trackData.description = playbackData.item.album?.description;
          trackData.albumArt = playbackData.item.album?.images?.[0]?.url;
          trackData.imageUrl = playbackData.item.album?.images?.[0]?.url;
          trackData.htmlDescription = playbackData.item.html_description;
        }
        // Handle episode-specific fields
        else if (playbackData.type === 'episode') {
          trackData.artist = playbackData.item.show?.publisher;
          trackData.album = playbackData.item.show?.name;
          trackData.albumArt = playbackData.item.show.images?.[0]?.url;
          trackData.imageUrl = playbackData.item.show.images?.[0]?.url;
          trackData.description = playbackData.item.show.description;
          trackData.htmlDescription = playbackData.item.html_description;
        }

        const result = await trackRepository.saveTrack(trackData);
        if (result.created) {
          logger.info(`New ${playbackData.type} saved to database with ID: ${trackData.trackId}`);
        }
      } catch (dbError) {
        logger.error('Error saving track to database:', dbError.message);
        logger.error('Database error details:', dbError);
        // Continue execution even if database save fails
      }
    }

    return playbackData;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error('Spotify API Error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message
      });
    } else {
      logger.error('Error in getCurrentlyPlaying:', error.message);
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

    logger.info('Fetching recently played tracks...');
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
      logger.error('Spotify API Error (Recently Played):', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message
      });
    } else {
      logger.error('Error in getRecentlyPlayed:', error.message);
    }
    throw error;
  }
};

// Skip to the next track
const skipToNextTrack = async () => {
  try {
    logger.info('Attempting to skip to next track due to age restriction...');

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
      logger.info('Successfully skipped to next track');
      return true;
    } else {
      logger.error('Unexpected response from Spotify skip API:', response.status, response.statusText);
      return false;
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error('Spotify API Error (Skip Track):', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message
      });
    } else {
      logger.error('Error in skipToNextTrack:', error.message);
    }
    return false;
  }
};


// Initialize the Spotify service - load tokens and start monitoring if available
const initialize = async () => {
  logger.info('Initializing Spotify service...');
  const tokensLoaded = await loadTokensFromDatabase();

  if (tokensLoaded) {
    logger.info('Found saved tokens, attempting to refresh if needed...');
    if (isTokenExpired()) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        logger.info('Successfully refreshed token from saved refresh token');
        return true;
      } else {
        logger.info('Failed to refresh token, user will need to re-authenticate');
        return false;
      }
    } else {
      logger.info('Saved token is still valid');
      return true;
    }
  } else {
    logger.info('No saved tokens found, user will need to authenticate');
    return false;
  }
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
  getAuthorizationUrl,
  getCachedData,
  skipToNextTrack,
  getCurrentUserProfile,
  initialize
};