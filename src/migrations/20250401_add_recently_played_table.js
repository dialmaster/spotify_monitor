'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('recently_played', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      spotify_user_id: {
        type: Sequelize.STRING,
        allowNull: false
      },
      spotify_track_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'tracks',
          key: 'track_id'
        }
      },
      played_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add index for faster querying of a user's history
    await queryInterface.addIndex('recently_played', ['spotify_user_id', 'played_at']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('recently_played');
  }
};
