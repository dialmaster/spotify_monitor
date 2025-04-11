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
        this.currentTrack = {
            playing: false,
        };
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
        // Do not set the track if it's the same as the current track
        // But still update the progress IF the user changed it!
        const timeFetched = Date.now();

        if (this.currentTrack?.id === track.id) {
            // Update progress IF it has been manually changed
            const calculatedProgress = this.currentTrack.progress + (timeFetched - this.currentTrack.timeFetched);
            // If calculatedProgress is more than 2 seconds different than track.progress, update the progress
            if (Math.abs(calculatedProgress - track.progress) > 2000) {
                this.currentTrack.progress = track.progress;
                this.currentTrack.timeFetched = timeFetched;
            }
            return;
        }

        track.timeFetched = timeFetched;

        this.currentTrack = track;
    }

    getCurrentTrack() {
        return this.currentTrack;
    }

    // This could get called anytime...
    getCurrentlyPlaying() {
        // truncate lyrics to return only the first 30000 characters, we don't need the frontend to display HUUUGE transcripts
        let truncatedLyrics = null;
        if (this.currentLyrics) {
            truncatedLyrics = { ...this.currentLyrics };
            if (truncatedLyrics.lyrics && typeof truncatedLyrics.lyrics === 'string') {
                truncatedLyrics.lyrics = truncatedLyrics.lyrics.substring(0, 30000);
            }
        }
        return {
            status: this.status,
            track: {
                id: this.currentTrack.id,
                contentType: this.currentTrack.contentType,
                title: this.currentTrack.title,
                spotifyUrl: this.currentTrack.spotifyUrl,
                artist: this.currentTrack.artist,
                imageUrl: this.currentTrack.imageUrl,
                description: this.currentTrack.description,
                progress: this.currentTrack.progress + (Date.now() - this.currentTrack.timeFetched),
                duration: this.currentTrack.duration,
                playing: this.currentTrack.playing,
                album: this.currentTrack.album,
                releaseDate: this.currentTrack.releaseDate,
                htmlDescription: this.currentTrack.htmlDescription,
            },
            lyrics: truncatedLyrics,
            ageEvaluation: this.currentAgeEvaluation,
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

    clearAll() {
        this.currentTrack = {
            playing: false,
        }
        this.currentLyrics = null;
        this.currentAgeEvaluation = null;
    }
}

// Singleton instance
const cacheService = new CacheService();

module.exports = cacheService;