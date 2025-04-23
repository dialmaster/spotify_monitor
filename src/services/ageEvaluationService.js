const OpenAI = require('openai');
const config = require('../config');
const aiEvaluationRepository = require('../repositories/aiEvaluationRepository');
const trackRepository = require('../repositories/trackRepository');
const spotifyService = require('./spotifyService');
const { logger } = require('./logService');
// Initialize OpenAI if API key is available
let openai = null;

if (config.openAiApiKey) {
  try {
    openai = new OpenAI({
      apiKey: config.openAiApiKey
    });
    logger.info('OpenAI initialized successfully');
  } catch (error) {
    logger.error('Error initializing OpenAI:', error.message);
    logger.info('Age evaluation feature will be disabled');
  }
}

/**
 * Check if content is whitelisted
 * @param {string} id - Spotify ID of the track or episode
 * @param {string} title - Title of the track or episode
 * @returns {Object|null} - Whitelist evaluation result or null if not whitelisted
 */
const checkWhitelist = (id, title) => {
  const isWhitelisted = config.whitelistTrackIDs && config.whitelistTrackIDs.includes(id);
  if (isWhitelisted) {
    logger.info(`Track "${title}" (${id}) is whitelisted - skipping age evaluation`);
    const response = {
      ageRating: 'Whitelisted',
      explanation: 'Track is whitelisted',
      level: 'WARNING',
      confidence: {
        level: 'HIGH',
        explanation: 'Track is in whitelist'
      }
    };
    return response;
  }
  return null;
};

/**
 * Get lyrics/transcript from DB and prepare content for evaluation
 * @param {Object} params - Content parameters
 * @returns {Promise<Object>} - Content and metadata for evaluation
 */
const prepareContentForEvaluation = async (params) => {
  const { id } = params;

  // ONLY use the data from the DB.... everything should be in there.
  try {
    const storedTrack = await trackRepository.findTrackById(id);

    if (!storedTrack) {
      logger.info(`Track not found in DB for "${id}"`);
      return { content: null, lyricsSource: null };
    }

    if (storedTrack.lyrics) {
      logger.info(`Found DB stored lyrics/transcript for track id: ${id}`);
    } else {
      logger.info(`Track found in DB but no stored lyrics/transcript found for "${id}"`);
    }

    const { lyricsSource, artist, album, htmlDescription, description, type, title } = storedTrack;
    const MAX_CONTENT_LENGTH = 30000;
    let lyrics = storedTrack.lyrics;
    if (lyrics && lyrics.length > MAX_CONTENT_LENGTH) {
        lyrics = lyrics.substring(0, MAX_CONTENT_LENGTH);
        truncationMessage = `\n[Content truncated due to length. Evaluation based on first ${MAX_CONTENT_LENGTH} characters.]`;
        lyrics += truncationMessage;
    }

    // Prepare content for evaluation using Markdown formatting
    let content = '';
    if (type === 'track') {
        content = `# Music Track Title: ${title}\n\n`;

        if (artist) {
            content += `## Artist\n\`\`\`\n${artist}\n\`\`\`\n\n`;
        }

        if (album) {
            content += `## Album\n\`\`\`\n${album}\n\`\`\`\n\n`;
        }

        if (lyrics) {
            content += `## Lyrics\n\`\`\`\n${lyrics}\n\`\`\`\n`;
        }
    } else if (type === 'episode') {
        content = `# Podcast Episode Title: ${title}\n\n`;

        if (artist) {
            content += `## Creator\n\`\`\`\n${artist}\n\`\`\`\n\n`;
        }

        if (description) {
            content += `## Podcast Description or Tagline\n\`\`\`\n${description}\n\`\`\`\n\n`;
        }

        if (htmlDescription) {
            content += `## Episode Description\n\`\`\`\n${htmlDescription}\n\`\`\`\n\n`;
        }

        if (lyrics) {
            content += `## Episode Transcript\n\`\`\`\n${lyrics}\n\`\`\`\n`;
        }
    }
    return { content, lyricsSource };

  } catch (error) {
    logger.error(`Error fetching stored track content for ${id}:`, error.message);
  }
  return { content: null, lyricsSource: null };
};

/**
 * Make request to OpenAI for age evaluation
 * @param {string} content - Content to evaluate
 * @param {string} title - Title of content
 * @returns {Promise<Object>} - Raw OpenAI response
 */
