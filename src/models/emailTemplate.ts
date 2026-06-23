import { DataTypes } from "sequelize";
import db from "../utils/db";

const EmailTemplate = db.define(
  "email_template",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    slug: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    subject: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    availableTags: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "available_tags",
    },
  },
  {
    tableName: "email_template",
    timestamps: false,
  }
);

export default EmailTemplate;
