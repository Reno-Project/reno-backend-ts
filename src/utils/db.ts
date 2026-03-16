import { Sequelize } from "sequelize";
import { db as dbConfig } from "../config";

const DataBase = new Sequelize(dbConfig.name, dbConfig.user, dbConfig.password, {
  host: dbConfig.host,
  dialect: "mssql",
  username: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.name,
  logging: false,
  pool: {
    min: dbConfig.pool.min,
    max: dbConfig.pool.max,
    acquire: dbConfig.pool.acquire,
    idle: dbConfig.pool.idle,
  },
});

export default DataBase;
