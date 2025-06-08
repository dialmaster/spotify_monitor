/**
 * Configuration types for Spotify Monitor
 */

/**
 * Age evaluation configuration
 */
export interface AgeEvaluationConfig {
  /** Age of the listener for evaluation purposes */
  listenerAge: number;
  /** Custom instructions for the AI evaluator */
  customInstructions?: string;
}

/**
 * Spotify Web cookies configuration
 */
export interface SpotifyWebCookies {
  sp_dc?: string;
  sp_t?: string;
  sp_adid?: string;
  sp_gaid?: string;
  sp_key?: string;
}

/**
 * Main application configuration
 */
export interface AppConfig {
  /** Spotify application client ID */
  clientId: string;
  /** Spotify application client secret */
  clientSecret: string;
  /** Spotify username to monitor */
  spotifyUserName: string;
  /** OAuth redirect URI */
  redirectUri: string;
  /** Server port */
  port: number;
  /** CallMeBot API URL for notifications (optional) */
  callMeBotUrl?: string;
  /** Whether to automatically skip blocked tracks */
  autoSkipBlocked: boolean;
  /** Monitoring interval in milliseconds */
  monitorInterval: number;
  /** Genius API key for lyrics (optional) */
  geniusApiKey?: string;
  /** OpenAI API key for age evaluation */
  openAiApiKey?: string;
  /** List of whitelisted track IDs */
  whitelistTrackIDs: string[];
  /** Age evaluation configuration */
  ageEvaluation: AgeEvaluationConfig;
  /** Spotify Web cookies string or parsed cookies */
  spotifyWebCookies: string | SpotifyWebCookies;
  /** Database configuration (optional) */
  database?: DatabaseConfig;
  
  // Helper methods
  /** Check if Genius lyrics are available */
  hasGeniusLyrics(): boolean;
  /** Check if age evaluation is available */
  hasAgeEvaluation(): boolean;
  /** Check if Spotify Web access is available */
  hasSpotifyWebAccess(): boolean;
  /** Check if CallMeBot is configured */
  hasCallMeBot(): boolean;
  /** Get the configuration file path */
  getConfigPath(): string;
}

/**
 * Database configuration
 */
export interface DatabaseConfig {
  /** Database name */
  database: string;
  /** Database username */
  username: string;
  /** Database password */
  password: string;
  /** Database host */
  host: string;
  /** Database port */
  port: number;
  /** Database dialect */
  dialect: 'postgres' | 'mysql' | 'sqlite' | 'mariadb' | 'mssql';
  /** Connection pool configuration */
  pool?: {
    max?: number;
    min?: number;
    acquire?: number;
    idle?: number;
  };
  /** Logging configuration */
  logging?: boolean | ((sql: string) => void);
}

/**
 * Environment variables configuration
 */
export interface EnvironmentConfig {
  /** Node environment */
  NODE_ENV?: 'development' | 'production' | 'test';
  /** Database URL */
  DATABASE_URL?: string;
  /** PostgreSQL password */
  POSTGRES_PASSWORD?: string;
  /** PostgreSQL user */
  POSTGRES_USER?: string;
  /** PostgreSQL database */
  POSTGRES_DB?: string;
}