// src/services/dbService.js
const { Pool } = require('pg');
const config = require('../config');
const models = require('../models');
const migrationRunner = require('../utils/migrationRunner');
const { logger } = require('./logService');

let pool = null;

/**
 * Initialize the database connection pool and run migrations
 * @returns {Promise<Object>} The database models
 */
async function initializeDb() {
  if (pool) {
    return { pool, models };
  }

  // Since we're always in Docker, use the service name directly
  const host = process.env.POSTGRES_HOST || 'spotify-shared-db';

  logger.info(`Initializing database connection to ${host}`);

  // Create a new pool using configuration from environment variables or defaults
  pool = new Pool({
    user: process.env.POSTGRES_USER || 'postgres',
    host: host,
    database: process.env.POSTGRES_DB || 'spotify_data',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
  });

  logger.info(`Database config: connecting to ${host}:${process.env.POSTGRES_PORT || '5432'}`);

  // Add error handler to prevent app crashes on connection issues
  pool.on('error', (err) => {
    logger.error('Unexpected error on idle database client', err);
  });

  try {
    // Connect to database using Sequelize
    await models.sequelize.authenticate();
    logger.info('Sequelize connection has been established successfully.');

    // Run migrations
    const migrationSuccess = await migrationRunner.runMigrations();
    if (!migrationSuccess) {
      logger.warn('Some migrations failed to run, but the application will continue.');
    }

    return { pool, models };
  } catch (error) {
    logger.error('Unable to connect to the database or run migrations:', error);
    throw error;
  }
}

/**
 * Get the database connection pool. Initializes it if not already done.
 * @returns {Pool} The database connection pool
 */
function getPool() {
  if (!pool) {
    throw new Error('Database not initialized. Call initializeDb first.');
  }
  return pool;
}

/**
 * Get the database models
 * @returns {Object} The Sequelize models
 */
function getModels() {
  return models;
}

/**
 * Test the database connection
 * @returns {Promise<boolean>} True if connection succeeds, false otherwise
 */
async function testConnection() {
  try {
    const client = await pool.connect();
    client.release();

    // Also test Sequelize connection
    await models.sequelize.authenticate();

    return true;
  } catch (error) {
    logger.error('Database connection test failed:', error);
    return false;
  }
}

/**
 * Close the database connection pool
 * @returns {Promise<void>}
 */
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }

  // Close Sequelize connection as well
  if (models.sequelize) {
    await models.sequelize.close();
    logger.info('Sequelize connection closed');
  }
}

module.exports = {
  initializeDb,
  getPool,
  getModels,
  testConnection,
  closePool
};