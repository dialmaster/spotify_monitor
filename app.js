const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');
const cookieParser = require('cookie-parser');
const Genius = require('genius-lyrics');
const OpenAI = require('openai');
const puppeteer = require('puppeteer');

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
// Age evaluation configuration
const AGE_EVALUATION_CONFIG = config.ageEvaluation || { listenerAge: 13, customInstructions: "" };
// Spotify web cookies for authenticated requests
const SPOTIFY_WEB_COOKIES = typeof config.spotifyWebCookies === 'string' ? config.spotifyWebCookies : '';

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

// Function to get lyrics directly from Spotify using Puppeteer
const getSpotifyLyrics = async (trackUrl) => {
  try {
    console.log(`Attempting to fetch lyrics from Spotify using Puppeteer: ${trackUrl}`);

    // Check if we have Spotify web cookies configured
    if (!SPOTIFY_WEB_COOKIES) {
      console.log('No Spotify web cookies configured, cannot fetch lyrics from Spotify web');
      return null;
    }

    // Launch a browser
    const browser = await puppeteer.launch({
      headless: 'new', // Use the new headless mode
      args: [
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-setuid-sandbox',
        '--no-sandbox',
      ]
    });

    try {
      // Create a new page
      const page = await browser.newPage();

      // Parse and set cookies from the configuration
      const cookieStr = SPOTIFY_WEB_COOKIES;
      const cookies = cookieStr.split(';').map(pair => {
        const [name, value] = pair.trim().split('=');
        return { name, value, domain: '.spotify.com', path: '/' };
      });

      await page.setCookie(...cookies);

      // Set a realistic user agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');

      // Navigate to the Spotify track URL
      console.log('Navigating to Spotify track page...');
      await page.goto(trackUrl, { waitUntil: 'networkidle2', timeout: 30000 });

      // Log the current URL to see if we were redirected
      const currentUrl = page.url();
      console.log('Current page URL:', currentUrl);

      // Take a screenshot for debugging (optional, uncomment if needed)
      // await page.screenshot({ path: 'spotify-page.png' });

      // Wait for lyrics container with timeout
      console.log('Waiting for lyrics container...');
      try {
        await page.waitForSelector('div[data-testid="lyrics-container"]', { timeout: 10000 });
        console.log('Lyrics container found!');
      } catch (e) {
        console.log('No lyrics container found within timeout:', e.message);

        // Check if we're on a login page or if the page has other expected elements
        const pageTitle = await page.title();
        console.log('Page title:', pageTitle);

        const hasLoginForm = await page.evaluate(() => {
          return !!document.querySelector('button[data-testid="login-button"]');
        });

        if (hasLoginForm) {
          console.log('Login form detected - authentication may have failed');
        }

        // Check for other track elements to see if we're on the right page
        const hasTrackInfo = await page.evaluate(() => {
          return !!document.querySelector('[data-testid="track-info"]') ||
                 !!document.querySelector('[data-testid="now-playing-widget"]');
        });

        if (hasTrackInfo) {
          console.log('Track info found but no lyrics - song might not have lyrics available');
        }

        // If we found track info but no lyrics, the song might not have lyrics
        if (hasTrackInfo && !hasLoginForm) {
          await browser.close();
          return null; // No lyrics available for this track
        }

        // If we hit the login page or found nothing familiar, auth failed
        await browser.close();
        return null;
      }

      // Extract lyrics content
      console.log('Extracting lyrics...');
      const lyrics = await page.evaluate(() => {
        // Get all visible lyrics lines
        const visibleLines = Array.from(
          document.querySelectorAll('div[data-testid="lyrics-container"] p[data-testid="lyrics-line-always-visible"]')
        ).map(el => el.textContent);

        // Also try to get potentially hidden lines (in "Show more" sections)
        const hiddenLines = Array.from(
          document.querySelectorAll('div[data-testid="lyrics-container"] span[aria-hidden="true"] p')
        ).map(el => el.textContent);

        // Combine all lines
        return [...visibleLines, ...hiddenLines].join('\n');
      });

      // Log stats
      const lineCount = lyrics.split('\n').length;
      console.log(`Successfully extracted ${lineCount} lines of lyrics from Spotify`);

      // Close the browser
      await browser.close();

      // Return the lyrics if we found some
      if (lyrics && lyrics.trim().length > 0) {
        return lyrics;
      } else {
        console.log('No lyrics content found in the container');
        return null;
      }
    } catch (innerError) {
      console.error('Error during Puppeteer operation:', innerError.message);
      await browser.close();
      return null;
    }
  } catch (error) {
    console.error('Error scraping Spotify lyrics with Puppeteer:', error.message);
    return null;
  }
};

