import { DataTypes } from "sequelize";
import db from "../utils/db";

const ApprovalSubmissionItem = db.define(
  "approval_submission_item",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    submissionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "submission_id",
    },
    itemType: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "item_type",
    },
    itemId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "item_id",
    },
    itemSnapshot: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "item_snapshot",
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "PENDING",
    },
    decidedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "decided_at",
    },
    itemNote: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "item_note",
    },
  },
  {
    tableName: "APPROVAL_SUBMISSION_ITEM",
    timestamps: false,
  }
);

export default ApprovalSubmissionItem;
