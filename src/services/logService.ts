import * as fs from 'fs';
import * as path from 'path';
import * as winston from 'winston';
import config from '../config';
import * as callMeBotService from './callMeBotService';
import * as recentlyPlayedRepository from '../repositories/recentlyPlayedRepository';
import { SpotifyTrack, SpotifyEpisode } from '../types/spotify.types';
import { AgeEvaluationResponse } from '../types/service.types';

interface TrackingData {
  timestamp: number;
  logged: boolean;
}

interface PlaybackItem {
  id: string;
  name?: string;
  title?: string;
  artist?: string;
  album?: string;
  contentType?: 'track' | 'episode';
  spotifyUserId?: string;
  type?: 'track' | 'episode';
  artists?: Array<{ name: string }>;
  show?: { name: string };
}

// Create Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  // Just log to the console
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Map to track currently playing items to avoid duplicate logging
const trackingMap = new Map<string, TrackingData>();

const ensureLogDirectoryExists = (): void => {
  const logDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
    logger.info(`Created logs directory: ${logDir}`);
  }
};

ensureLogDirectoryExists();

/**
 * Get the log file path based on Spotify username in config
 */
const getLogFilePath = (): string => {
  // Default to 'spotify_user' if no username is configured
  const username = config.spotifyUserName || 'spotify_user';
  return path.join(process.cwd(), 'logs', `${username}_playback.log`);
};

/**
 * Log a track or episode that started playing
 */
const logPlaybackStarted = (item: SpotifyTrack | SpotifyEpisode, type: 'track' | 'episode'): boolean => {
  if (!item || !item.id) return false;
  
  // Only skip logging if this is the most recently played item
  if (trackingMap.has(item.id)) {
    // Get the most recent item from the tracking map
    let mostRecentItem: string | null = null;
    let mostRecentTimestamp = 0;

    for (const [id, data] of trackingMap.entries()) {
      if (data.timestamp > mostRecentTimestamp) {
        mostRecentTimestamp = data.timestamp;
        mostRecentItem = id;
      }
    }

    // Only return false if this is the most recently played item
    if (mostRecentItem === item.id) {
      return false;
    }
  }

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
    const track = item as SpotifyTrack;
    const artistNames = track.artists.map(artist => artist.name).join(', ');
    logMessage += ` track: "${track.name}" by ${artistNames}`;
    if (track.album && track.album.name) {
      logMessage += ` from album "${track.album.name}"`;
    }
  } else if (type === 'episode') {
    // Format for podcast episode
    const episode = item as SpotifyEpisode;
    const showName = episode.show?.name || 'Unknown Show';
    logMessage += ` podcast: "${showName} - ${episode.name}"`;
  }

  // Add basic metadata
  logMessage += ` [id: ${item.id}]`;

  // Type guard to ensure we have spotifyUserId
  const itemWithUserId = item as any;
  if (itemWithUserId.spotifyUserId) {
    recentlyPlayedRepository.addRecentlyPlayed(
      itemWithUserId.spotifyUserId,
      item.id,
      new Date()
    );
  }

  // Write to log file
  fs.appendFileSync(logFile, logMessage + '\n');
  logger.info(`Logged playback start to ${logFile}`);

  return true;
};

/**
 * Log age evaluation results for a track or episode
 */
const logAgeEvaluation = (item: SpotifyTrack | SpotifyEpisode, evaluation: AgeEvaluationResponse): boolean => {
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
  logger.info(`Logged age evaluation to ${logFile}`);

  return true;
};

/**
 * Log when a track is auto-skipped due to being blocked
 */
const logAutoSkip = (item: PlaybackItem, reason: string = 'BLOCK rating', evaluation: any = null): boolean => {
  if (!item || !item.id) return false;

  const timestamp = new Date().toISOString();
  const logFile = getLogFilePath();

  let logMessage = `[${timestamp}] Auto-skipped "${item.title}" [id: ${item.id}] due to ${reason}`;

  // Write to log file
  fs.appendFileSync(logFile, logMessage + '\n');
  logger.info(`Logged auto-skip to ${logFile}`);

  // Send notification for blocked content that was auto-skipped
  if (reason.includes('BLOCK')) {
    sendBlockNotification(item, evaluation, true);
  }

  return true;
};

/**
 * Send a Signal notification for blocked content
 */
const sendBlockNotification = async (item: PlaybackItem, evaluation: any, autoSkipped: boolean): Promise<void> => {
  if (!item || !item.id) return;

  try {
    // Format track information
    const username = config.spotifyUserName || 'unknown';
    let message = `BLOCKED CONTENT ALERT FOR USER ${username}: `;

    if (item.contentType === 'track') {
      // Format for track
      message += `Track: "${item.title}". `;
      message += `Artist: ${item.artist}. `;

      if (item.album) {
        message += `Album: "${item.album}". `;
      }
    } else if (item.contentType === 'episode') {
      // Format for podcast episode
      message += `Podcast: "${item.album}". `;
      message += `Episode: "${item.title}". `;
    } else {
      message += `Content: "${item.title}". `;
    }

    // Add age level information
    if (evaluation) {
      message += `Age Rating: ${evaluation.evaluation.ageRating}. `;

      // Add reasoning if available
      if (evaluation.evaluation.explanation) {
        const cleanExplanation = evaluation.evaluation.explanation
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
    logger.info('Sent block notification for:', item.name || item.title);
  } catch (error: any) {
    logger.error('Error sending block notification:', error.message);
  }
};

/**
 * Check if a track has changed and clean up tracking map
 * Should be called periodically to keep the map size reasonable
 */
const cleanupTracking = (currentItemId?: string): void => {
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
  sendBlockNotification,
  logger
};