const { RecentlyPlayed } = require('../models');

/**
 * Add a new entry to the recently played table
 * @param {string} spotifyUserId - The Spotify user ID
 * @param {string} spotifyTrackId - The Spotify track ID
 * @param {Date} playedAt - The timestamp when the track was played
 * @returns {Promise<Object|null>} - The saved entry or null if duplicate within timeframe
 */
async function addRecentlyPlayed(spotifyUserId, spotifyTrackId, playedAt) {
  try {
    // Check if the last played track is the same and within 5 minutes
    const lastPlayed = await RecentlyPlayed.findOne({
      where: {
        spotifyUserId
      },
      order: [['playedAt', 'DESC']],
      limit: 1
    });

    const currentPlayedAt = playedAt || new Date();

    // If there is a last played track, check if it's the same track within 5 minutes
    if (lastPlayed && lastPlayed.spotifyTrackId === spotifyTrackId) {
      const lastPlayedTime = new Date(lastPlayed.playedAt);
      const timeDifferenceInMinutes = (currentPlayedAt - lastPlayedTime) / (1000 * 60);

      // If the same track was played within 5 minutes, don't add it again
      if (timeDifferenceInMinutes < 5) {
        return null;
      }
    }

    const recentlyPlayed = await RecentlyPlayed.create({
      spotifyUserId,
      spotifyTrackId,
      playedAt: currentPlayedAt
    });

    return recentlyPlayed;
  } catch (error) {
    console.error('Error adding recently played entry:', error);
    throw error;
  }
}

/**
 * Get recently played tracks for a user
 * @param {string} spotifyUserId - The Spotify user ID
 * @param {number} limit - The maximum number of entries to return (default: 25)
 * @returns {Promise<Array>} - Array of recently played tracks
 */
async function getRecentlyPlayedByUser(spotifyUserId, limit = 25) {
  try {
    const recentlyPlayed = await RecentlyPlayed.findAll({
      where: {
        spotifyUserId
      },
      order: [['playedAt', 'DESC']],
      limit
    });
    return recentlyPlayed;
  } catch (error) {
    console.error('Error getting recently played tracks for user:', error);
    throw error;
  }
}

module.exports = {
  addRecentlyPlayed,
  getRecentlyPlayedByUser
};