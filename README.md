# Spotify Account Monitor

Spotify Account Monitor is a comprehensive web application that allows parents and guardians to track and monitor Spotify listening activity in real-time.

## **NOTE**: This is a work in progress! Use it if you wish, but I make no guarantees :)

## Key Features

- **Real-time Monitoring**: Displays currently playing tracks or podcasts with detailed information including album art, artists, playback progress, and recently played content
- **Lyrics Analysis**: Retrieves lyrics via Spotify or the Genius API, enabling users to review song content
- **Content Evaluation**: Leverages OpenAI's API to provide age appropriateness evaluations for both music and podcast content based on configurable age thresholds
- **Safety Controls**: Includes auto-skip capability for inappropriate content and supports monitoring multiple accounts
- **User Experience**: Maintains a sleek, user-friendly interface that updates automatically without requiring page refreshes
- **Activity Logging**: Automatically creates detailed logs of all playback activity, age evaluations, and content blocks for review and record-keeping
- **Signal Notifications**: Sends real-time alerts via Signal messaging app when inappropriate content is detected or blocked
- **Whitelist**: Supports whitelisting specific tracks to bypass age evaluation

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

- **With CallMeBot Signal API**:
  - Receive instant notifications via Signal messaging app when inappropriate content is detected
  - Detailed information about blocked content including title, artist, album, and reason for blocking
  - Works seamlessly with the auto-skip feature
  - Note: Without this, notifications will only appear in the web interface

## System Requirements
**Note**: *This application has only been tested in WSL2 on Windows, but should work fine in Linux as well*

- Node.js 14 or higher
- Docker and Docker Compose (for running with the provided run.sh script)
- npm or yarn

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

4. **Set Up CallMeBot Signal Notifications (Optional)**:
   - Add the phone number `+34 644 52 74 88` to your phone contacts (name it as you wish)
   - Send the message "I allow callmebot to send me messages" to this contact using Signal Messaging
   - The bot will reply with your personal API key and URL
   - The URL will look like: `https://signal.callmebot.com/signal/send.php?phone=<PHONE_OR_UUID>&apikey=<YOUR_API_KEY>&text=This+is+a+test`
   - Copy the URL **without** the `&text=This+is+a+test` part to use in your config
   - Without this API URL, notification alerts will only appear in the web interface
   - See additional information: https://www.callmebot.com/blog/free-api-signal-send-messages/

