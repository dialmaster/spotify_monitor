'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('tracks', 'html_description', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'HTML description of the track'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('tracks', 'html_description');
  }
};
