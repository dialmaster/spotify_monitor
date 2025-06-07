// Temporary type declarations for Sequelize models
// These will be replaced when we migrate the models to TypeScript

declare module '*/models/Track.js' {
  const Track: any;
  export = Track;
}

declare module '*/models/AiEvaluation.js' {
  const AiEvaluation: any;
  export = AiEvaluation;
}

declare module '*/models/RecentlyPlayed.js' {
  const RecentlyPlayed: any;
  export = RecentlyPlayed;
}

declare module '*/models/SpotifyAuth.js' {
  const SpotifyAuth: any;
  export = SpotifyAuth;
}

declare module '*/models' {
  export const Track: any;
  export const AiEvaluation: any;
  export const RecentlyPlayed: any;
  export const SpotifyAuth: any;
  export const sequelize: any;
}