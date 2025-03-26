const OpenAI = require('openai');
const config = require('../config');
const trackRepository = require('../repositories/trackRepository');

// Initialize OpenAI if API key is available
let openai = null;

if (config.openAiApiKey) {
  try {
    openai = new OpenAI({
      apiKey: config.openAiApiKey
    });
    console.log('OpenAI initialized successfully');
  } catch (error) {
    console.error('Error initializing OpenAI:', error.message);
    console.log('Age evaluation feature will be disabled');
  }
}

// Store age evaluation cache
const ageEvaluationCache = new Map();

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
  const { id, type, title, artist, description, spotifyUrl } = params;

  // Basic validation
  if (!id || !type || !title) {
    throw new Error('Missing required parameters: id, type, and title');
  }

  // Check if track is whitelisted first
  const isWhitelisted = config.whitelistTrackIDs && config.whitelistTrackIDs.includes(id);
  if (isWhitelisted) {
    console.log(`Track "${title}" (${id}) is whitelisted - skipping age evaluation`);
    const response = {
      ageRating: 'Whitelisted',
      explanation: 'Track is whitelisted',
      level: 'WARNING',
      confidence: {
        level: 'HIGH',
        explanation: 'Track is in whitelist'
      }
    };
    ageEvaluationCache.set(id, response);
    return response;
  }

  // Check if OpenAI is configured
  if (!openai) {
    throw new Error('OpenAI API not configured');
  }

  // Create cache key from item ID
  const cacheKey = id;

  // Check cache first
  if (ageEvaluationCache.has(cacheKey)) {
    console.log(`Using cached age evaluation for "${title}"`);
    return ageEvaluationCache.get(cacheKey);
  }

  // Limit cache size (keep no more than 100 entries)
  if (ageEvaluationCache.size >= 100) {
    // Get the oldest key and delete it
    const oldestKey = ageEvaluationCache.keys().next().value;
    ageEvaluationCache.delete(oldestKey);
    console.log('Age evaluation cache full, removed oldest entry');
  }

  // Try to fetch lyrics/transcript from the database
  let lyrics = null;
  let lyricsSource = null;

  try {
    const storedTrack = await trackRepository.findTrackById(id);

    if (storedTrack && storedTrack.lyrics) {
      lyrics = storedTrack.lyrics;
      lyricsSource = storedTrack.lyricsSource;
    } else {
      console.log(`No stored lyrics/transcript found for "${id}"`);
    }
  } catch (error) {
    console.error(`Error fetching stored lyrics content for ${id}:`, error.message);
    // Continue without lyrics if there's an error
  }

  // Prepare content for evaluation
  let content = '';
  if (type === 'track') {
    content = `Track: ${title}\nArtist: ${artist || 'Unknown'}\n`;
    if (lyrics) {
      content += `\nLyrics:\n${lyrics}`;
    }
  } else if (type === 'episode') {
    content = `Podcast: ${title}\n`;
    if (description) {
      content += `\nDescription:\n${description}`;
    }
    if (lyrics) {
      content += `\nTranscript:\n${lyrics}`;
    }
  }

  console.log(`Requesting age evaluation for "${title}"`);

  try {
    // Make OpenAI API request
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
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

    // Get raw content from completion
    let rawContent = completion.choices[0].message.content;

    // Log the raw response from OpenAI
    console.log('Raw OpenAI response:', rawContent);

    // Remove markdown code blocks if present
    let cleanedContent = rawContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    // Also handle the case where it just uses ``` without specifying the language
    cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');

    console.log('Cleaned content for parsing:', cleanedContent);

    let response;
    try {
      // Try to parse response as JSON
      response = JSON.parse(cleanedContent);
    } catch (e) {
      console.log('JSON parse error, using regex fallback:', e.message);

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

    // Safely check if spotifyUrl exists and contains spotify.com
    const fromSpotify = spotifyUrl && spotifyUrl.includes('spotify.com');

    if (lyricsSource && lyricsSource.includes('spotify')) {
      confidenceLevel = 'HIGH';
      confidenceExplanation = type === 'track'
        ? 'We have official lyrics from Spotify'
        : 'We have an official transcript from Spotify';
    } else if (lyricsSource === 'genius') {
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
    ageEvaluationCache.set(cacheKey, response);

    return response;
  } catch (error) {
    console.error('Age evaluation API error:', error.message);
    throw error;
  }
};

// Check if age evaluation is available
const isAgeEvaluationAvailable = () => {
  return !!openai;
};

module.exports = {
  evaluateContentAge,
  isAgeEvaluationAvailable
};