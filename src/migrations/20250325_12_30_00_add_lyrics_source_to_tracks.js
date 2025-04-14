'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('tracks', 'lyrics_source', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Source of lyrics (e.g., genius, spotify)'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('tracks', 'lyrics_source');
  }
};
