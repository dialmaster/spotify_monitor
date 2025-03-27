// src/config/database.js
const config = require('./index');

module.exports = {
  development: {
    username: process.env.POSTGRES_USER || 'spotify',
    password: process.env.POSTGRES_PASSWORD || 'spotify_password',
    database: process.env.POSTGRES_DB || 'spotify_data',
    host: process.env.POSTGRES_HOST || 'spotify-shared-db',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    dialect: 'postgres',
    logging: false
  },
  production: {
    username: process.env.POSTGRES_USER || 'spotify',
    password: process.env.POSTGRES_PASSWORD || 'spotify_password',
    database: process.env.POSTGRES_DB || 'spotify_data',
    host: process.env.POSTGRES_HOST || 'spotify-shared-db',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    dialect: 'postgres',
    logging: false
  }
};