# Spotify Account Monitor

A simple Node.js application to monitor what's currently playing on a Spotify account.

## Setup Instructions

1. **Create a Spotify Developer App**:
   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/applications)
   - Click "Create An App"
   - Fill in the app name and description
   - For "Website", enter: `http://localhost:8888`
   - For "Redirect URI", enter: `http://localhost:8888/callback`
   - Save your app and note your Client ID and Client Secret

2. **Configure the application**:
   - Edit `config.json` and add your Spotify Client ID and Client Secret:
   ```json
   {
     "clientId": "YOUR_SPOTIFY_CLIENT_ID",
     "clientSecret": "YOUR_SPOTIFY_CLIENT_SECRET",
     "redirectUri": "http://localhost:8888/callback",
     "monitorInterval": 30000
   }
   ```
   - You can adjust the `monitorInterval` value (in milliseconds) to change how often the app checks what's playing

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Run the application**:
   ```bash
   npm start
   ```
   - This will start the server and automatically open the login page in your browser
   - Alternatively, navigate to `http://localhost:8888/login` in your browser

5. **Authorize your Spotify account**:
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
     "monitorInterval": 30000
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
- Supports monitoring different accounts using different config files

## Troubleshooting

- If you see authentication errors, ensure your Client ID and Client Secret are correctly entered in the config file
- If the callback fails, verify that you've correctly set up the Redirect URI in your Spotify Developer Dashboard
- If you need to authenticate again, visit `http://localhost:8888/login` in your browser