import { DataTypes } from "sequelize";
import db from "../utils/db";

const Project = db.define(
  "project",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "project",
    timestamps: false,
  }
);

export default Project;