// Function to get podcast transcript from Spotify using Puppeteer
const getSpotifyPodcastTranscript = async (episodeUrl) => {
  try {
    console.log(`Attempting to fetch podcast transcript from Spotify using Puppeteer: ${episodeUrl}`);

    // Check if we have Spotify web cookies configured
    if (!SPOTIFY_WEB_COOKIES) {
      console.log('No Spotify web cookies configured, cannot fetch podcast transcript from Spotify web');
      return null;
    }

    // Launch a browser
    const browser = await puppeteer.launch({
      headless: 'new', // Use the new headless mode
      args: [
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-setuid-sandbox',
        '--no-sandbox',
      ]
    });

    try {
      // Create a new page
      const page = await browser.newPage();

      // Parse and set cookies from the configuration
      const cookieStr = SPOTIFY_WEB_COOKIES;
      const cookies = cookieStr.split(';').map(pair => {
        const [name, value] = pair.trim().split('=');
        return { name, value, domain: '.spotify.com', path: '/' };
      });

      await page.setCookie(...cookies);

      // Set a realistic user agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');

      // Navigate to the Spotify episode URL
      console.log('Navigating to Spotify episode page...');
      await page.goto(episodeUrl, { waitUntil: 'networkidle2', timeout: 30000 });

      // Log the current URL to see if we were redirected
      const currentUrl = page.url();
      console.log('Current page URL:', currentUrl);

      // Take a screenshot for debugging (optional, uncomment if needed)
      // await page.screenshot({ path: 'spotify-podcast-page.png' });

      // Check if we're on a login page
      const hasLoginForm = await page.evaluate(() => {
        return !!document.querySelector('button[data-testid="login-button"]');
      });

      if (hasLoginForm) {
        console.log('Login form detected - authentication may have failed');
        await browser.close();
        return null;
      }

      // Check for the Transcript navigation link
      const hasTranscriptLink = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a.e-9640-nav-bar-list-item')).some(
          el => el.textContent.trim() === 'Transcript'
        );
      });

      if (!hasTranscriptLink) {
        console.log('No transcript link found - this podcast may not have a transcript');
        await browser.close();
        return null;
      }

      // Click on the Transcript link
      console.log('Clicking on Transcript tab...');
      await page.evaluate(() => {
        const transcriptLinks = Array.from(document.querySelectorAll('a.e-9640-nav-bar-list-item')).filter(
          el => el.textContent.trim() === 'Transcript'
        );
        if (transcriptLinks.length > 0) {
          transcriptLinks[0].click();
        }
      });

      // Wait for transcript to load
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for content to load after clicking

      // Check for transcript container
      console.log('Looking for transcript content...');
      const hasTranscriptContainer = await page.evaluate(() => {
        // Look for the div with a class beginning with NavBar__NavBarPage
        const navBarPages = Array.from(document.querySelectorAll('div[class^="NavBar__NavBarPage"]'));
        return navBarPages.length > 0;
      });

      if (!hasTranscriptContainer) {
        console.log('No transcript container found after clicking link');
        await browser.close();
        return null;
      }

      // Extract transcript content
      console.log('Extracting transcript...');
      const transcript = await page.evaluate(() => {
        // Find the NavBar__NavBarPage container
        const navBarPages = Array.from(document.querySelectorAll('div[class^="NavBar__NavBarPage"]'));
        if (navBarPages.length === 0) return null;

        const container = navBarPages[0];

        // Get all text spans within the container
        const textSpans = Array.from(container.querySelectorAll('span[data-encore-id="text"][dir="auto"]'));

        // Extract and join the text content
        return textSpans.map(el => el.textContent.trim()).join('\n');
      });

      // Log stats and limit to 4000 characters
      if (transcript) {
        const truncatedTranscript = transcript.substring(0, 4000);
        const originalLength = transcript.length;
        const lineCount = transcript.split('\n').length;
        console.log(`Successfully extracted transcript (${lineCount} lines, ${originalLength} chars, truncated to 4000 chars)`);

        await browser.close();
        return truncatedTranscript;
      } else {
        console.log('No transcript content found');
        await browser.close();
        return null;
      }
    } catch (innerError) {
      console.error('Error during Puppeteer operation:', innerError.message);
      await browser.close();
      return null;
    }
  } catch (error) {
    console.error('Error scraping podcast transcript with Puppeteer:', error.message);
    return null;
  }
};

