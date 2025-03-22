const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');
const cookieParser = require('cookie-parser');
const Genius = require('genius-lyrics');
const OpenAI = require('openai');

const app = express();

// Middleware
app.use(express.static(path.join(__dirname, 'public')))
  .use(cookieParser());

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

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
const PORT = config.port || 8888;
// Ensure the Genius API key is a string or undefined
const GENIUS_API_KEY = typeof config.geniusApiKey === 'string' ? config.geniusApiKey : undefined;
// OpenAI API key
const OPENAI_API_KEY = typeof config.openAiApiKey === 'string' ? config.openAiApiKey : undefined;

// Initialize OpenAI if API key is available
let openai = null;
if (OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: OPENAI_API_KEY
  });
}

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

// Store current playback state
let currentPlayback = null;
// Store play history
let playHistory = null;
let lastHistoryFetch = 0;

// Store age evaluation cache
const ageEvaluationCache = new Map();

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
      currentPlayback = { playing: false };
      return { playing: false };
    }

    console.log('Received playing data from Spotify');

    // For podcast episodes or tracks, create the response object
    const playbackData = {
      playing: response.data.is_playing,
      type: response.data.currently_playing_type,
      progress_ms: response.data.progress_ms,
      item: response.data.item
    };

    // Store the current playback for the API
    currentPlayback = playbackData;

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
        console.log(`[${timestamp}] Now playing podcast episode (${progress}s elapsed)`);
      }
    } else {
      console.log(`[${timestamp}] Playing content of type: ${data.type} (${progress}s elapsed)`);
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Monitoring error:`, error.message);
    if (error.message.includes('401')) {
      console.error('Authentication error - you may need to re-authorize. Please visit http://localhost:' + PORT + '/login');
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

// Home route - render the main page
app.get('/', (req, res) => {
  // If already authenticated, redirect to now playing
  if (tokenInfo.access_token && !isTokenExpired()) {
    return res.redirect('/nowplaying');
  }

  // Otherwise show the login page
  res.render('index');
});

// Now playing route
app.get('/nowplaying', (req, res) => {
  // If not authorized, redirect to login
  if (!tokenInfo.access_token || isTokenExpired()) {
    return res.redirect('/');
  }

  res.render('nowplaying');
});

// API endpoint to get currently playing
app.get('/api/currently-playing', async (req, res) => {
  try {
    // If we don't have a token, return error
    if (!tokenInfo.access_token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Use the existing currentPlayback data if it exists and is recent
    // Otherwise, fetch fresh data
    if (!currentPlayback || Date.now() - (currentPlayback.timestamp || 0) > 5000) {
      await getCurrentlyPlaying();

      // Add a timestamp to track when this data was fetched
      if (currentPlayback) {
        currentPlayback.timestamp = Date.now();
      }
    }

    res.json(currentPlayback || { playing: false });
  } catch (error) {
    console.error('API error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route to start the authentication process
app.get('/login', (req, res) => {
  const state = generateRandomString(16);

  // Set cookie with state
  res.cookie('spotify_auth_state', state);

  // Redirect to Spotify auth page
  const scope = 'user-read-currently-playing user-read-playback-state user-read-recently-played';
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

    // Redirect to the now playing page instead of showing a plain text message
    res.redirect('/nowplaying');

    // Start monitoring after successful authentication
    startMonitoring();
  } catch (error) {
    console.error('Error during token exchange:', error.response ? error.response.data : error.message);
    res.send('Error during authentication');
  }
});

// Function to get recently played tracks
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
        additional_types: 'episode,show' // TODO: This is not fetching episodes or shows, only music tracks
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

// API endpoint to get recently played
app.get('/api/recently-played', async (req, res) => {
  try {
    // If we don't have a token, return error
    if (!tokenInfo.access_token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Only fetch new data every 5 minutes
    const fiveMinutesMs = 5 * 60 * 1000;
    if (!playHistory || Date.now() - lastHistoryFetch > fiveMinutesMs) {
      await getRecentlyPlayed();
    }

    res.json(playHistory || []);
  } catch (error) {
    console.error('API error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint to fetch lyrics for a track
app.get('/api/lyrics', async (req, res) => {
  try {
    const { title, artist } = req.query;

    if (!title || !artist) {
      return res.status(400).json({ error: 'Missing required parameters: title and artist' });
    }

    console.log(`Fetching lyrics for "${title}" by ${artist}`);
    console.log(`Using Genius API key: ${GENIUS_API_KEY ? 'Yes (configured)' : 'No (falling back to scraping)'}`);

    // Initialize Genius client exactly as shown in docs
    const geniusClient = new Genius.Client(GENIUS_API_KEY);

    try {
      // Search for the song
      const searches = await geniusClient.songs.search(`${title} ${artist}`);

      // If no results found
      if (!searches || searches.length === 0) {
        console.log('No lyrics found');
        return res.json({ lyrics: null });
      }

      // Get the first search result
      const song = searches[0];
      console.log(`Found song: ${song.title} by ${song.artist.name}`);

      // Fetch the lyrics
      const lyrics = await song.lyrics();

      res.json({
        lyrics,
        title: song.title,
        artist: song.artist.name,
        image: song.image,
        url: song.url
      });
    } catch (searchError) {
      console.error('Genius search/lyrics error:', searchError.message);
      return res.json({ lyrics: null, error: searchError.message });
    }
  } catch (error) {
    console.error('Lyrics API error:', error.message);
    res.status(500).json({ error: 'Error fetching lyrics' });
  }
});

// API endpoint to get age evaluation for a track or podcast
app.get('/api/age-evaluation', async (req, res) => {
  try {
    const { id, type, title, artist, lyrics, description } = req.query;

    if (!id || !type || !title) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Check if OpenAI is configured
    if (!openai) {
      return res.status(503).json({
        error: 'OpenAI API not configured',
        message: 'Please add an OpenAI API key to your config file'
      });
    }

    // Create cache key
    const cacheKey = id;

    // Check cache first
    if (ageEvaluationCache.has(cacheKey)) {
      console.log(`Using cached age evaluation for "${title}"`);
      return res.json(ageEvaluationCache.get(cacheKey));
    }

    // Limit cache size (keep no more than 100 entries)
    if (ageEvaluationCache.size >= 100) {
      // Get the oldest key and delete it
      const oldestKey = ageEvaluationCache.keys().next().value;
      ageEvaluationCache.delete(oldestKey);
      console.log('Age evaluation cache full, removed oldest entry');
    }

    // Prepare content for evaluation
    let content = '';
    if (type === 'track') {
      content = `Track: ${title}\nArtist: ${artist || 'Unknown'}\n`;
      if (lyrics) {
        content += `\nLyrics:\n${lyrics}`;
      }
    } else if (type === 'episode') {
      content = `Podcast: ${title}\n`;
      if (description) {
        content += `\nDescription:\n${description}`;
      }
    }

    console.log(`Requesting age evaluation for "${title}"`);

    // Make OpenAI API request
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: "You are an assistant that evaluates the age appropriateness of music tracks and podcasts. Provide a clear age recommendation (e.g., 'All ages', '13+', '16+', '18+') and a brief explanation why. Be objective and consider lyrical content, themes, and language. Format your response as JSON with 'ageRating' and 'explanation' fields. DO NOT wrap your response in markdown code blocks."
        },
        {
          role: "user",
          content: content
        }
      ]
    });

    // Get raw content from completion
    let rawContent = completion.choices[0].message.content;

    // Log the raw response from OpenAI
    console.log('Raw OpenAI response:', rawContent);

    // Remove markdown code blocks if present
    let cleanedContent = rawContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    // Also handle the case where it just uses ``` without specifying the language
    cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');

    console.log('Cleaned content for parsing:', cleanedContent);

    let response;
    try {
      // Try to parse response as JSON
      response = JSON.parse(cleanedContent);
    } catch (e) {
      console.log('JSON parse error, using regex fallback:', e.message);

      // Extract age rating with regex (looking for patterns like "13+", "All ages", etc.)
      const ageMatch = rawContent.match(/(?:All ages|\d+\+)/i);
      const ageRating = ageMatch ? ageMatch[0] : "Unknown";

      response = {
        ageRating: ageRating,
        explanation: rawContent.replace(/```json|```/g, '').trim(),
      };
    }

    // Store in cache
    ageEvaluationCache.set(cacheKey, response);

    res.json(response);
  } catch (error) {
    console.error('Age evaluation API error:', error.message);
    res.status(500).json({ error: 'Error evaluating content age appropriateness' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Using config file: ${configPath}`);
  console.log(`Genius API key configured: ${GENIUS_API_KEY ? 'Yes' : 'No'}`);
  console.log(`OpenAI API key configured: ${OPENAI_API_KEY ? 'Yes' : 'No'}`);
  console.log(`To authorize Spotify, open http://localhost:${PORT} in your browser`);
});