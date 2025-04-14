const spotifyService = require('./spotifyService');
const trackRepository = require('../repositories/trackRepository');
const recentlyPlayedRepository = require('../repositories/recentlyPlayedRepository');
const aiEvaluationRepository = require('../repositories/aiEvaluationRepository');
const ageEvaluationService = require('./ageEvaluationService');

/**
 * Checks if user is authenticated with Spotify
 * @returns {boolean} Authentication status
 */
const isAuthenticated = () => {
  return spotifyService.getCachedData.isAuthenticated();
};

/**
 * Gets user profile with ID needed for database queries
 * @returns {Object} User profile object with ID
 */
const getUserProfile = async () => {
  let userProfile = spotifyService.getCachedData.userProfile();

  if (!userProfile.id) {
    try {
      userProfile = await spotifyService.getCurrentUserProfile();
    } catch (profileError) {
      console.error('Error fetching user profile:', profileError.message);
      throw new Error('Error fetching user profile');
    }
  }

  return userProfile;
};

/**
 * Gets recently played tracks from Spotify API if cache is stale
 * @returns {Array} Recently played tracks from Spotify
 */
const getSpotifyRecentlyPlayed = async () => {
  const fiveMinutesMs = 5 * 60 * 1000;
  let spotifyPlayHistory = spotifyService.getCachedData.playHistory();
  const lastHistoryFetch = spotifyService.getCachedData.lastHistoryFetch();

  if (!spotifyPlayHistory || Date.now() - lastHistoryFetch > fiveMinutesMs) {
    await spotifyService.getRecentlyPlayed();
    spotifyPlayHistory = spotifyService.getCachedData.playHistory();
  }

  return spotifyPlayHistory || [];
};

/**
 * Formats database track records to match Spotify API structure
 * @param {Array} dbRecords - Records from the recently_played database table
 * @returns {Array} Formatted records matching Spotify structure
 */
const formatDatabaseRecords = async (dbRecords) => {
  const formattedDbHistory = await Promise.all(dbRecords.map(async (item) => {
    // Get the track details from the tracks table
    const track = await trackRepository.findTrackById(item.spotifyTrackId);

    if (!track) {
      console.log(`Track ${item.spotifyTrackId} not found in database`);
      return null;
    }

    // Format the response to match Spotify's API structure
    return {
      played_at: item.playedAt.toISOString(),
      track: {
        id: track.trackId,
        name: track.title,
        type: track.type,
        artists: track.artist ? [{ name: track.artist }] : [],
        album: {
          name: track.album || 'Unknown Album',
          images: track.albumArt ? [{ url: track.albumArt }] : []
        },
        duration_ms: track.duration
      },
      source: 'database'
    };
  }));

  // Filter out any null entries
  return formattedDbHistory.filter(item => item !== null);
};

/**
 * Merges recently played tracks from database and Spotify API
 * @param {Array} dbHistory - Formatted database records
 * @param {Array} spotifyHistory - Spotify API records
 * @returns {Array} Merged and sorted history
 */
const mergePlayHistory = (dbHistory, spotifyHistory) => {
  // Add source information to Spotify records
  const spotifyHistoryWithSource = spotifyHistory ?
    spotifyHistory.map(item => ({...item, source: 'spotify'})) :
    [];

  // Merge the two arrays
  let mergedHistory = [];

  // Create a map to track which Spotify entries have been merged
  const mergedSpotifyEntries = new Set();

  // First, check database entries against Spotify entries for merging
  dbHistory.forEach(dbItem => {
    let found = false;

    if (spotifyHistoryWithSource && spotifyHistoryWithSource.length > 0) {
      for (let i = 0; i < spotifyHistoryWithSource.length; i++) {
        const spotifyItem = spotifyHistoryWithSource[i];

        // Check if same track and played within 1 minute
        if (dbItem.track.id === spotifyItem.track.id) {
          const dbTime = new Date(dbItem.played_at).getTime();
          const spotifyTime = new Date(spotifyItem.played_at).getTime();
          const timeDiffMinutes = Math.abs(dbTime - spotifyTime) / (60 * 1000);

          // If the track was played within 3 minutes, merge the items
          // Note, this may merge items when a track was played, stopped and then
          // restarted, and may also create duplicate entries in some cases
          // but generally this will work well.
          if (timeDiffMinutes <= 3) {
            // Merge the items - prefer Spotify data but keep both sources noted
            mergedHistory.push({
              ...spotifyItem,
              source: 'merged',
              sourceDetail: 'Combined from Spotify API and database'
            });

            mergedSpotifyEntries.add(i);
            found = true;
            break;
          }
        }
      }
    }

    // If no matching Spotify entry, add the database entry
    if (!found) {
      mergedHistory.push(dbItem);
    }
  });

  // Add remaining Spotify entries that weren't merged
  if (spotifyHistoryWithSource && spotifyHistoryWithSource.length > 0) {
    spotifyHistoryWithSource.forEach((item, index) => {
      if (!mergedSpotifyEntries.has(index)) {
        mergedHistory.push(item);
      }
    });
  }

  return mergedHistory;
};

