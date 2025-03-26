const { Pool } = require('pg');
const config = require('../config');

let pool = null;

/**
 * Initialize the database connection pool
 * @returns {Pool} The database connection pool
 */
function initializeDb() {
  if (pool) {
    return pool;
  }

  // Since we're always in Docker, use the service name directly
  const host = process.env.POSTGRES_HOST || 'spotify-shared-db';

  console.log(`Initializing database connection to ${host}`);

  // Create a new pool using configuration from environment variables or defaults
  pool = new Pool({
    user: process.env.POSTGRES_USER || 'postgres',
    host: host,
    database: process.env.POSTGRES_DB || 'spotify_data',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
  });

  console.log(`Database config: connecting to ${host}:${process.env.POSTGRES_PORT || '5432'}`);

  // Add error handler to prevent app crashes on connection issues
  pool.on('error', (err) => {
    console.error('Unexpected error on idle database client', err);
  });

  return pool;
}

/**
 * Get the database connection pool. Initializes it if not already done.
 * @returns {Pool} The database connection pool
 */
function getPool() {
  if (!pool) {
    return initializeDb();
  }
  return pool;
}

/**
 * Test the database connection
 * @returns {Promise<boolean>} True if connection succeeds, false otherwise
 */
async function testConnection() {
  try {
    const client = await pool.connect();
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
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
}

module.exports = {
  initializeDb,
  getPool,
  testConnection,
  closePool
};
