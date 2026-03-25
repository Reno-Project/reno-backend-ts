import { DataTypes } from "sequelize";
import db from "../utils/db";

const Message = db.define(
  "message",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    conversationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    read_by: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
  },
  {
    tableName: "messages",
    timestamps: true,
  }
);

export default Message;