/**
 * Enriches recently played history with AI evaluation data
 * @param {Array} mergedHistory - Merged recently played history
 * @param {string} userId - Spotify user ID
 * @returns {Promise<Array>} - History with AI evaluation data
 */
const enrichWithAiEvaluation = async (mergedHistory, userId) => {
  if (!mergedHistory || mergedHistory.length === 0 || !userId) {
    return mergedHistory;
  }

  const enrichedHistory = await Promise.all(mergedHistory.map(async (item) => {
    // Get track ID
    const trackId = item.track ? item.track.id : (item.episode ? item.episode.id : null);
    const title = item.track ? item.track.name : (item.episode ? item.episode.name : 'Unknown');

    if (!trackId) {
      return item;
    }

    try {
      // Fetch AI evaluation for the track
      let evaluation = await aiEvaluationRepository.findEvaluation(trackId, userId);

      // Fetch track data to get lyrics
      const trackData = await trackRepository.findTrackById(trackId);

      let lyrics = null;
      if (trackData && trackData.lyrics) {
        // Limit lyrics to first 5000 characters
        lyrics = trackData.lyrics.substring(0, 5000);
      }

      // If we have lyrics, but we do NOT have an AI evaluation, get it from the age evaluation service
      // And then populate it in the DB
      if (!evaluation && trackData) {
        // Note that this will populate it in the DB...
        evaluation = await ageEvaluationService.evaluateContentAge({
          id: trackId,
          type: 'track',
          title: title
        });
      }


      if (evaluation) {
        // Add AI evaluation data to the item
        return {
          ...item,
          aiEvaluation: {
            ageRating: evaluation.ageRating,
            level: evaluation.level,
            confidenceLevel: evaluation.confidenceLevel,
            confidenceExplanation: evaluation.confidenceExplanation,
            explanation: evaluation.explanation
          },
          lyrics: lyrics
        };
      } else {
        // Check if the track is whitelisted
        const whitelistResult = ageEvaluationService.checkWhitelist(trackId, title);
        if (whitelistResult) {
          // If whitelisted, add the whitelisted evaluation data
          return {
            ...item,
            aiEvaluation: {
              ageRating: whitelistResult.ageRating,
              level: whitelistResult.level,
              confidenceLevel: whitelistResult.confidence.level,
              confidenceExplanation: whitelistResult.confidence.explanation,
              explanation: whitelistResult.explanation
            },
            lyrics: lyrics
          };
        } else if (lyrics) {
          // If no evaluation but we have lyrics, still return those
          return {
            ...item,
            lyrics: lyrics
          };
        }
      }
    } catch (error) {
      console.error(`Error fetching AI evaluation for track ${trackId}:`, error.message);
    }

    // Return original item if no evaluation found or error occurred
    return item;
  }));

  return enrichedHistory;
};

/**
 * Gets recently played tracks from both database and Spotify, merges and sorts them
 * @param {number} limit - Maximum number of tracks to return
 * @returns {Array} Combined recently played history
 */
const getRecentlyPlayed = async (limit = 25) => {
  // Check authentication
  if (!isAuthenticated()) {
    throw new Error('Not authenticated');
  }

  // Get user profile with ID
  const userProfile = await getUserProfile();

  try {
    // Get recently played tracks from our database
    const recentlyPlayedHistory = await recentlyPlayedRepository.getRecentlyPlayedByUser(userProfile.id, limit);

    // Format database records to match Spotify API structure
    const formattedDbHistory = await formatDatabaseRecords(recentlyPlayedHistory);

    // Get recently played from Spotify API
    const spotifyPlayHistory = await getSpotifyRecentlyPlayed();

    // Merge the histories from both sources
    let mergedHistory = mergePlayHistory(formattedDbHistory, spotifyPlayHistory);

    // Sort the merged history by played_at date (most recent first)
    mergedHistory.sort((a, b) => new Date(b.played_at) - new Date(a.played_at));

    // Enrich with AI evaluation data
    mergedHistory = await enrichWithAiEvaluation(mergedHistory, userProfile.id);

    // Limit entries to match original limit
    mergedHistory = mergedHistory.slice(0, limit);

    return mergedHistory;
  } catch (dbError) {
    console.error('Error retrieving recently played history from database:', dbError.message);

    // Fall back to Spotify API if database fails
    console.log('getRecentlyPlayed: Falling back to Spotify API due to database error');
    await spotifyService.getRecentlyPlayed();
    return spotifyService.getCachedData.playHistory() || [];
  }
};

module.exports = {
  isAuthenticated,
  getUserProfile,
  getSpotifyRecentlyPlayed,
  formatDatabaseRecords,
  mergePlayHistory,
  enrichWithAiEvaluation,
  getRecentlyPlayed
};