const requestAgeEvaluation = async (content, title) => {
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: `You are an assistant that evaluates the age appropriateness of music tracks and podcasts.

The listener's target age is: ${config.ageEvaluation.listenerAge} years old.

${config.ageEvaluation.customInstructions ? `Parent's custom instructions: ${config.ageEvaluation.customInstructions}` : ''}

Provide a clear age recommendation (e.g., 'All ages', '13+', '16+', '18+') and a brief explanation why.
Be objective and consider lyrical content, themes, and language.

Format your response as JSON with the following fields:
- 'ageRating': a clear age recommendation (e.g., 'All ages', '13+', '16+', '18+')
- 'explanation': brief reasoning for your recommendation
- 'level': 'OK' if appropriate for the configured listener age, 'WARNING' if borderline for the listener age, 'BLOCK' if NOT appropriate for the listener age.

DO NOT wrap your response in markdown code blocks.`,
      },
      {
        role: "user",
        content: content
      }
    ]
  });

  return completion;
};

/**
 * Parse OpenAI response and generate the final evaluation
 * @param {Object} completion - OpenAI completion
 * @param {string} id - Spotify ID
 * @param {string} lyricsSource - Source of lyrics
 * @param {string} spotifyUrl - Spotify URL
 * @param {string} type - Content type
 * @returns {Object} - Parsed response with confidence information
 */
const parseResponseAndGenerateEvaluation = (completion, id, lyricsSource, type, spotifyUser) => {
  // Get raw content from completion
  let rawContent = completion.choices[0].message.content;

  // Remove markdown code blocks if present
  let cleanedContent = rawContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  // Also handle the case where it just uses ``` without specifying the language
  cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');

  let response;
  try {
    // Try to parse response as JSON
    response = JSON.parse(cleanedContent);
  } catch (e) {
    logger.error('JSON parse error, using regex fallback:', e.message);

    // Extract age rating with regex (looking for patterns like "13+", "All ages", etc.)
    const ageMatch = rawContent.match(/(?:All ages|\d+\+)/i);
    const ageRating = ageMatch ? ageMatch[0] : "Unknown";

    // Determine level based on extracted age and configured listener age
    let level = 'Unknown';
    if (ageRating.toLowerCase() === 'all ages') {
      level = 'OK';
    } else if (ageRating.match(/\d+\+/)) {
      const extractedAge = parseInt(ageRating, 10);
      if (extractedAge <= config.ageEvaluation.listenerAge) {
        level = 'OK';
      } else if (extractedAge <= config.ageEvaluation.listenerAge + 2) {
        level = 'WARNING';
      } else {
        level = 'BLOCK';
      }
    }

    response = {
      ageRating: ageRating,
      explanation: rawContent.replace(/```json|```/g, '').trim(),
      level: level
    };
  }

  // Determine confidence level based on lyrics source
  let confidenceLevel = 'LOW';
  let confidenceExplanation = '';

  if (lyricsSource && lyricsSource.includes('spotify')) {
    confidenceLevel = 'HIGH';
    confidenceExplanation = type === 'track'
      ? 'We have official lyrics from Spotify'
      : 'We have an official transcript from Spotify';
  } else if (lyricsSource && lyricsSource.includes('genius')) {
    confidenceLevel = 'MEDIUM';
    confidenceExplanation = 'We have third-party lyrics from Genius';
  } else {
    confidenceLevel = 'LOW';
    confidenceExplanation = 'No lyrics or transcript available';
  }

  // Add confidence info to response
  response.confidence = {
    level: confidenceLevel,
    explanation: confidenceExplanation
  };

  // Store in cache
  aiEvaluationRepository.saveEvaluation({
    spotifyTrackId: id,
    spotifyUserId: spotifyUser.id,
    ageRating: response.ageRating,
    explanation: response.explanation,
    level: response.level,
    confidenceLevel: response.confidence.level,
    confidenceExplanation: response.confidence.explanation
  });

  return response;
};

/**
 * Evaluate content age-appropriateness
 * @param {Object} params - Parameters for age evaluation
 * @param {string} params.id - Spotify ID of the track or episode
 * @param {string} params.type - Type of content ('track' or 'episode')
 * @param {string} params.title - Title of the track or episode
 * @param {string} params.artist - Artist name (for tracks)
 * @param {string} params.description - Episode description (for podcasts)
 * @param {string} params.spotifyUrl - Spotify URL of the content
 * @returns {Promise<Object>} - Age evaluation result
 */
const evaluateContentAge = async (params) => {
  const { id, type, title } = params;

  if (!id || !type || !title) {
    throw new Error('Missing required parameters: id, type, and title');
  }

  const whitelistResult = checkWhitelist(id, title);
  if (whitelistResult) {
    return whitelistResult;
  }

  const spotifyUser = await spotifyService.getCurrentUserProfile();

  const cachedResult = await aiEvaluationRepository.findEvaluation(id, spotifyUser.id);

  if (cachedResult) {
    // Return cached result in the SAME FORMAT as the OpenAI response
    const resultObject = {
      ageRating: cachedResult.ageRating,
      explanation: cachedResult.explanation,
      level: cachedResult.level,
      confidence: {
        level: cachedResult.confidenceLevel,
        explanation: cachedResult.confidenceExplanation
      }
    };
    return resultObject;
  }

  if (!openai) {
    throw new Error('OpenAI API not configured');
  }

  logger.info('Evaluating content age for:', id, type, title);
  const { content, lyricsSource } = await prepareContentForEvaluation(params);
  if (!content) {
    logger.info('No content found for evaluation, returning null');
    return null;
  }
  try {
    const completion = await requestAgeEvaluation(content, title);
    return parseResponseAndGenerateEvaluation(completion, id, lyricsSource, type, spotifyUser);
  } catch (error) {
    logger.error('Age evaluation API error:', error.message);
    throw error;
  }
};

const isAgeEvaluationAvailable = () => {
  return !!openai;
};

module.exports = {
  evaluateContentAge,
  isAgeEvaluationAvailable,
  checkWhitelist
};