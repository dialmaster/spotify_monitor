const config = require('../config');
const axios = require('axios');
const { logger } = require('./logService');

async function sendSignalNotification(message) {
  if (!config.callMeBotUrl) {
    return null;
  }

  // Replace spaces with + and keep only alphanumeric, +, and some basic punctuation
  const encodedMessage = message
    .replace(/ /g, '+')
    .replace(/[^a-zA-Z0-9+.:,!]/g, ''); // Keep only alphanumeric, +, and basic punctuation

  const url = `${config.callMeBotUrl}&text=${encodedMessage}`;

  try {
    const response = await axios.get(url);
    logger.info('Notification sent:', response.data);
    return response.data;
  } catch (error) {
    logger.error('Error sending notification:', error.message);
    throw error;
  }
}

module.exports = { sendSignalNotification };