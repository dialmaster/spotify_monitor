'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('tracks', 'image_url', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'URL to track image from Spotify'
    });

  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('tracks', 'image_url');
  }
};