// Function to get lyrics from Spotify API directly
const getSpotifyApiLyrics = async (trackId) => {
  try {
    console.log(`Attempting to get lyrics for track ID: ${trackId}`);

    // Check if we have Spotify web cookies configured
    if (!SPOTIFY_WEB_COOKIES) {
      console.log('No Spotify web cookies configured, cannot fetch lyrics from Spotify');
      return null;
    }

    // Since there is no actual Spotify lyrics API endpoint,
    // we'll use the Puppeteer implementation with the track URL
    const trackUrl = `https://open.spotify.com/track/${trackId}`;

    // Use our Puppeteer implementation
    return await getSpotifyLyrics(trackUrl);
  } catch (error) {
    console.error('Error getting lyrics:', error.message);
    return null;
  }
};

// API endpoint to fetch lyrics for a track
app.get('/api/lyrics', async (req, res) => {
  try {
    const { title, artist, spotifyUrl, contentType } = req.query;

    // If this is a podcast episode request
    if (contentType === 'episode') {
      if (!title || !spotifyUrl) {
        return res.status(400).json({ error: 'Missing required parameters for podcast: title and spotifyUrl' });
      }

      console.log(`Fetching transcript for podcast episode: "${title}"`);

      // Try to get transcript from the Spotify web page
      const transcript = await getSpotifyPodcastTranscript(spotifyUrl);

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

    // Try each method in sequence until we get lyrics

    // First, try the Spotify web page if we have a URL
    if (spotifyUrl) {
      console.log(`Using Spotify URL: ${spotifyUrl}`);

      // Try to get lyrics from the Spotify web page
      lyrics = await getSpotifyLyrics(spotifyUrl);

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
      lyrics = await song.lyrics();
      source = 'genius';

      res.json({
        lyrics,
        title: song.title,
        artist: song.artist.name,
        image: song.image,
        source,
        url: song.url,
        sourceDetail: 'Lyrics from Genius (third-party lyrics database)'
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
    const { id, type, title, artist, description, lyrics } = req.query;

    // Basic validation
    if (!id || !type || !title) {
      return res.status(400).json({
        error: 'Missing required parameters: id, type, and title'
      });
    }

    // Check if OpenAI is configured
    if (!openai) {
      return res.status(503).json({
        error: 'OpenAI API not configured',
        message: 'Please add an OpenAI API key to your config file'
      });
    }

    // Create cache key from item ID
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

    // Track the source of lyrics for confidence level
    const lyricsSource = req.query.lyricsSource || '';

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
      if (lyrics) {
        content += `\nLyrics:\n${lyrics}`;
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
          content: `You are an assistant that evaluates the age appropriateness of music tracks and podcasts.

The listener's target age is: ${AGE_EVALUATION_CONFIG.listenerAge} years old.

${AGE_EVALUATION_CONFIG.customInstructions ? `Parent's custom instructions: ${AGE_EVALUATION_CONFIG.customInstructions}` : ''}

Provide a clear age recommendation (e.g., 'All ages', '13+', '16+', '18+') and a brief explanation why.
Be objective and consider lyrical content, themes, and language.

Format your response as JSON with the following fields:
- 'ageRating': a clear age recommendation (e.g., 'All ages', '13+', '16+', '18+')
- 'explanation': brief reasoning for your recommendation
- 'level': 'OK' if appropriate for the configured listener age, 'WARNING' if borderline for the listener age, 'BLOCK' if NOT appropriate for the listener age.

DO NOT wrap your response in markdown code blocks.`,

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

      // Determine level based on extracted age and configured listener age
      let level = 'Unknown';
      if (ageRating.toLowerCase() === 'all ages') {
        level = 'OK';
      } else if (ageRating.match(/\d+\+/)) {
        const extractedAge = parseInt(ageRating, 10);
        if (extractedAge <= AGE_EVALUATION_CONFIG.listenerAge) {
          level = 'OK';
        } else if (extractedAge <= AGE_EVALUATION_CONFIG.listenerAge + 2) {
          level = 'WARNING';
        } else {
          level = 'BLOCK';
        }
      }

      response = {
        ageRating: ageRating,
        explanation: rawContent.replace(/```json|```/g, '').trim(),
        level: level
      };
    }

    // Determine confidence level based on lyrics source
    let confidenceLevel = 'LOW';
    let confidenceExplanation = '';

    // Safely check if spotifyUrl exists and contains spotify.com
    const spotifyUrl = req.query.spotifyUrl || '';
    const fromSpotify = spotifyUrl.includes('spotify.com');

    if (lyricsSource === 'spotify-api' || lyricsSource === 'spotify-web' || lyricsSource === 'spotify-podcast-transcript') {
      confidenceLevel = 'HIGH';
      confidenceExplanation = type === 'track'
        ? 'We have official lyrics from Spotify'
        : 'We have an official transcript from Spotify';
    } else if (lyricsSource === 'genius') {
      confidenceLevel = 'MEDIUM';
      confidenceExplanation = 'We have third-party lyrics from Genius';
    } else {
      confidenceLevel = 'LOW';
      confidenceExplanation = 'No lyrics or transcript available';
    }

    // Add confidence info to response
    response.confidence = {
      level: confidenceLevel,
      explanation: confidenceExplanation
    };

    // Store in cache
    ageEvaluationCache.set(cacheKey, response);

    res.json(response);
  } catch (error) {
    console.error('Age evaluation API error:', error.message);
    res.status(500).json({ error: 'Error evaluating content age appropriateness' });
  }
});

// Helper route for Spotify cookies setup
app.get('/cookies-help', (req, res) => {
  res.render('cookies-help');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Using config file: ${configPath}`);
  console.log(`Genius API key configured: ${GENIUS_API_KEY ? 'Yes' : 'No'}`);
  console.log(`OpenAI API key configured: ${OPENAI_API_KEY ? 'Yes' : 'No'}`);
  console.log(`Spotify Web cookies configured: ${SPOTIFY_WEB_COOKIES ? 'Yes' : 'No'}`);
  console.log(`Age evaluation configured for listener age: ${AGE_EVALUATION_CONFIG.listenerAge}`);
  if (AGE_EVALUATION_CONFIG.customInstructions) {
    console.log(`Custom age evaluation instructions: "${AGE_EVALUATION_CONFIG.customInstructions}"`);
  }
  console.log(`To authorize Spotify, open http://localhost:${PORT} in your browser`);
});