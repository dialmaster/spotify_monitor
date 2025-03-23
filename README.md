# Spotify Account Monitor

Spotify Account Monitor is a comprehensive web application that allows parents and guardians to track and monitor Spotify listening activity in real-time.

## Key Features

- **Real-time Monitoring**: Displays currently playing tracks or podcasts with detailed information including album art, artists, playback progress, and recently played content
- **Lyrics Analysis**: Retrieves lyrics via Spotify or the Genius API, enabling users to review song content
- **Content Evaluation**: Leverages OpenAI's API to provide age appropriateness evaluations for both music and podcast content based on configurable age thresholds
- **Safety Controls**: Includes auto-skip capability for inappropriate content and supports monitoring multiple accounts
- **User Experience**: Maintains a sleek, user-friendly interface that updates automatically without requiring page refreshes

This tool helps parents make informed decisions about their children's music and podcast consumption while providing a seamless monitoring experience.

## Feature Availability Based on Configuration

The app has different levels of functionality depending on which API keys you configure:

- **Basic Features** (Spotify Client ID and Secret only):
  - View currently playing tracks and podcasts
  - Display album art, artist information, and playback progress
  - View recently played content
  - Basic playback monitoring

- **With Spotify Web Cookies**:
  - All basic features
  - Retrieve official lyrics directly from Spotify
  - Access podcast transcripts when available on Spotify
  - Since this uses the actual lyrics from Spotify, it can more accurately distinguish between radio edits and original lyrics
  - Higher quality source material for age evaluations

- **With Genius API Key**:
  - All basic features
  - Fetch and display lyrics for songs (through Genius)
  - Lyrics through Genius will not be as accurate as through Spotify
  - Without this, lyrics may still be available through Genius but with lower success rate

- **With OpenAI API Key**:
  - All basic features
  - AI-powered age appropriateness evaluations for songs and podcasts
  - Auto-skip functionality for blocked content when enabled
  - Note: Without this, the age evaluation feature will be disabled

## System Requirements
**Note**: *This application has only been tested in WSL2 on Windows, but should work fine in Linux as well*

- Node.js 14 or higher
- npm or yarn
- This application uses Puppeteer to scrape web lyrics, the following dependency is required:
  ```bash
  sudo apt-get update && sudo apt-get install -y libgbm1
  ```

## Setup Instructions
**NOTE**: *The instructions below show `8888` for the port, but this is actually dependent on the port you specify in your config.json*

1. **Create a Spotify Developer App**:
   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/applications)
   - Click "Create An App"
   - Fill in the app name and description
   - For "Website", enter: `http://localhost:8888`
   - For "Redirect URI", enter: `http://localhost:8888/callback`
   - Save your app and note your Client ID and Client Secret

