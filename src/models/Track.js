// src/models/Track.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Track extends Model {
    static associate(models) {
      // Define associations here
    }
  }

  Track.init({
    trackId: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
      comment: 'Spotify track ID',
      field: 'track_id'
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Content type (track, episode, etc.)'
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Track or episode title'
    },
    artist: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Artist name(s) or podcast creator'
    },
    album: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Album name or podcast name'
    },
    lyrics: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Track lyrics or episode transcript'
    },
    lyricsSource: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Source of lyrics (e.g., genius, spotify)',
      field: 'lyrics_source'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Track description or episode description'
    },
    albumArt: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'URL to album art or podcast cover',
      field: 'album_art'
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Duration in milliseconds'
    }
  }, {
    sequelize,
    modelName: 'Track',
    tableName: 'tracks',
    timestamps: true,
    underscored: true,
  });

  return Track;
};