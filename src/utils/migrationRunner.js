// src/utils/migrationRunner.js
const { Umzug, SequelizeStorage } = require('umzug');
const path = require('path');
const models = require('../models');

const umzug = new Umzug({
  migrations: {
    glob: path.join(__dirname, '../migrations/*.js'),
    resolve: ({ name, path, context }) => {
      const migration = require(path);
      return {
        name,
        up: async () => migration.up(models.sequelize.getQueryInterface(), models.Sequelize),
        down: async () => migration.down(models.sequelize.getQueryInterface(), models.Sequelize)
      };
    }
  },
  storage: new SequelizeStorage({ sequelize: models.sequelize }),
  logger: console
});

const runMigrations = async () => {
  try {
    console.log('Running database migrations...');
    const migrations = await umzug.up();

    if (migrations.length === 0) {
      console.log('No new migrations to run.');
    } else {
      console.log(`Executed ${migrations.length} migrations:`);
      migrations.forEach(migration => {
        console.log(`- ${migration.name}`);
      });
    }

    return true;
  } catch (error) {
    console.error('Migration failed:', error);
    return false;
  }
};

const getPendingMigrations = async () => {
  try {
    const pending = await umzug.pending();
    return pending;
  } catch (error) {
    console.error('Error getting pending migrations:', error);
    throw error;
  }
};

const getExecutedMigrations = async () => {
  try {
    const executed = await umzug.executed();
    return executed;
  } catch (error) {
    console.error('Error getting executed migrations:', error);
    throw error;
  }
};

module.exports = {
  runMigrations,
  getPendingMigrations,
  getExecutedMigrations
};