5. **Configure the application**:
   - **NOTE**: You can use multiple config files with different port values and clientId/secret to run multiple instances side-by-side!
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
       "callMeBotUrl": "YOUR_CALLMEBOT_API_URL",
       "autoSkipBlocked": true,
       "monitorInterval": 30000,
       "geniusApiKey": "YOUR_GENIUS_API_KEY",
       "openAiApiKey": "YOUR_OPENAI_API_KEY",
       "whitelistTrackIDs": [
         "SPOTIFY_TRACK_ID_1",
         "SPOTIFY_TRACK_ID_2"
       ],
       "ageEvaluation": {
         "listenerAge": 13,
         "customInstructions": "Optional custom instructions for age   evaluation"
       },
       "spotifyWebCookies": "COOKIES_FROM_SPOTIFY_WEB_PLAYER",
       "spotifyUserName": "YOUR_SPOTIFY_USERNAME"
     }
     ```
     - If you don't want to use a specific feature, you can leave its API key as the example value or remove it
     - The app will automatically disable features for which valid API keys aren't provided
     - You can adjust the `monitorInterval` value (in milliseconds) to change how often the app checks what's playing
     - Set `autoSkipBlocked` to `true` to automatically skip tracks that are rated as blocked by the age evaluation
     - Add Spotify track IDs to `whitelistTrackIDs` to bypass age evaluation for specific tracks
       - To find a track's ID:
         1. Right-click on a song in Spotify and select "Share" > "Copy Song Link"
         2. The ID is the string after the last "/" in the URL (e.g., for "https://open.spotify.com/track/1234567890abcdef", the ID is "1234567890abcdef")
     - For `callMeBotUrl`, use the URL provided by CallMeBot **without** the `&text=` parameter
     - The `spotifyUserName` is used to create separate log files for each monitored account (format: username_playback.log), and used to name the docker-compose stacks

   **Note**: After making any changes to your config.json file, you'll need to restart the application for the changes to take effect. If running with Docker, use `docker compose -p spotify-monitor-username restart` (replace "username" with your Spotify username in lowercase).

6. **Get Spotify Web Cookies (Optional but recommended for best lyrics/transcript retrieval)**:
   - Log in to [Spotify Web Player](https://open.spotify.com/) in your browser
   - Open developer tools (F12 or right-click > Inspect)
   - Go to the Console tab and type `document.cookie` and press Enter
   - Copy the entire cookie string and paste it into your config.json for the `spotifyWebCookies` value
   - Note that the following cookies are REQUIRED: `sp_dc`, `sp_t`, `sp_adid`, `sp_gaid`, and `sp_key`
   - Without these cookies, direct lyrics retrieval from Spotify won't work

7. **Running With Docker**:
   - The application includes a `run.sh` script that makes it easy to run multiple instances with Docker.

     - **Make the script executable**:
       ```bash
       chmod +x run.sh
       ```

     - **Run an instance using a config file**:
       ```bash
       ./run.sh --config=config.json
       ```
       The script will automatically use the port specified in your config file

       It will create a unique Docker container based on the Spotify username in your config

     - **Run multiple instances with different config files**

       *Each config file MUST specify a different port value!*
       ```bash
       ./run.sh --config=config.firstconfig.json
       ./run.sh --config=config.secondconfig.json
       ```
       Each instance will run in a separate container with its own port

       All instances will share a network, allowing them to communicate if needed

     - **List all running instances**:
       ```bash
       docker compose ls
       ```
       This will show all running Spotify Monitor instances and their status

     - **Stop a specific instance**:
       ```bash
       docker compose -p spotify-monitor-username down
       ```
       Replace "username" with the Spotify username used in your config (lowercase).

       For example: `docker compose -p spotify-monitor-grant down`

     - **View container logs**:
       ```bash
       docker compose -p spotify-monitor-username logs -f
       ```
       Replace "username" with your Spotify username in lowercase.
       The `-f` flag will follow the logs in real-time. Press Ctrl+C to stop following.

8. **Authorize your Spotify account for each running instance**:
   - Open `http://localhost:<YOUR PORT>` in your browser for each running instance
   - **IMPORTANT**: Use the same browser where you are already logged into the Spotify session for that instance
   - Log in with your Spotify credentials when prompted
   - Allow the requested permissions
   - You'll be redirected back to the application

## Features

- Authenticates with Spotify API using OAuth 2.0
- Monitors currently playing tracks at regular intervals
- Automatically refreshes access tokens
- Displays track information including name, artist, album, and playback progress
- Shows lyrics for currently playing tracks (requires Genius API key or Spotify Web Cookies)
- Evaluates age appropriateness of content (requires OpenAI API key)
- Supports whitelisting specific tracks to bypass age evaluation
- Automatically skips tracks/podcasts rated as blocked based on age settings (optional feature)
- Sends Signal notifications when inappropriate content is detected (requires CallMeBot setup)
- Displays toast notifications when content is automatically skipped
- Supports monitoring different accounts using different config files
- Logs all playback activity, age evaluations, and content blocks to log files for review

## Troubleshooting

- If you see authentication errors, ensure your Client ID and Client Secret are correctly entered in the config file
- If the callback fails, verify that you've correctly set up the Redirect URI in your Spotify Developer Dashboard
- If you need to authenticate again, visit `http://localhost:8888/login` in your browser
- If age evaluation isn't working, check that you've provided a valid OpenAI API key in your config file
- If lyrics aren't showing up, verify your Genius API key or Spotify Web Cookies are correct
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
    │   ├── callMeBotService.js      # Signal notifications
    │   ├── lyricsService.js         # Lyrics and transcripts
    │   ├── logService.js            # Activity logging
    │   └── spotifyService.js        # Spotify API interaction
    └── utils/             # Utility functions
        └── browserPool.js # Puppeteer browser management
```

## Sample Images

![Image 1](https://github.com/user-attachments/assets/04e2374f-7611-4fa0-9008-28a14d06d375)

![Image 2](https://github.com/user-attachments/assets/ec211ed6-4ebf-4302-8db7-e6d9ce33ccc9)
