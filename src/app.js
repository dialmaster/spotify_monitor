// src/app.js
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const config = require('./config');
const browserPool = require('./utils/browserPool');
const dbService = require('./services/dbService');
const spotifyService = require('./services/spotifyService');
const monitoringDaemon = require('./services/monitoringDaemon');
const { logger } = require('./services/logService');

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
  logger.info(`Server running at http://localhost:${config.port}`);
  logger.info(`Using config file: ${config.getConfigPath()}`);
  logger.info(`Genius API key configured: ${config.hasGeniusLyrics() ? 'Yes' : 'No (lyrics functionality may be limited)'}`);
  logger.info(`OpenAI API key configured: ${config.hasAgeEvaluation() ? 'Yes' : 'No (age evaluation disabled)'}`);
  logger.info(`Spotify Web cookies configured: ${config.hasSpotifyWebAccess() ? 'Yes' : 'No (Spotify lyrics/transcripts disabled)'}`);
  logger.info(`Age evaluation configured for listener age: ${config.ageEvaluation.listenerAge}`);
  logger.info(`Auto-skip blocked content: ${config.autoSkipBlocked ? 'Yes' : 'No'}`);
  if (config.ageEvaluation.customInstructions) {
    logger.info(`Custom age evaluation instructions: "${config.ageEvaluation.customInstructions}"`);
  }
  logger.info(`To authorize Spotify, open http://localhost:${config.port} in your browser`);

  // Initialize database connection and run migrations
  try {
    // Try to connect to the database with retries
    let dbConnected = false;
    let retryCount = 0;
    const maxRetries = 5;

    while (!dbConnected && retryCount < maxRetries) {
      logger.info(`Database connection attempt ${retryCount + 1}/${maxRetries}...`);

      try {
        await dbService.initializeDb();
        logger.info('Database initialized with Sequelize models');

        dbConnected = await dbService.testConnection();
        logger.info(`Database connection: ${dbConnected ? 'Successful' : 'Failed'}`);

        if (dbConnected) {
          logger.info('Initializing Spotify service...');
          try {
            const spotifyInitialized = await spotifyService.initialize();
            if (spotifyInitialized) {
              logger.info('Successfully initialized Spotify service with saved tokens');
              monitoringDaemon.start();
            } else {
              logger.info('No valid Spotify tokens found, please authenticate via the web interface');
            }
          } catch (spotifyError) {
            logger.error('Error initializing Spotify service:', spotifyError.message);
          }
        } else {
          retryCount++;
          if (retryCount < maxRetries) {
            logger.info(`Waiting before retry ${retryCount}/${maxRetries}...`);
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
          }
        }
      } catch (initError) {
        logger.error('Error initializing database:', initError);
        retryCount++;
        if (retryCount < maxRetries) {
          logger.info(`Waiting before retry ${retryCount}/${maxRetries}...`);
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        }
      }
    }

    if (!dbConnected) {
      logger.error('Failed to connect to the database after maximum retry attempts. Exiting application.');
      process.exit(1);
    }
  } catch (error) {
    logger.error('Fatal error during application startup:', error);
    process.exit(1);
  }

  // Start browser pool idle checking
  browserPool.startIdleChecking();

  // Preload the browser if we have Spotify web access configured
  if (config.hasSpotifyWebAccess()) {
    browserPool.preloadBrowser();
  } else {
    logger.info('Skipping Puppeteer preload as no Spotify web cookies are configured');
  }
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await dbService.closePool();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Export the app and server for testing
module.exports = { app, server };