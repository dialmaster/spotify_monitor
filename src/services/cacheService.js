/**
 * Singleton class to cache/store the currently playing track information
 */

// Possible statuses:
// WAITING: Waiting to fetch data or be authorized (frontend can just display loading spinner)
// AUTHORIZED: Authorized and ready to fetch data (frontend can still display loading spinners depending on what data is populated in the cache)
// UNAUTHORIZED: Not authorized (frontend should redirect to the login page)
// ERROR: Error (frontend should display an error message)

class CacheService {
    constructor() {
        this.status = 'WAITING';
        this.currentTrack = null;
        this.currentLyrics = null;
        this.currentAgeEvaluation = null;
    }

    getStatus() {
        return this.status;
    }

    setStatus(status) {
        this.status = status;
    }

    setCurrentTrack(track) {
        if (this.currentTrack?.item?.trackId === track.item?.trackId) {
            return;
        }
        this.currentTrack = track;
    }

    getCurrentTrack() {
        return this.currentTrack;
    }

    getCurrentlyPlaying() {
        return {
            status: this.status,
            track: this.currentTrack,
        }
    }

    setCurrentLyrics(lyrics) {
        this.currentLyrics = lyrics;
    }

    getCurrentLyrics() {
        return this.currentLyrics;
    }

    setCurrentAgeEvaluation(ageEvaluation) {
        this.currentAgeEvaluation = ageEvaluation;
    }

    getCurrentAgeEvaluation() {
        return this.currentAgeEvaluation;
    }
}

// Singleton instance
const cacheService = new CacheService();

module.exports = cacheService;