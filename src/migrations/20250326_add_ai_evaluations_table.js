'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('ai_evaluations', {
      spotify_track_id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
        references: {
          model: 'tracks',
          key: 'track_id'
        }
      },
      spotify_user_id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false
      },
      ai_rules_hash: {
        type: Sequelize.STRING,
        allowNull: false
      },
      age_rating: {
        type: Sequelize.STRING,
        allowNull: true
      },
      explanation: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      level: {
        type: Sequelize.STRING,
        allowNull: true
      },
      confidence_level: {
        type: Sequelize.STRING,
        allowNull: true
      },
      confidence_explanation: {
        type: Sequelize.STRING,
        allowNull: true
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
    }, {
      uniqueKeys: {
        ai_evaluations_unique: {
          fields: ['spotify_track_id', 'spotify_user_id']
        }
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('ai_evaluations');
  }
};
