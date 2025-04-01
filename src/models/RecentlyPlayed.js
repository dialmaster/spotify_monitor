'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class RecentlyPlayed extends Model {
    static associate(models) {
      // Define associations here
      RecentlyPlayed.belongsTo(models.Track, {
        foreignKey: 'spotify_track_id',
        targetKey: 'trackId'
      });
    }
  }

  RecentlyPlayed.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    spotifyUserId: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Spotify user ID',
      field: 'spotify_user_id'
    },
    spotifyTrackId: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Spotify track ID',
      field: 'spotify_track_id'
    },
    playedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Timestamp when the track was played',
      field: 'played_at'
    }
  }, {
    sequelize,
    modelName: 'RecentlyPlayed',
    tableName: 'recently_played',
    timestamps: true,
    underscored: true,
  });

  return RecentlyPlayed;
};
