# Spotify Account Monitor

Spotify Account Monitor is a comprehensive web application that allows parents and guardians to track and monitor Spotify listening activity in real-time. The app displays currently playing tracks or podcasts with detailed information including album art, artists, playback progress, and recently played content. It features lyrics retrieval via the Genius API, enabling users to review song content, and leverages OpenAI's API to provide age appropriateness evaluations for both music and podcast content based on configurable age thresholds. With customizable monitoring intervals and multi-account support, this tool helps parents make informed decisions about their children's music and podcast consumption while maintaining a sleek, user-friendly interface that updates automatically without requiring page refreshes.

## Setup Instructions

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

3. **Get an OpenAI API Key (Optional)**:
   - Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
   - Sign in or create an account
   - Create a new API key
   - Copy the API key (it will only be shown once)

4. **Configure the application**:
   - Edit `config.json` and add your Spotify Client ID and Client Secret:
   ```json
   {
     "clientId": "YOUR_SPOTIFY_CLIENT_ID",
     "clientSecret": "YOUR_SPOTIFY_CLIENT_SECRET",
     "redirectUri": "http://localhost:8888/callback",
     "monitorInterval": 30000,
     "geniusApiKey": "YOUR_GENIUS_API_KEY",  // Optional
     "openAiApiKey": "YOUR_OPENAI_API_KEY"   // Optional
   }
   ```
   - You can adjust the `monitorInterval` value (in milliseconds) to change how often the app checks what's playing
   - The `geniusApiKey` is optional but recommended for better lyrics search results
   - The `openAiApiKey` is optional but enables the age appropriateness evaluation feature

5. **Install dependencies**:
   ```bash
   npm install
   ```

6. **Run the application**:
   ```bash
   npm start
   ```
   - This will start the server and automatically open the login page in your browser
   - Alternatively, navigate to `http://localhost:8888/login` in your browser

7. **Authorize your Spotify account**:
   - Log in with your Spotify credentials
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
- Shows lyrics for currently playing tracks using the Genius API
- Evaluates age appropriateness of content using OpenAI (when configured)
- Supports monitoring different accounts using different config files

## Troubleshooting

- If you see authentication errors, ensure your Client ID and Client Secret are correctly entered in the config file
- If the callback fails, verify that you've correctly set up the Redirect URI in your Spotify Developer Dashboard
- If you need to authenticate again, visit `http://localhost:8888/login` in your browser
- If age evaluation isn't working, check that you've provided a valid OpenAI API key in your config file