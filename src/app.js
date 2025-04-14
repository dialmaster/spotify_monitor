// src/app.js
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const config = require('./config');
const browserPool = require('./utils/browserPool');
const dbService = require('./services/dbService');
const spotifyService = require('./services/spotifyService');
const monitoringDaemon = require('./services/monitoringDaemon');

// Import routes
const authRoutes = require('./routes/authRoutes');
const apiRoutes = require('./routes/apiRoutes');
const webRoutes = require('./routes/webRoutes');

// Create Express app
const app = express();

// Middleware
app.use(express.static(path.join(__dirname, '../public')))
   .use(cookieParser())
   .use(express.json({ limit: '5mb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
  next();
});

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Apply routes
app.use('/', webRoutes);
app.use('/', authRoutes);
app.use('/api', apiRoutes);

// Start the server
const server = app.listen(config.port, '0.0.0.0', async () => {
  console.log(`Server running at http://localhost:${config.port}`);
  console.log(`Using config file: ${config.getConfigPath()}`);
  console.log(`Genius API key configured: ${config.hasGeniusLyrics() ? 'Yes' : 'No (lyrics functionality may be limited)'}`);
  console.log(`OpenAI API key configured: ${config.hasAgeEvaluation() ? 'Yes' : 'No (age evaluation disabled)'}`);
  console.log(`Spotify Web cookies configured: ${config.hasSpotifyWebAccess() ? 'Yes' : 'No (Spotify lyrics/transcripts disabled)'}`);
  console.log(`Age evaluation configured for listener age: ${config.ageEvaluation.listenerAge}`);
  console.log(`Auto-skip blocked content: ${config.autoSkipBlocked ? 'Yes' : 'No'}`);
  if (config.ageEvaluation.customInstructions) {
    console.log(`Custom age evaluation instructions: "${config.ageEvaluation.customInstructions}"`);
  }
  console.log(`To authorize Spotify, open http://localhost:${config.port} in your browser`);

  // Initialize database connection and run migrations
  try {
    // Try to connect to the database with retries
    let dbConnected = false;
    let retryCount = 0;
    const maxRetries = 5;

    while (!dbConnected && retryCount < maxRetries) {
      console.log(`Database connection attempt ${retryCount + 1}/${maxRetries}...`);

      try {
        await dbService.initializeDb();
        console.log('Database initialized with Sequelize models');

        dbConnected = await dbService.testConnection();
        console.log(`Database connection: ${dbConnected ? 'Successful' : 'Failed'}`);

        if (dbConnected) {
          console.log('Initializing Spotify service...');
          try {
            const spotifyInitialized = await spotifyService.initialize();
            if (spotifyInitialized) {
              console.log('Successfully initialized Spotify service with saved tokens');
              monitoringDaemon.start();
            } else {
              console.log('No valid Spotify tokens found, please authenticate via the web interface');
            }
          } catch (spotifyError) {
            console.error('Error initializing Spotify service:', spotifyError.message);
          }
        } else {
          retryCount++;
          if (retryCount < maxRetries) {
            console.log(`Waiting before retry ${retryCount}/${maxRetries}...`);
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
          }
        }
      } catch (initError) {
        console.error('Error initializing database:', initError);
        retryCount++;
        if (retryCount < maxRetries) {
          console.log(`Waiting before retry ${retryCount}/${maxRetries}...`);
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        }
      }
    }

    if (!dbConnected) {
      console.error('Failed to connect to the database after maximum retry attempts. Exiting application.');
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal error during application startup:', error);
    process.exit(1);
  }

  // Start browser pool idle checking
  browserPool.startIdleChecking();

  // Preload the browser if we have Spotify web access configured
  if (config.hasSpotifyWebAccess()) {
    browserPool.preloadBrowser();
  } else {
    console.log('Skipping Puppeteer preload as no Spotify web cookies are configured');
  }
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await dbService.closePool();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Export the app and server for testing
module.exports = { app, server };