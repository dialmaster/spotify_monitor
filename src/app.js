// src/app.js
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const config = require('./config');
const browserPool = require('./utils/browserPool');
const dbService = require('./services/dbService');

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

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Apply routes
app.use('/', webRoutes);
app.use('/', authRoutes);
app.use('/api', apiRoutes);

// Start the server
const server = app.listen(config.port, async () => {
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
    const { models } = await dbService.initializeDb();
    console.log('Database initialized with Sequelize models');

    const dbConnected = await dbService.testConnection();
    console.log(`Database connection: ${dbConnected ? 'Successful' : 'Failed'}`);

    // Log available models
    console.log('Available Sequelize models:', Object.keys(models).filter(key => key !== 'sequelize' && key !== 'Sequelize'));
  } catch (error) {
    console.error('Error initializing database:', error);
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