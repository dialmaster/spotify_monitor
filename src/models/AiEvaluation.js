'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AiEvaluation extends Model {
    static associate(models) {
      // Define associations here
      AiEvaluation.belongsTo(models.Track, {
        foreignKey: 'spotify_track_id',
        targetKey: 'trackId'
      });
    }
  }

  AiEvaluation.init({
    spotifyTrackId: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
      comment: 'Spotify track ID reference',
      field: 'spotify_track_id',
      references: {
        model: 'tracks',
        key: 'track_id'
      }
    },
    spotifyUserId: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
      comment: 'Spotify user ID who requested the evaluation',
      field: 'spotify_user_id'
    },
    aiRulesHash: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Hash of the AI rules used for evaluation',
      field: 'ai_rules_hash'
    },
    ageRating: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Age appropriateness rating',
      field: 'age_rating'
    },
    explanation: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Explanation of the evaluation'
    },
    level: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Content rating level'
    },
    confidenceLevel: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'AI confidence in the evaluation',
      field: 'confidence_level'
    },
    confidenceExplanation: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Explanation of confidence rating',
      field: 'confidence_explanation'
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      field: 'created_at'
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      field: 'updated_at'
    }
  }, {
    sequelize,
    modelName: 'AiEvaluation',
    tableName: 'ai_evaluations',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['spotify_track_id', 'spotify_user_id']
      }
    ]
  });

  return AiEvaluation;
};
