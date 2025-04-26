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
const cacheService = require('./cacheService');
const statusTypes = require('../types/statusTypes');
const trackRepository = require('../repositories/trackRepository');
const sseService = require('./sseService');
const { logger } = require('./logService');

class MonitoringDaemon {
    constructor() {
        this.isRunning = false;
        this.isFetchingCurrentlyPlaying = false;
        this.monitorInterval = 3000;
        this.cacheService = cacheService;
        this.intervalId = null;
    }

    async start() {
        logger.info('Starting monitoring daemon');
        if (this.isRunning) {
            logger.info('Monitoring daemon already running');
            return;
        }

        const authorized = await spotifyService.initialize();
        if (!authorized) {
            this.cacheService.setStatus(statusTypes.UNAUTHORIZED);
            logger.warn('Monitoring daemon not authorized');
            return;
        }
        logger.info('Monitoring daemon authorized');
        this.cacheService.setStatus(statusTypes.AUTHORIZED);
        this.isRunning = true;
        this.fetchCurrentlyPlaying();
        this.intervalId = setInterval(this.fetchCurrentlyPlaying.bind(this), this.monitorInterval);
    }

    async stop() {
        logger.info('Stopping monitoring daemon');
        if (!this.isRunning) {
            logger.info('Monitoring daemon not running');
            return;
        }

        // Clear the interval
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        // Shut down SSE service
        if (sseService && typeof sseService.shutdown === 'function') {
            sseService.shutdown();
        }

        this.isRunning = false;
        this.cacheService.setStatus(statusTypes.STOPPED);
        logger.info('Monitoring daemon stopped');
    }

    async fetchCurrentlyPlaying() {
        // If we are already fetching currently playing, just return so we don't kick off multiple requests
        if (this.isFetchingCurrentlyPlaying) {
            return;
        }
        this.isFetchingCurrentlyPlaying = true;

        const previousStateTrack = this.cacheService.getCurrentTrack();

        const currentlyPlayingTrack = await this.fetchTrack();
        // If there is no currently playing track and there was a previous track, it means the user stopped playing music
        // So we need to cleanup the tracking and clear the cache, this will notify the frontend
        if (!currentlyPlayingTrack) {
            if (previousStateTrack && previousStateTrack.playing) {
                logService.cleanupTracking(null);
                cacheService.clearAll();
            }
            this.isFetchingCurrentlyPlaying = false;
            return;
        }

        // If we have a new track, update the cache AND set the start time to now.
        // Or if there was nothing playing before, and now there is...
        if ((previousStateTrack && previousStateTrack.id !== currentlyPlayingTrack.id) || !previousStateTrack) {
            const spotifyUserProfile = await spotifyService.getCurrentUserProfile();
            currentlyPlayingTrack.rawItem.spotifyUserId = spotifyUserProfile.id;
            this.cacheService.setCurrentTrack(currentlyPlayingTrack);
            logService.logPlaybackStarted(currentlyPlayingTrack.rawItem, currentlyPlayingTrack.contentType);
        }

        // If it's the same track, just set the track so we can update the progress
        if (previousStateTrack && previousStateTrack.id === currentlyPlayingTrack.id) {
            const spotifyUserProfile = await spotifyService.getCurrentUserProfile();
            currentlyPlayingTrack.rawItem.spotifyUserId = spotifyUserProfile.id;
            this.cacheService.setCurrentTrack(currentlyPlayingTrack);
        }

        if (!this.cacheService.getCurrentLyrics()) {
            const currentLyrics = await this.fetchLyrics();
            this.cacheService.setCurrentLyrics(currentLyrics);
        }

        const currentAgeEvaluation = this.cacheService.getCurrentAgeEvaluation();
        // Check if we need to re-evaluate because we have lyrics but the confidence is LOW
        const currentLyrics = this.cacheService.getCurrentLyrics();
        const shouldReEvaluate = currentAgeEvaluation &&
                                currentAgeEvaluation.evaluation &&
                                currentAgeEvaluation.evaluation.confidence &&
                                currentAgeEvaluation.evaluation.confidence.level === 'LOW' &&
                                currentLyrics &&
                                currentLyrics.lyrics &&
                                !currentLyrics.error;

        if (!currentAgeEvaluation || (!currentAgeEvaluation.error && !currentAgeEvaluation.evaluation) || shouldReEvaluate) {
            if (ageEvaluationService.isAgeEvaluationAvailable()) {
                this.cacheService.setCurrentAgeEvaluation({
                    currentlyFetching: true,
                });
            }
            if (shouldReEvaluate) {
                logger.info('Re-evaluating age rating since we now have lyrics but current confidence is LOW');
            }
            const ageEvaluationResult = await this.fetchAgeEvaluation(shouldReEvaluate);
            // TODO: Log the age evaluation?
            // logService.logAgeEvaluation(item, ageEvaluationResult);
            this.cacheService.setCurrentAgeEvaluation(ageEvaluationResult);
        }

        if (this.cacheService.getCurrentAgeEvaluation()) {
            await this.checkAndSkipBlockedContent();
        }
        this.isFetchingCurrentlyPlaying = false;
    }

