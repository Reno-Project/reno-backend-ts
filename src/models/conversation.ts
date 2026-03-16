import { DataTypes } from "sequelize";
import db from "../utils/db";

const Conversation = db.define(
  "conversation",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    entityType: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    entityId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    parentConversationId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    members: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    createdBy: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    tableName: "conversation",
    timestamps: true,
  }
);

export default Conversation;
