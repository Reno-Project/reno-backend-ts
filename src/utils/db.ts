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

(async () => {
  try{
    await DataBase.authenticate()
    console.log('Connection has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
})()

export default DataBase;
