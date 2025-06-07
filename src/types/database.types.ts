/**
 * Database model types for Spotify Monitor
 */

import { Model, Optional } from 'sequelize';

/**
 * Track model attributes
 */
export interface TrackAttributes {
  trackId: string;
  type: string;
  title: string;
  artist?: string | null;
  album?: string | null;
  lyrics?: string | null;
  lyricsSource?: string | null;
  description?: string | null;
  albumArt?: string | null;
  duration?: number | null;
  imageUrl?: string | null;
  htmlDescription?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Track creation attributes (without auto-generated fields)
 */
export interface TrackCreationAttributes extends Optional<TrackAttributes, 'artist' | 'album' | 'lyrics' | 'lyricsSource' | 'description' | 'albumArt' | 'duration' | 'imageUrl' | 'htmlDescription' | 'createdAt' | 'updatedAt'> {}

/**
 * Track model instance
 */
export interface TrackInstance extends Model<TrackAttributes, TrackCreationAttributes>, TrackAttributes {}

/**
 * AI Evaluation model attributes
 */
export interface AiEvaluationAttributes {
  spotifyTrackId: string;
  spotifyUserId: string;
  aiRulesHash: string;
  ageRating?: string | null;
  explanation?: string | null;
  level?: string | null;
  confidenceLevel?: string | null;
  confidenceExplanation?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * AI Evaluation creation attributes
 */
export interface AiEvaluationCreationAttributes extends Optional<AiEvaluationAttributes, 'ageRating' | 'explanation' | 'level' | 'confidenceLevel' | 'confidenceExplanation' | 'createdAt' | 'updatedAt'> {}

/**
 * AI Evaluation model instance
 */
export interface AiEvaluationInstance extends Model<AiEvaluationAttributes, AiEvaluationCreationAttributes>, AiEvaluationAttributes {}

/**
 * Recently Played model attributes
 */
export interface RecentlyPlayedAttributes {
  id?: number;
  spotifyUserId: string;
  spotifyTrackId: string;
  playedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Recently Played creation attributes
 */
export interface RecentlyPlayedCreationAttributes extends Optional<RecentlyPlayedAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

/**
 * Recently Played model instance
 */
export interface RecentlyPlayedInstance extends Model<RecentlyPlayedAttributes, RecentlyPlayedCreationAttributes>, RecentlyPlayedAttributes {}

/**
 * Spotify Auth model attributes
 */
export interface SpotifyAuthAttributes {
  clientId: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Spotify Auth creation attributes
 */
export interface SpotifyAuthCreationAttributes extends Optional<SpotifyAuthAttributes, 'accessToken' | 'refreshToken' | 'expiresAt' | 'createdAt' | 'updatedAt'> {}

/**
 * Spotify Auth model instance
 */
export interface SpotifyAuthInstance extends Model<SpotifyAuthAttributes, SpotifyAuthCreationAttributes>, SpotifyAuthAttributes {}

/**
 * Database models collection
 */
export interface DatabaseModels {
  Track: typeof Model & {
    new(): TrackInstance;
  };
  AiEvaluation: typeof Model & {
    new(): AiEvaluationInstance;
  };
  RecentlyPlayed: typeof Model & {
    new(): RecentlyPlayedInstance;
  };
  SpotifyAuth: typeof Model & {
    new(): SpotifyAuthInstance;
  };
}

/**
 * Migration interface
 */
export interface Migration {
  up: (queryInterface: any, Sequelize: any) => Promise<void>;
  down: (queryInterface: any, Sequelize: any) => Promise<void>;
}