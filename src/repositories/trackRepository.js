// src/repositories/trackRepository.js
const { Track } = require('../models');

/**
 * Save track information to the database
 * @param {Object} trackData - The track data to save
 * @returns {Promise<Object>} - The saved track
 */
async function saveTrack(trackData) {
  try {
    const [track, created] = await Track.upsert({
      trackId: trackData.trackId,
      type: trackData.type,
      title: trackData.title,
      artist: trackData.artist,
      album: trackData.album,
      lyrics: trackData.lyrics,
      lyricsSource: trackData.lyricsSource,
      description: trackData.description,
      albumArt: trackData.albumArt,
      duration: trackData.duration,
      imageUrl: trackData.imageUrl
    });

    return {
      track,
      created
    };
  } catch (error) {
    console.error('Error saving track:', error);
    throw error;
  }
}

/**
 * Find a track by its Spotify ID
 * @param {string} trackId - The Spotify track ID
 * @returns {Promise<Object|null>} - The track or null if not found
 */
async function findTrackById(trackId) {
  try {
    const track = await Track.findByPk(trackId);
    return track;
  } catch (error) {
    console.error('Error finding track:', error);
    throw error;
  }
}

/**
 * Find tracks by artist
 * @param {string} artist - The artist name (partial match)
 * @returns {Promise<Array>} - Array of tracks
 */
async function findTracksByArtist(artist) {
  try {
    const tracks = await Track.findAll({
      where: {
        artist: {
          [Track.sequelize.Op.iLike]: `%${artist}%`
        }
      },
      order: [['updatedAt', 'DESC']]
    });
    return tracks;
  } catch (error) {
    console.error('Error finding tracks by artist:', error);
    throw error;
  }
}

/**
 * Find tracks by title
 * @param {string} title - The track title (partial match)
 * @returns {Promise<Array>} - Array of tracks
 */
async function findTracksByTitle(title) {
  try {
    const tracks = await Track.findAll({
      where: {
        title: {
          [Track.sequelize.Op.iLike]: `%${title}%`
        }
      },
      order: [['updatedAt', 'DESC']]
    });
    return tracks;
  } catch (error) {
    console.error('Error finding tracks by title:', error);
    throw error;
  }
}


/**
 * Delete a track by its Spotify ID
 * @param {string} trackId - The Spotify track ID
 * @returns {Promise<boolean>} - True if deletion was successful
 */
async function deleteTrack(trackId) {
  try {
    const result = await Track.destroy({
      where: {
        trackId
      }
    });
    return result > 0;
  } catch (error) {
    console.error('Error deleting track:', error);
    throw error;
  }
}

/**
 * Update track lyrics by its Spotify ID
 * @param {string} trackId - The Spotify track ID
 * @param {string} lyrics - The track lyrics
 * @param {string} lyricsSource - The source of the lyrics (e.g., 'genius', 'spotify')
 * @returns {Promise<Object|null>} - The updated track or null if not found
 */
async function updateTrackLyrics(trackId, lyrics, lyricsSource) {
  try {
    console.log(`Updating lyrics for track ${trackId} from source: ${lyricsSource}`);

    const [updatedCount, updatedTracks] = await Track.update(
      {
        lyrics: lyrics,
        lyricsSource: lyricsSource
      },
      {
        where: { trackId },
        returning: true
      }
    );

    if (updatedCount > 0) {
      console.log(`Successfully updated lyrics for track ${trackId}`);
      return updatedTracks[0];
    } else {
      console.log(`No track found with ID ${trackId} to update lyrics`);
      return null;
    }
  } catch (error) {
    console.error('Error updating track lyrics:', error);
    throw error;
  }
}

module.exports = {
  saveTrack,
  findTrackById,
  findTracksByArtist,
  findTracksByTitle,
  deleteTrack,
  updateTrackLyrics
};