    // This will better standardize the data for episodes and tracks
    async fetchTrack() {
        // Get the currently playing track from spotify itself
        const currentlyPlayingTrack = await spotifyService.getCurrentlyPlaying();

        if (!currentlyPlayingTrack.playing) {
            return;
        }

        // Parse out the info we need
        const contentType = currentlyPlayingTrack.item.type;
        const title = currentlyPlayingTrack.item.name;
        const duration = currentlyPlayingTrack.item.duration_ms;
        const progress = currentlyPlayingTrack.progress_ms;
        const spotifyUrl = currentlyPlayingTrack.item.external_urls.spotify;
        const id = currentlyPlayingTrack.item.id;
        const releaseDate = currentlyPlayingTrack.item.release_date;
        const htmlDescription = currentlyPlayingTrack.item.html_description;

        let artist = null;
        let imageUrl = null;
        // Description is the description of the album or podcast itself
        let description = null;
        let album = null;
        if (contentType === 'track') {
            artist = currentlyPlayingTrack.item.artists.map(artist => artist.name).join(', ');
            imageUrl = currentlyPlayingTrack.item.album?.images?.[0]?.url;
            description = currentlyPlayingTrack.item.album?.description;
            album = currentlyPlayingTrack.item.album.name;
        } else if (contentType === 'episode') {
            artist = currentlyPlayingTrack.item.show?.publisher;
            imageUrl = currentlyPlayingTrack.item.show.images?.[0]?.url;
            description = currentlyPlayingTrack.item.show.description;
            album = currentlyPlayingTrack.item.show?.name;
        }

        const track = {
            id,
            contentType,
            title,
            artist,
            spotifyUrl,
            duration,
            progress,
            imageUrl,
            description,
            rawItem: currentlyPlayingTrack.item,
            playing: true,
            album,
            releaseDate,
            htmlDescription
        }

        return track;
    }

