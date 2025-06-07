/**
 * API request and response types for Spotify Monitor
 */

import { Request, Response } from 'express';
import { SpotifyUser } from './spotify.types';
import { AgeEvaluationResponse, LyricsResponse } from './service.types';
import { StatusType } from './common.types';

/**
 * Extended Express Request with custom properties
 */
export interface AuthenticatedRequest extends Request {
  /** OAuth state parameter */
  state?: string;
  /** User session data */
  session?: {
    accessToken?: string;
    refreshToken?: string;
    tokenExpiry?: number;
  };
}

/**
 * API error response
 */
export interface ApiErrorResponse {
  error: string;
  message?: string;
  details?: any;
}

/**
 * API success response wrapper
 */
export interface ApiSuccessResponse<T = any> {
  success: boolean;
  data: T;
}

/**
 * Currently playing API response
 */
export interface CurrentlyPlayingApiResponse {
  status: StatusType;
  timeLastUpdated: number;
  track: {
    id?: string;
    contentType?: string;
    title?: string;
    spotifyUrl?: string;
    artist?: string;
    imageUrl?: string;
    description?: string;
    progress: number;
    duration?: number;
    playing: boolean;
    album?: string;
    releaseDate?: string;
    htmlDescription?: string;
  };
  lyrics: LyricsResponse | null;
  ageEvaluation: AgeEvaluationResponse | { currentlyFetching: true } | null;
}

/**
 * Recently played API response item
 */
export interface RecentlyPlayedApiItem {
  played_at: string;
  track: {
    id: string;
    name: string;
    type: string;
    artists: Array<{ name: string }>;
    album: {
      name: string;
      images?: Array<{ url: string }>;
    };
    duration_ms: number;
  };
  source: 'spotify' | 'database' | 'merged';
  sourceDetail?: string;
}

/**
 * User info API response
 */
export interface UserInfoApiResponse {
  user: SpotifyUser | null;
  fetched: boolean;
}

/**
 * History API response
 */
export interface HistoryApiResponse {
  tracks: Array<{
    trackId: string;
    title: string;
    artist?: string;
    playedAt: string;
    ageEvaluation?: {
      ageRating: string;
      explanation: string;
      level: string;
    };
  }>;
  pagination?: {
    total: number;
    page: number;
    limit: number;
  };
}

/**
 * Skip track API response
 */
export interface SkipTrackApiResponse {
  success: boolean;
  message?: string;
}

/**
 * Lyrics API response
 */
export interface LyricsApiResponse {
  lyrics: string | null;
  source: string | null;
  trackId: string;
}

/**
 * Age evaluation API response
 */
export interface AgeEvaluationApiResponse extends AgeEvaluationResponse {
  trackId: string;
  cached?: boolean;
}

/**
 * Auth callback query parameters
 */
export interface AuthCallbackQuery {
  code?: string;
  state?: string;
  error?: string;
}

/**
 * API route parameters
 */
export interface ApiRouteParams {
  trackId?: string;
  userId?: string;
}

/**
 * SSE client connection
 */
export interface SSEClient {
  id: string;
  response: Response;
  userId: string;
}

/**
 * Request with SSE client
 */
export interface SSERequest extends Request {
  sseClient?: SSEClient;
}