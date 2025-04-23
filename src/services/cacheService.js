/**
 * Singleton class to cache/store the currently playing track information
 */
const sseService = require('./sseService');
const ageEvaluationService = require('./ageEvaluationService');
const { logger } = require('./logService');

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
        this.timeLastUpdated = Date.now();
        this.currentLyrics = null;
        this.currentAgeEvaluation = null;
    }

    getStatus() {
        return this.status;
    }

    setStatus(status) {
        this.status = status;
    }

    getTimeLastUpdated() {
        return this.timeLastUpdated;
    }

    setAgeEvaluationLoading() {
        if (ageEvaluationService.isAgeEvaluationAvailable()) {
            this.currentAgeEvaluation = {
                currentlyFetching: true,
            };
        } else {
            this.currentAgeEvaluation = null;
        }
    }

    setCurrentTrack(track) {
        // Do not set the track if it's the same as the current track
        // But still update the progress IF the user changed it!
        const timeLastUpdated = Date.now();

        if (this.currentTrack?.id === track.id) {
            // Update progress IF it has been manually changed
            const calculatedProgress = this.currentTrack.progress + (timeLastUpdated - this.timeLastUpdated);
            // If calculatedProgress is more than 2 seconds different than track.progress, update the progress
            if (Math.abs(calculatedProgress - track.progress) > 2000) {
                logger.info('Calculated progress is more than 2 seconds different than track.progress, updating progress');
                this.currentTrack.progress = track.progress;
                this.timeLastUpdated = timeLastUpdated;

                // Broadcast update to clients
                this._broadcastUpdate();
            }
            return;
        }

        this.currentTrack = track;
        this.setAgeEvaluationLoading(); // If we're setting a new track, we need to set the age evaluation to loading
        this.currentLyrics = null; // If we're setting a new track, we need to clear the lyrics
        this.timeLastUpdated = timeLastUpdated;

        // Broadcast update to clients
        this._broadcastUpdate();
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
            timeLastUpdated: this.timeLastUpdated,
            track: {
                id: this.currentTrack.id,
                contentType: this.currentTrack.contentType,
                title: this.currentTrack.title,
                spotifyUrl: this.currentTrack.spotifyUrl,
                artist: this.currentTrack.artist,
                imageUrl: this.currentTrack.imageUrl,
                description: this.currentTrack.description,
                progress: this.currentTrack.progress + (Date.now() - this.timeLastUpdated),
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
        // Do a deep comparsion, if the lyrics are the same, don't update the cache
        if (JSON.stringify(this.currentLyrics) !== JSON.stringify(lyrics)) {
            this.currentLyrics = lyrics;
            this.timeLastUpdated = Date.now();

            // Broadcast update to clients
            this._broadcastUpdate();
        }
    }

    getCurrentLyrics() {
        return this.currentLyrics;
    }

    setCurrentAgeEvaluation(ageEvaluation) {
        // Do a deep comparsion, if the age evaluation is the same, don't update the cache
        if (JSON.stringify(this.currentAgeEvaluation) !== JSON.stringify(ageEvaluation)) {
            this.currentAgeEvaluation = ageEvaluation;
            this.timeLastUpdated = Date.now();

            // Broadcast update to clients
            this._broadcastUpdate();
        }
    }

    getCurrentAgeEvaluation() {
        return this.currentAgeEvaluation;
    }

    clearAll() {
        this.currentTrack = {
            playing: false,
        }
        this.timeLastUpdated = Date.now();
        this.currentLyrics = null;
        this.currentAgeEvaluation = null;

        // Broadcast update to clients
        this._broadcastUpdate();
    }

    /**
     * Private method to broadcast updates to all SSE clients
     * @private
     */
    _broadcastUpdate() {
        if (this.timeLastUpdated) {
            const clientCount = sseService.getClientCount();
            if (clientCount > 0) {
                const data = this.getCurrentlyPlaying();
                const updatedCount = sseService.broadcast(data, this.timeLastUpdated);
                logger.info(`Broadcasting update to ${updatedCount}/${clientCount} connected clients (timeLastUpdated: ${this.timeLastUpdated}) with data: ${JSON.stringify(data)}`);
            }
        }
    }
}

// Singleton instance
const cacheService = new CacheService();

module.exports = cacheService;