    async fetchLyrics() {
        const { title, artist, spotifyUrl, contentType, id } = this.cacheService.getCurrentTrack();
        const cachedLyrics = this.cacheService.getCurrentLyrics();
        let result = {
            lyrics: null,
            error: null,
            source: null,
            url: null,
            sourceDetail: null
        };
        logger.info('Monitoring daemon: fetchLyrics(): Fetching lyrics for ' + title + ' by ' + artist);

        if (cachedLyrics && cachedLyrics.error) {
            return cachedLyrics;
        }

        try {
            // If this is a podcast episode request
            if (contentType === 'episode') {
              if (!title || !spotifyUrl) {
                result.error = 'Missing required parameters for podcast: title and spotifyUrl';
                return result;
              }

              // Extract the episode ID from the URL
              const episodeIdMatch = spotifyUrl.match(/episode\/([a-zA-Z0-9]+)/);
              const episodeId = episodeIdMatch ? episodeIdMatch[1] : null;

            // Check if we already have the transcript in the database for track
            if (episodeId) {
                try {
                  const storedTrack = await trackRepository.findTrackById(episodeId);
                  if (storedTrack && storedTrack.lyrics) {
                    result.lyrics = storedTrack.lyrics;
                    result.source = storedTrack.lyricsSource || 'database';
                    result.url = spotifyUrl;
                    result.sourceDetail = 'Retrieved from database (previously saved from Spotify)';
                    if (result.lyrics == 'No lyrics available') {
                        result.lyrics = 'No lyrics available'; // To store in the DB so we don't keep trying to fetch it
                        result.error = 'No lyrics available'; // FE uses this to display a message
                    }
                    return result;
                  }
                } catch (dbError) {
                  logger.error('Monitoring daemon: fetchLyrics(): Error checking database for transcript:', dbError.message);
                }
              } // End of episode DB check

              // Try to get transcript from the Spotify web page
              const transcript = await lyricsService.getSpotifyPodcastTranscript(spotifyUrl);

              if (transcript) {
                result.lyrics = transcript; // We use the lyrics field for consistency with the frontend
                result.title = title;
                result.source = 'spotify-podcast-transcript';
                result.url = spotifyUrl;
                result.sourceDetail = 'Official transcript from Spotify podcast';
                return result;
              } else {
                result.error = 'No transcript available for this podcast episode';
                return result;
              }
            } // End of episode check

            // Regular track lyrics request
            if (!title || !artist) {
              result.error = 'Missing required parameters: title and artist';
              return result;
            }

            // Variables to hold our results
            let lyrics = null;
            let source = null;

            // Extract the track ID from the URL if available
            let trackId = null;
            if (spotifyUrl) {
              const trackIdMatch = spotifyUrl.match(/track\/([a-zA-Z0-9]+)/);
              trackId = trackIdMatch ? trackIdMatch[1] : null;
            }

            // First, check if we already have lyrics in the database
            if (trackId) {
              try {
                const storedTrack = await trackRepository.findTrackById(trackId);
                if (storedTrack && storedTrack.lyrics) {
                  result.lyrics = storedTrack.lyrics;
                  result.title = title;
                  result.artist = artist;
                  result.source = storedTrack.lyricsSource || 'database';
                  result.url = spotifyUrl;
                  result.sourceDetail = `Retrieved from database (previously saved from ${storedTrack.lyricsSource || 'unknown source'})`;
                  return result;
                }
              } catch (dbError) {
                logger.warn('Error checking database for lyrics, checking other sources:', dbError.message);
                // Continue to fetch lyrics from other sources if database check fails
              }
            }

            // If no lyrics in database and we have a Spotify URL, try the Spotify web page
            if (spotifyUrl) {
              // Try to get lyrics from the Spotify web page
              // Not this also saves the lyrics to the database!
              lyrics = await lyricsService.getSpotifyLyrics(spotifyUrl);

              if (lyrics) {
                source = 'spotify-web';
                result.lyrics = lyrics;
                result.title = title;
                result.artist = artist;
                result.source = source;
                result.url = spotifyUrl;
                result.sourceDetail = 'Official lyrics from Spotify web player';
                return result;
              } else {
                logger.warn('Could not fetch lyrics from Spotify web page, falling back to Genius');
              }
            }

            // Fall back to Genius if Spotify methods failed or weren't attempted
            // Note this also saves the lyrics to the database!
            const geniusResult = await lyricsService.getGeniusLyrics(title, artist, id);

            if (geniusResult && geniusResult.lyrics) {
              result.lyrics = geniusResult.lyrics;
              result.source = 'genius';
              result.url = geniusResult.url;
              result.sourceDetail = 'Official lyrics from Genius';
              return result;
            } else {
              logger.warn('No lyrics found in Genius');
              result.error = 'Could not find lyrics. Consider configuring Genius API key or Spotify cookies for better results.';
              result.suggestion = 'See config.json.example for setup instructions';
              return result;
            }
          } catch (error) {
            logger.error('Lyrics GeniusAPI error:', error.message);
            result.error = 'Error fetching lyrics';
            return result;
          }
    }

    async fetchAgeEvaluation(forceReEvaluation = false) {
        const { id, contentType, title, spotifyUrl } = this.cacheService.getCurrentTrack();
        // This needs to do what the /age-evaluation route does
        logger.info('Monitoring daemon: Fetching age evaluation');
        // Basic validation
        const result = {
            error: null,
            evaluation: null,
        }
        if (!id || !contentType || !title) {
            result.error = 'Missing required parameters: id, type, and title';
            return result;
        }
        if (!ageEvaluationService.isAgeEvaluationAvailable()) {
            result.error = 'OpenAI API not configured';
            return result;
        }

        try {
            const evaluation = await ageEvaluationService.evaluateContentAge({
                id,
                type: contentType,
                title,
                forceReEvaluation
            });
            result.evaluation = evaluation;
            logger.info('Monitoring daemon: fetchAgeEvaluation(): Age evaluation: ' + JSON.stringify(evaluation));
            return result;
        } catch (error) {
            logger.error('Monitoring daemon: fetchAgeEvaluation(): Error evaluating age evaluation:', error.message);
            result.error = 'Error evaluating age evaluation';
            return result;
        }
    }

    async checkAndSkipBlockedContent() {
        const currentTrack = this.cacheService.getCurrentTrack();
        const ageEvaluation = this.cacheService.getCurrentAgeEvaluation();

        if (!currentTrack || !ageEvaluation || !ageEvaluation.evaluation) {
            logger.info('Monitoring daemon: checkAndSkipBlockedContent(): No current track or age evaluation, skipping block checking');
            return;
        }

        if (ageEvaluation.evaluation.level === 'BLOCK') {
            logger.info('Monitoring daemon: checkAndSkipBlockedContent(): Blocked content, skipping to next track');
            spotifyService.skipToNextTrack();
            logService.logAutoSkip(currentTrack, 'BLOCK rating', ageEvaluation);
        }

    }
}

module.exports = new MonitoringDaemon();
