const config = require('../config');
const { SpotifyAuth } = require('../models');
const { clientId } = config;

/**
 * Save Spotify authentication tokens to the database
 * @param {Object} authData - The auth data to save
 * @returns {Promise<Object>} - The saved auth record
 */
async function saveTokens(authData) {
  try {
    const [auth, created] = await SpotifyAuth.upsert({
      clientId: clientId,
      accessToken: authData.accessToken,
      refreshToken: authData.refreshToken,
      expiresAt: authData.expiresAt
    });

    return {
      auth,
      created
    };
  } catch (error) {
    console.error('Error saving Spotify auth tokens:', error);
    throw error;
  }
}

/**
 * Get Spotify auth tokens for a user
 * @param {string} clientId - The Spotify client ID
 * @returns {Promise<Object|null>} - The auth record or null if not found
 */
async function getTokens(clientId) {
  try {
    const auth = await SpotifyAuth.findByPk(clientId);
    return auth;
  } catch (error) {
    console.error('Error getting Spotify auth tokens:', error);
    throw error;
  }
}

/**
 * Get all users with saved auth tokens
 * @returns {Promise<Array>} - Array of auth records
 */
async function getAllUsers() {
  try {
    const allAuth = await SpotifyAuth.findAll({
      order: [['updatedAt', 'DESC']]
    });
    return allAuth;
  } catch (error) {
    console.error('Error getting all Spotify auth users:', error);
    throw error;
  }
}

/**
 * Update Spotify access token and expiration
 * @param {string} clientId - The Spotify client ID
 * @param {string} accessToken - The new access token
 * @param {Date} expiresAt - The new expiration timestamp
 * @returns {Promise<boolean>} - True if update was successful
 */
async function updateAccessToken(clientId, accessToken, expiresAt) {
  try {
    const [updatedCount] = await SpotifyAuth.update(
      {
        accessToken,
        expiresAt
      },
      {
        where: { clientId }
      }
    );

    return updatedCount > 0;
  } catch (error) {
    console.error('Error updating Spotify access token:', error);
    throw error;
  }
}

/**
 * Delete Spotify auth record for a user
 * @param {string} clientId - The Spotify client ID
 * @returns {Promise<boolean>} - True if deletion was successful
 */
async function deleteTokens(clientId) {
  try {
    const result = await SpotifyAuth.destroy({
      where: {
        clientId
      }
    });
    return result > 0;
  } catch (error) {
    console.error('Error deleting Spotify auth tokens:', error);
    throw error;
  }
}

module.exports = {
  saveTokens,
  getTokens,
  updateAccessToken,
  deleteTokens,
  getAllUsers
};