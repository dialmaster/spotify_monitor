/**
 * This daemon will run in the background and:
 * - Get the currently playing track
 * - Get the lyrics for the currently playing track
 * - Get the age evaluation for the currently playing track
 * - Skip blocked tracks
 * - Update the currently playing cache as it fetches new data
 * - Call the logging/notification service as needed
 */
const spotifyService = require('./spotifyService');
const logService = require('./logService');
const lyricsService = require('./lyricsService');
const ageEvaluationService = require('./ageEvaluationService');
const config = require('../config');
const cacheService = require('./cacheService');
const statusTypes = require('../types/statusTypes');

class MonitoringDaemon {
    constructor() {
        this.isRunning = false;
        this.monitorInterval = 5000;
        this.cacheService = cacheService;
    }

    async start() {
        console.log('Starting monitoring daemon');
        if (this.isRunning) {
            console.log('Monitoring daemon already running');
            return;
        }

        const authorized = await spotifyService.initialize();
        if (!authorized) {
            this.cacheService.setStatus(statusTypes.UNAUTHORIZED);
            console.log('Monitoring daemon not authorized');
            return;
        }
        console.log('Monitoring daemon authorized');
        this.cacheService.setStatus(statusTypes.AUTHORIZED);
        this.isRunning = true;
        this.fetchCurrentlyPlaying();
        this.monitorInterval = setInterval(this.fetchCurrentlyPlaying.bind(this), this.monitorInterval);
    }

    async fetchCurrentlyPlaying() {
        console.log('Monitoring daemon: Fetching currently playing');

        const currentlyPlayingTrack = await this.fetchTrack();
        console.log('Monitoring daemon: Currently playing set to ' + JSON.stringify(currentlyPlayingTrack));
        this.cacheService.setCurrentTrack(currentlyPlayingTrack);

        const currentLyrics = await this.fetchLyrics(currentlyPlayingTrack);
        this.cacheService.setCurrentLyrics(currentLyrics);

        const currentAgeEvaluation = await this.fetchAgeEvaluation(currentlyPlayingTrack, currentLyrics);
        this.cacheService.setCurrentAgeEvaluation(currentAgeEvaluation);
    }

    // This will better standardize the data for episodes and tracks
    async fetchTrack() {
        // Get the currently playing track from spotify itself
        const currentlyPlayingTrack = await spotifyService.getCurrentlyPlaying();
        console.log('Monitoring daemon: Currently playing set to ' + JSON.stringify(currentlyPlayingTrack));

        // Parse out the info we need
        const contentType = currentlyPlayingTrack.item.type;
        const title = currentlyPlayingTrack.item.name;
        const duration = currentlyPlayingTrack.item.duration_ms;
        const progress = currentlyPlayingTrack.progress_ms;
        const spotifyUrl = currentlyPlayingTrack.item.external_urls.spotify;

        let artist = null;
        let imageUrl = null;
        let description = null;
        if (contentType === 'track') {
            artist = currentlyPlayingTrack.item.artists.map(artist => artist.name).join(', ');
            imageUrl = currentlyPlayingTrack.item.album?.images?.[0]?.url;
            description = currentlyPlayingTrack.item.album?.description;
        } else if (contentType === 'episode') {
            artist = currentlyPlayingTrack.item.show?.publisher;
            imageUrl = currentlyPlayingTrack.item.show.images?.[0]?.url;
            description = currentlyPlayingTrack.item.show.description;
        }

        const track = {
            contentType,
            title,
            artist,
            spotifyUrl,
            duration,
            progress,
            imageUrl,
            description
        }

        return track;
    }

    async fetchLyrics(currentlyPlayingTrack) {
        const { title, artist } = currentlyPlayingTrack;
        // This needs to do what the /lyrics route does
        console.log('Monitoring daemon: Fetching lyrics for ' + title + ' by ' + artist);
    }

    async fetchAgeEvaluation(currentlyPlayingTrack, currentLyrics) {
        // This needs to do what the /age-evaluation route does
        console.log('Monitoring daemon: Fetching age evaluation');
    }
}

module.exports = new MonitoringDaemon();
