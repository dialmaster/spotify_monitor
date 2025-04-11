// src/migrations/20250325_create_tracks_table.js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('tracks', {
      trackId: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
        field: 'track_id'
      },
      type: {
        type: Sequelize.STRING,
        allowNull: false
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false
      },
      artist: {
        type: Sequelize.STRING,
        allowNull: true
      },
      album: {
        type: Sequelize.STRING,
        allowNull: true
      },
      lyrics: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      albumArt: {
        type: Sequelize.STRING,
        allowNull: true,
        field: 'album_art'
      },
      duration: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        field: 'created_at'
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        field: 'updated_at'
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('tracks');
  }
};