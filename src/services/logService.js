const fs = require('fs');
const path = require('path');
const config = require('../config');
const callMeBotService = require('./callMeBotService');
const recentlyPlayedRepository = require('../repositories/recentlyPlayedRepository');

// Map to track currently playing items to avoid duplicate logging
let trackingMap = new Map();

const ensureLogDirectoryExists = () => {
  const logDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
    console.log('Created logs directory:', logDir);
  }
};

ensureLogDirectoryExists();

/**
 * Get the log file path based on Spotify username in config
 */
const getLogFilePath = () => {
  // Default to 'spotify_user' if no username is configured
  const username = config.spotifyUserName || 'spotify_user';
  return path.join(process.cwd(), 'logs', `${username}_playback.log`);
};

/**
 * Log a track or episode that started playing
 *
 * @param {Object} item - The track or episode object from Spotify API
 * @param {String} type - 'track' or 'episode'
 * @returns {Boolean} - Whether the log was written (false if duplicate)
 */
const logPlaybackStarted = (item, type) => {
  if (!item || !item.id) return false;

  // Only log if this is a new playback (not already being tracked)
  if (trackingMap.has(item.id)) return false;

  // Add to tracking map with timestamp
  trackingMap.set(item.id, {
    timestamp: Date.now(),
    logged: true
  });

  const timestamp = new Date().toISOString();
  const logFile = getLogFilePath();

  let logMessage = `[${timestamp}] Started playing`;

  if (type === 'track') {
    // Format for track
    const artistNames = item.artists.map(artist => artist.name).join(', ');
    logMessage += ` track: "${item.name}" by ${artistNames}`;
    if (item.album && item.album.name) {
      logMessage += ` from album "${item.album.name}"`;
    }
  } else if (type === 'episode') {
    // Format for podcast episode
    const showName = item.show?.name || 'Unknown Show';
    logMessage += ` podcast: "${showName} - ${item.name}"`;
  }

  // Add basic metadata
  logMessage += ` [id: ${item.id}]`;

  recentlyPlayedRepository.addRecentlyPlayed(
    item.spotifyUserId,
    item.id,
    new Date()
  );

  // Write to log file
  fs.appendFileSync(logFile, logMessage + '\n');
  console.log(`Logged playback start to ${logFile}`);

  return true;
};

/**
 * Log age evaluation results for a track or episode
 *
 * @param {Object} item - The track or episode object from Spotify API
 * @param {Object} evaluation - The age evaluation results
 * @returns {Boolean} - Whether the log was written
 */
const logAgeEvaluation = (item, evaluation) => {
  if (!item || !item.id || !evaluation) return false;

  // Check if we're tracking this item
  if (!trackingMap.has(item.id)) {
    // This is unusual but could happen if monitoring starts mid-playback
    trackingMap.set(item.id, {
      timestamp: Date.now(),
      logged: false // Not logging the initial play
    });
  }

  const timestamp = new Date().toISOString();
  const logFile = getLogFilePath();

  let logMessage = `[${timestamp}] Age evaluation for "${item.name}" [id: ${item.id}]:`;
  logMessage += ` Rating: ${evaluation.ageRating}, Level: ${evaluation.level}`;

  // Add confidence information
  if (evaluation.confidence) {
    logMessage += `, Confidence: ${evaluation.confidence.level}`;
  }

  // Add evaluation explanation
  if (evaluation.explanation) {
    // Clean up explanation
    const cleanExplanation = evaluation.explanation
      .replace(/\n/g, ' ')
      .replace(/\s\s+/g, ' ')
      .trim();

    logMessage += `\n    Explanation: ${cleanExplanation}`;
  }

  // Write to log file
  fs.appendFileSync(logFile, logMessage + '\n');
  console.log(`Logged age evaluation to ${logFile}`);

  return true;
};

/**
 * Log when a track is auto-skipped due to being blocked
 *
 * @param {Object} item - The track or episode object from Spotify API
 * @param {String} reason - Reason for skipping
 * @param {Object} evaluation - The age evaluation results (optional)
 * @returns {Boolean} - Whether the log was written
 */
const logAutoSkip = (item, reason = 'BLOCK rating', evaluation = null) => {
  if (!item || !item.id) return false;

  const timestamp = new Date().toISOString();
  const logFile = getLogFilePath();

  let logMessage = `[${timestamp}] Auto-skipped "${item.name}" [id: ${item.id}] due to ${reason}`;

  // Write to log file
  fs.appendFileSync(logFile, logMessage + '\n');
  console.log(`Logged auto-skip to ${logFile}`);

  // Send notification for blocked content that was auto-skipped
  if (reason.includes('BLOCK')) {
    sendBlockNotification(item, evaluation, true);
  }

  return true;
};

/**
 * Send a Signal notification for blocked content
 *
 * @param {Object} item - The track or episode object from Spotify API
 * @param {Object} evaluation - The age evaluation results (optional)
 * @param {Boolean} autoSkipped - Whether the content was auto-skipped
 */
const sendBlockNotification = async (item, evaluation, autoSkipped) => {
  if (!item || !item.id) return;

  try {
    // Format track information
    const username = config.spotifyUserName || 'unknown';
    let message = `BLOCKED CONTENT ALERT FOR USER ${username}: `;

    if (item.type === 'track' || item.artists) {
      // Format for track
      const artistNames = item.artists.map(artist => artist.name).join(', ');
      message += `Track: "${item.name}". `;
      message += `Artist: ${artistNames}. `;

      if (item.album && item.album.name) {
        message += `Album: "${item.album.name}". `;
      }
    } else if (item.type === 'episode' || item.show) {
      // Format for podcast episode
      const showName = item.show?.name || 'Unknown Show';
      message += `Podcast: "${showName}". `;
      message += `Episode: "${item.name}". `;
    } else {
      message += `Content: "${item.name}". `;
    }

    // Add age level information
    if (evaluation) {
      message += `Age Rating: ${evaluation.ageRating}. `;

      // Add reasoning if available
      if (evaluation.explanation) {
        const cleanExplanation = evaluation.explanation
          .replace(/\n/g, ' ')
          .replace(/\s\s+/g, ' ')
          .trim();

        message += `Reasoning: ${cleanExplanation} `;
      }
    }

    // Add auto-skip status
    message += `Auto-Skipped: ${autoSkipped ? 'Yes' : 'No'}.`;

    // Send notification
    await callMeBotService.sendSignalNotification(message);
    console.log('Sent block notification for:', item.name);
  } catch (error) {
    console.error('Error sending block notification:', error.message);
  }
};

/**
 * Check if a track has changed and clean up tracking map
 * Should be called periodically to keep the map size reasonable
 *
 * @param {String} currentItemId - ID of the currently playing item
 */
const cleanupTracking = (currentItemId) => {
  // If nothing is playing or a different track is playing, clean up old entries
  if (!currentItemId) {
    // Remove entries older than 1 hour
    const oneHourAgo = Date.now() - (60 * 60 * 1000);

    for (const [id, data] of trackingMap.entries()) {
      if (data.timestamp < oneHourAgo) {
        trackingMap.delete(id);
      }
    }
  }
};

module.exports = {
  logPlaybackStarted,
  logAgeEvaluation,
  logAutoSkip,
  cleanupTracking,
  sendBlockNotification
};