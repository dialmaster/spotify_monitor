/**
 * Common shared types for Spotify Monitor
 */

/**
 * Application status types
 */
export type StatusType = 'WAITING' | 'AUTHORIZED' | 'UNAUTHORIZED' | 'ERROR';

/**
 * Status types enum (for compatibility with existing statusTypes.js)
 */
export const StatusTypes = {
  WAITING: 'WAITING' as const,
  AUTHORIZED: 'AUTHORIZED' as const,
  UNAUTHORIZED: 'UNAUTHORIZED' as const,
  ERROR: 'ERROR' as const
};

/**
 * User information
 */
export interface User {
  id: string;
  username: string;
  displayName?: string;
  email?: string;
}

/**
 * Error types
 */
export interface AppError extends Error {
  code?: string;
  statusCode?: number;
  details?: any;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  offset?: number;
}

/**
 * Pagination result
 */
export interface PaginationResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Sort options
 */
export interface SortOptions {
  field: string;
  order: 'ASC' | 'DESC';
}

/**
 * Filter options
 */
export interface FilterOptions {
  [key: string]: any;
}

/**
 * Async operation result
 */
export interface AsyncResult<T> {
  success: boolean;
  data?: T;
  error?: AppError;
}

/**
 * Event types for internal event system
 */
export type EventType = 
  | 'track.playing'
  | 'track.paused'
  | 'track.skipped'
  | 'track.evaluated'
  | 'lyrics.fetched'
  | 'auth.updated'
  | 'error.occurred';

/**
 * Event payload
 */
export interface EventPayload {
  type: EventType;
  userId: string;
  data: any;
  timestamp: number;
}

/**
 * Time range options
 */
export interface TimeRange {
  start?: Date;
  end?: Date;
}

/**
 * Generic callback function
 */
export type Callback<T = any> = (error: Error | null, result?: T) => void;

/**
 * Environment type
 */
export type Environment = 'development' | 'production' | 'test';

/**
 * Log levels
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';

/**
 * HTTP methods
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';

/**
 * Content types
 */
export enum ContentType {
  JSON = 'application/json',
  FORM = 'application/x-www-form-urlencoded',
  MULTIPART = 'multipart/form-data',
  TEXT = 'text/plain',
  HTML = 'text/html'
}

/**
 * Response format
 */
export interface ResponseFormat<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: number;
    version?: string;
    [key: string]: any;
  };
}