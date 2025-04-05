'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SpotifyAuth extends Model {
    static associate(models) {
    }
  }

  SpotifyAuth.init({
    clientId: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
      comment: 'Spotify client ID',
      field: 'client_id'
    },
    accessToken: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Spotify access token',
      field: 'access_token'
    },
    refreshToken: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Spotify refresh token',
      field: 'refresh_token'
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Token expiration timestamp',
      field: 'expires_at'
    }
  }, {
    sequelize,
    modelName: 'SpotifyAuth',
    tableName: 'spotify_auth',
    timestamps: true,
    underscored: true
  });

  return SpotifyAuth;
};