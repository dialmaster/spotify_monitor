import * as fs from 'fs';
import * as path from 'path';
import { AppConfig } from '../types';

// Helper function to check if a config value is a placeholder from the example file
const isPlaceholderValue = (value: string): boolean => {
  const placeholders = [
    'YOUR_SPOTIFY_CLIENT_ID',
    'YOUR_SPOTIFY_CLIENT_SECRET',
    'YOUR_GENIUS_API_KEY',
    'YOUR_OPENAI_API_KEY',
    'YOUR_CALLMEBOT_API_URL',
    'PASTE_YOUR_COOKIES_HERE',
    'COOKIES_FROM_SPOTIFY_WEB_PLAYER'
  ];
  return placeholders.includes(value);
};

// Load config
const loadConfig = (configPath: string): any => {
  try {
    const configData = fs.readFileSync(path.join(process.cwd(), configPath), 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    console.error('Error loading config:', error);
    process.exit(1);
  }
};

// Use command line arg to specify config file or default to config.json
const getConfigPath = (): string => {
  return process.argv[2] || 'config.json';
};

// Load the config file
const configPath = getConfigPath();
const rawConfig = loadConfig(configPath);

// Config object with all validated settings
const config: AppConfig = {
  // Spotify API credentials
  clientId: rawConfig.clientId,
  clientSecret: rawConfig.clientSecret,
  redirectUri: rawConfig.redirectUri || 'http://localhost:8888/callback',

  // Spotify username (for file naming)
  spotifyUserName: rawConfig.spotifyUserName || 'spotify_user',

  // App settings
  monitorInterval: rawConfig.monitorInterval || 30000, // Default 30 seconds
  port: 8888,
  autoSkipBlocked: rawConfig.autoSkipBlocked === true, // Default to false unless explicitly set to true

  // Whitelist of track IDs that should not be blocked
  whitelistTrackIDs: Array.isArray(rawConfig.whitelistTrackIDs) ? rawConfig.whitelistTrackIDs : [],

  callMeBotUrl: typeof rawConfig.callMeBotUrl === 'string' && !isPlaceholderValue(rawConfig.callMeBotUrl)
    ? rawConfig.callMeBotUrl
    : undefined,

  // Genius API key - ensure it's a valid string
  geniusApiKey: typeof rawConfig.geniusApiKey === 'string' && !isPlaceholderValue(rawConfig.geniusApiKey)
    ? rawConfig.geniusApiKey
    : undefined,

  // OpenAI API key - check for valid value
  openAiApiKey: typeof rawConfig.openAiApiKey === 'string' && !isPlaceholderValue(rawConfig.openAiApiKey)
    ? rawConfig.openAiApiKey
    : undefined,

  // Age evaluation configuration
  ageEvaluation: rawConfig.ageEvaluation || { listenerAge: 13, customInstructions: "" },

  // Spotify web cookies for authenticated requests
  spotifyWebCookies: typeof rawConfig.spotifyWebCookies === 'string' &&
                     !isPlaceholderValue(rawConfig.spotifyWebCookies) &&
                     rawConfig.spotifyWebCookies.length > 10
    ? rawConfig.spotifyWebCookies
    : '',

  // Helper method to check if a feature is enabled
  hasGeniusLyrics: function(): boolean {
    return !!this.geniusApiKey;
  },

  hasAgeEvaluation: function(): boolean {
    return !!this.openAiApiKey;
  },

  hasSpotifyWebAccess: function(): boolean {
    return !!this.spotifyWebCookies;
  },

  hasCallMeBot: function(): boolean {
    return !!this.callMeBotUrl;
  },

  getConfigPath: function(): string {
    return configPath;
  }
};

export = config;