2. **Get a Genius API Key (Optional)**:
   - Go to the [Genius API Clients page](https://genius.com/api-clients)
   - Sign in or create an account
   - Click "New API Client"
   - Fill in the required information, include "http://localhost:8888" as the App Website URL
   - After creating the client, you'll get a Client ID, Client Secret, and Client Access Token
   - Copy the Client Access Token - this is your Genius API key
   - Without this API key, lyrics retrieval will fall back to web scraping with limited success

3. **Get an OpenAI API Key (Optional)**:
   - Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
   - Sign in or create an account
   - Create a new API key
   - Copy the API key (it will only be shown once)
   - Without this API key, the age evaluation feature will be disabled completely

4. **Configure the application**:
   - Copy the example config to create your own:
     ```bash
     cp config.json.example config.json
     ```
   - Edit `config.json` and add your Spotify Client ID and Client Secret (required)
   - Add optional API keys as needed for additional features:
   ```json
   {
     "clientId": "YOUR_SPOTIFY_CLIENT_ID",
     "clientSecret": "YOUR_SPOTIFY_CLIENT_SECRET",
     "redirectUri": "http://localhost:8888/callback",
     "port": 8888,
     "autoSkipBlocked": true,
     "monitorInterval": 30000,
     "geniusApiKey": "YOUR_GENIUS_API_KEY",
     "openAiApiKey": "YOUR_OPENAI_API_KEY",
     "ageEvaluation": {
       "listenerAge": 13,
       "customInstructions": "Optional custom instructions for age evaluation"
     },
     "spotifyWebCookies": "COOKIES_FROM_SPOTIFY_WEB_PLAYER"
   }
   ```
   - If you don't want to use a specific feature, you can leave its API key as the example value or remove it
   - The app will automatically disable features for which valid API keys aren't provided
   - You can adjust the `monitorInterval` value (in milliseconds) to change how often the app checks what's playing
   - Set `autoSkipBlocked` to `true` to automatically skip tracks that are rated as blocked by the age evaluation

5. **Get Spotify Web Cookies (Optional but recommended for best lyrics/transcript retrieval)**:
   - Log in to [Spotify Web Player](https://open.spotify.com/) in your browser
   - Open developer tools (F12 or right-click > Inspect)
   - Go to the Console tab and type `document.cookie` and press Enter
   - Copy the entire cookie string and paste it into your config.json for the `spotifyWebCookies` value
   - Without these cookies, direct lyrics retrieval from Spotify won't work

6. **Install dependencies**:
   ```bash
   npm install
   ```

7. **Run the application**:
   ```bash
   npm start
   ```
   - This will start the server at http://localhost:8888 using `config.json`
   - Alternatively, run with a specific config file:
     ```bash
     node app.js your-config.json
     ```

8. **Authorize your Spotify account**:
   - Open http://localhost:8888 in your browser
   - **IMPORTANT**: Use the same browser where you are already logged into Spotify
   - Log in with your Spotify credentials when prompted
   - Allow the requested permissions
   - You'll be redirected back to the application

## Multiple Account Monitoring

To monitor different Spotify accounts:

1. Create different config files (e.g., `config-account1.json`, `config-account2.json`)
2. Start the application with the config file as a parameter:
   ```bash
   node app.js config-account1.json
   ```
3. To monitor another account, run the app again with a different port in the config:
   ```json
   {
     "clientId": "YOUR_SPOTIFY_CLIENT_ID",
     "clientSecret": "YOUR_SPOTIFY_CLIENT_SECRET",
     "redirectUri": "http://localhost:8889/callback",
     "port": 8889,
     "autoSkipBlocked": true,
     "monitorInterval": 30000,
     "openAiApiKey": "YOUR_OPENAI_API_KEY"
   }
   ```
   Then run:
   ```bash
   node app.js config-account2.json
   ```

## Features

- Authenticates with Spotify API using OAuth 2.0
- Monitors currently playing tracks at regular intervals
- Automatically refreshes access tokens
- Displays track information including name, artist, album, and playback progress
- Shows lyrics for currently playing tracks (requires Genius API key or Spotify Web Cookies)
- Evaluates age appropriateness of content (requires OpenAI API key)
- Automatically skips tracks/podcasts rated as blocked based on age settings (optional feature)
- Displays toast notifications when content is automatically skipped
- Supports monitoring different accounts using different config files

## Troubleshooting

- If you see authentication errors, ensure your Client ID and Client Secret are correctly entered in the config file
- If the callback fails, verify that you've correctly set up the Redirect URI in your Spotify Developer Dashboard
- If you need to authenticate again, visit `http://localhost:8888/login` in your browser
- If age evaluation isn't working, check that you've provided a valid OpenAI API key in your config file
- If lyrics aren't showing up, verify your Genius API key or Spotify Web Cookies are correct
- For puppeteer issues on Linux, ensure you've installed the required dependencies: `sudo apt-get install -y libgbm1`
- Make sure you're using the same browser for the app where you're already logged into Spotify

## Project Structure


```
spotify_monitor/
├── app.js                 # Main entry point
├── package.json           # Dependencies and scripts
├── public/                # Static assets (CSS, JS, images)
├── views/                 # EJS templates
└── src/                   # Source code
    ├── app.js             # Application setup and server initialization
    ├── config/            # Configuration loading and validation
    │   └── index.js
    ├── routes/            # Express routes
    │   ├── apiRoutes.js   # API endpoints
    │   ├── authRoutes.js  # Authentication routes
    │   └── webRoutes.js   # Web page routes
    ├── services/          # Business logic
    │   ├── ageEvaluationService.js  # Content age evaluation
    │   ├── lyricsService.js         # Lyrics and transcripts
    │   └── spotifyService.js        # Spotify API interaction
    └── utils/             # Utility functions
        └── browserPool.js # Puppeteer browser management
```
