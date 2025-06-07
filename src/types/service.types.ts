/**
 * Service layer types for Spotify Monitor
 */

import { SpotifyTrack, SpotifyEpisode } from './spotify.types';

/**
 * Lyrics service response
 */
export interface LyricsResponse {
  lyrics: string;
  source: 'spotify-web' | 'genius' | 'google' | null;
  currentlyFetching?: boolean;
}

/**
 * Age evaluation confidence level
 */
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Age evaluation level
 */
export type EvaluationLevel = 'OK' | 'WARNING' | 'BLOCK';

/**
 * Age evaluation response
 */
export interface AgeEvaluationResponse {
  ageRating: string;
  explanation: string;
  level: EvaluationLevel;
  confidence: {
    level: ConfidenceLevel;
    explanation: string;
  };
}

/**
 * Cached age evaluation
 */
export interface CachedAgeEvaluation extends AgeEvaluationResponse {
  timestamp: number;
  trackId: string;
}

/**
 * Cache service data structure
 */
export interface CacheData {
  [key: string]: any;
}

/**
 * SSE event types
 */
export type SSEEventType = 
  | 'nowplaying'
  | 'lyrics'
  | 'age-evaluation'
  | 'skip'
  | 'error'
  | 'connection';

/**
 * SSE event data
 */
export interface SSEEventData {
  type: SSEEventType;
  data: any;
  timestamp?: number;
}

/**
 * SSE client connection
 */
export interface SSEClientConnection {
  id: string;
  userId: string;
  response: any; // Express Response
  lastPing?: number;
}

/**
 * Monitoring daemon state
 */
export interface MonitoringState {
  isMonitoring: boolean;
  intervalId?: NodeJS.Timeout;
  lastCheck?: number;
  errorCount: number;
}

/**
 * Token information
 */
export interface TokenInfo {
  access_token: string | null;
  refresh_token: string | null;
  expires_at: number | null;
}

/**
 * Spotify service playback data
 */
export interface PlaybackData {
  playing: boolean;
  type: 'track' | 'episode';
  progress_ms: number;
  item: SpotifyTrack | SpotifyEpisode;
  timestamp: number;
}

/**
 * Track processing result
 */
export interface TrackProcessingResult {
  track: {
    id: string;
    title: string;
    artist?: string;
    album?: string;
    type: string;
    duration?: number;
    imageUrl?: string;
  };
  lyrics?: LyricsResponse;
  ageEvaluation?: AgeEvaluationResponse;
  shouldSkip?: boolean;
}

/**
 * Genius API search result
 */
export interface GeniusSearchResult {
  response: {
    hits: Array<{
      result: {
        id: number;
        title: string;
        primary_artist: {
          name: string;
        };
        url: string;
      };
    }>;
  };
}

/**
 * Genius API song response
 */
export interface GeniusSongResponse {
  response: {
    song: {
      id: number;
      title: string;
      lyrics?: string;
      url: string;
    };
  };
}

/**
 * CallMeBot notification request
 */
export interface CallMeBotRequest {
  phone?: string;
  text: string;
  apiKey?: string;
}

/**
 * Log service options
 */
export interface LogOptions {
  level?: 'error' | 'warn' | 'info' | 'debug';
  userId?: string;
  metadata?: Record<string, any>;
}

/**
 * Database service options
 */
export interface DatabaseServiceOptions {
  forceSync?: boolean;
  alterSync?: boolean;
}

/**
 * Recently played service options
 */
export interface RecentlyPlayedOptions {
  limit?: number;
  userId: string;
  before?: string;
  after?: string;
}

/**
 * Browser pool options
 */
export interface BrowserPoolOptions {
  maxBrowsers?: number;
  headless?: boolean;
  timeout?: number;
}