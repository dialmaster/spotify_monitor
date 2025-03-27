'use strict';
const { AiEvaluation } = require('../models');
const config = require('../config');
const crypto = require('crypto');

/**
 * Create a hash of the AI evaluation rules
 * @param {Object} rules - Rules used for evaluation
 * @returns {string} - Hash of the rules
 */
const createRulesHash = (rules) => {
  const listenerAge = rules.listenerAge || '';
  const customInstructions = rules.customInstructions || '';
  const stringToHash = `${listenerAge}|${customInstructions}`;

  return crypto.createHash('md5').update(stringToHash).digest('hex');
};

/**
 * Find AI evaluation by track ID and user ID
 * @param {string} trackId - Spotify track ID
 * @param {string} userId - Spotify user ID
 * @returns {Promise<Object|null>} - AI evaluation if found, null otherwise
 */
const findEvaluation = async (trackId, userId) => {
  try {
    const rulesHash = createRulesHash({
      listenerAge: config.ageEvaluation.listenerAge,
      customInstructions: config.ageEvaluation.customInstructions
    });
    const evaluation = await AiEvaluation.findOne({
      where: {
        spotifyTrackId: trackId,
        spotifyUserId: userId,
        aiRulesHash: rulesHash
      }
    });

    if (!evaluation) {
      return null;
    }

    return evaluation;
  } catch (error) {
    console.error('Error finding AI evaluation:', error.message);
    throw error;
  }
};

/**
 * Save AI evaluation to database
 * @param {Object} evaluationData - AI evaluation data
 * @returns {Promise<Object>} - Saved AI evaluation
 */
const saveEvaluation = async (evaluationData) => {
  try {
    const rulesHash = createRulesHash({
      listenerAge: config.ageEvaluation.listenerAge,
      customInstructions: config.ageEvaluation.customInstructions
    });
    if (!evaluationData.spotifyTrackId || !evaluationData.spotifyUserId || !rulesHash) {
      console.error('Missing required fields for AI evaluation:',
        `spotifyTrackId: ${evaluationData.spotifyTrackId}`,
        `spotifyUserId: ${evaluationData.spotifyUserId}`,
        `aiRulesHash: ${rulesHash}`);
      throw new Error('Missing required fields for AI evaluation');
    }

    const sanitizedData = { ...evaluationData };
    sanitizedData.aiRulesHash = rulesHash;
    const stringFields = ['ageRating', 'explanation', 'level', 'confidenceLevel', 'confidenceExplanation'];
    stringFields.forEach(field => {
      if (sanitizedData[field] === null || sanitizedData[field] === undefined) {
        sanitizedData[field] = '';
      } else if (typeof sanitizedData[field] !== 'string') {
        sanitizedData[field] = String(sanitizedData[field]);
      }
    });

    const existingEvaluation = await AiEvaluation.findOne({
      where: {
        spotifyTrackId: sanitizedData.spotifyTrackId,
        spotifyUserId: sanitizedData.spotifyUserId
      }
    });

    // If there's an existing evaluation with a different rules hash, update it
    if (existingEvaluation && existingEvaluation.aiRulesHash !== rulesHash) {
      await existingEvaluation.update(sanitizedData);
      return { evaluation: existingEvaluation, created: false, updated: true };
    }

    const whereClause = {
      spotifyTrackId: sanitizedData.spotifyTrackId || '',
      spotifyUserId: sanitizedData.spotifyUserId || '',
      aiRulesHash: sanitizedData.aiRulesHash || ''
    };

    const [evaluation, created] = await AiEvaluation.findOrCreate({
      where: whereClause,
      defaults: sanitizedData
    });

    // If not created (already exists with same hash), update it anyway to ensure latest data
    if (!created) {
      await evaluation.update(sanitizedData);
    }

    return { evaluation, created };
  } catch (error) {
    console.error('Error saving AI evaluation:', error.message);
    throw error;
  }
};

module.exports = {
  createRulesHash,
  findEvaluation,
  saveEvaluation
};