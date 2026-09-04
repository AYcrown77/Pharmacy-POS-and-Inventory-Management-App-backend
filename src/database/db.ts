import { Sequelize } from 'sequelize';
import pg from 'pg';
import { config } from "../config/config.js";

// Money is stored as an integer number of kobo in BIGINT columns. Without
// this, node-postgres hands BIGINT back as a string and every total would be
// concatenated instead of added. Kobo values sit far inside Number's safe
// integer range, so reading them as numbers is lossless.
pg.defaults.parseInt8 = true;

const sequelize = new Sequelize(
  config.database.name || '',
  config.database.user || '',
  config.database.password || '',
  {
    host: config.database.host,
    port: Number(config.database.port) || 5432,
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      // The pharmacy schema names its own timestamp columns, and the
      // frontend reads them as createdAt / updatedAt.
      underscored: false,
      freezeTableName: false
    }
  }
)

export const connectToDB = async () => {
  try {
    await sequelize.authenticate()
    console.log("Connected to the database Successfully.")

    await sequelize.sync()

    // Receipt numbers come from a postgres sequence rather than a count of the
    // sales table. Three terminals can ring up a sale in the same instant, and
    // MAX(receiptNumber) + 1 would hand two of them the same receipt.
    await sequelize.query('CREATE SEQUENCE IF NOT EXISTS receipt_number_seq START 1')

  } catch (error : any) {
    console.log("Unable to connect to the database:", error.message)
  }
}

export default sequelize
