/**
 * Spotify API related types
 */

/**
 * Spotify OAuth token response
 */
export interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

/**
 * Spotify user profile
 */
export interface SpotifyUser {
  id: string;
  display_name: string | null;
  email: string | null;
  explicit_content?: {
    filter_enabled: boolean;
    filter_locked: boolean;
  };
  product?: string;
  type: string;
}

/**
 * Spotify image object
 */
export interface SpotifyImage {
  url: string;
  height?: number;
  width?: number;
}

/**
 * Spotify artist object
 */
export interface SpotifyArtist {
  id: string;
  name: string;
  type: 'artist';
  uri: string;
  external_urls?: {
    spotify?: string;
  };
}

/**
 * Spotify album object
 */
export interface SpotifyAlbum {
  id: string;
  name: string;
  album_type: 'album' | 'single' | 'compilation';
  total_tracks: number;
  release_date: string;
  release_date_precision: 'year' | 'month' | 'day';
  images: SpotifyImage[];
  artists: SpotifyArtist[];
  type: 'album';
  uri: string;
  external_urls?: {
    spotify?: string;
  };
}

/**
 * Spotify track object
 */
export interface SpotifyTrack {
  id: string;
  name: string;
  duration_ms: number;
  explicit: boolean;
  popularity: number;
  track_number: number;
  type: 'track';
  uri: string;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  external_urls?: {
    spotify?: string;
  };
  preview_url?: string | null;
  is_playable?: boolean;
}

/**
 * Spotify show object (for podcasts)
 */
export interface SpotifyShow {
  id: string;
  name: string;
  publisher: string;
  description: string;
  images: SpotifyImage[];
  type: 'show';
  uri: string;
  external_urls?: {
    spotify?: string;
  };
}

/**
 * Spotify episode object
 */
export interface SpotifyEpisode {
  id: string;
  name: string;
  duration_ms: number;
  release_date: string;
  description: string;
  html_description?: string;
  images: SpotifyImage[];
  type: 'episode';
  uri: string;
  show: SpotifyShow;
  external_urls?: {
    spotify?: string;
  };
  resume_point?: {
    fully_played: boolean;
    resume_position_ms: number;
  };
}

/**
 * Spotify playback state
 */
export interface SpotifyPlaybackState {
  timestamp: number;
  progress_ms: number | null;
  is_playing: boolean;
  currently_playing_type: 'track' | 'episode' | 'ad' | 'unknown';
  item: SpotifyTrack | SpotifyEpisode | null;
  context?: {
    type: 'album' | 'artist' | 'playlist' | 'show';
    href: string;
    uri: string;
  };
  device?: SpotifyDevice;
  repeat_state: 'off' | 'track' | 'context';
  shuffle_state: boolean;
}

/**
 * Spotify device object
 */
export interface SpotifyDevice {
  id: string | null;
  is_active: boolean;
  is_private_session: boolean;
  is_restricted: boolean;
  name: string;
  type: string;
  volume_percent: number | null;
}

/**
 * Spotify recently played item
 */
export interface SpotifyRecentlyPlayedItem {
  track: SpotifyTrack;
  played_at: string;
  context?: {
    type: 'album' | 'artist' | 'playlist';
    href: string;
    uri: string;
  };
}

/**
 * Spotify recently played response
 */
export interface SpotifyRecentlyPlayedResponse {
  items: SpotifyRecentlyPlayedItem[];
  next?: string;
  cursors?: {
    after: string;
    before: string;
  };
  limit: number;
  href: string;
}

/**
 * Spotify error response
 */
export interface SpotifyErrorResponse {
  error: {
    status: number;
    message: string;
  };
}

/**
 * Spotify Web API lyrics response
 */
export interface SpotifyWebLyricsResponse {
  lyrics?: {
    syncType: string;
    lines: Array<{
      startTimeMs: string;
      words: string;
      syllables: any[];
      endTimeMs: string;
    }>;
    provider: string;
    providerLyricsId: string;
    providerDisplayName: string;
    syncLyricsUri: string;
    isDenseTypeface: boolean;
    alternatives: any[];
    language: string;
    isRtlLanguage: boolean;
    fullscreenAction: string;
  };
  colors?: {
    background: number;
    text: number;
    highlightText: number;
  };
  hasVocalRemoval?: boolean;
}