import { DataTypes } from "sequelize";
import ApprovalSubmissionItem from "./approvalSubmissionItem";
import Project from "./project";
import User from "./user";
import db from "../utils/db";

const ApprovalSubmission = db.define(
  "approval_submission",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    category: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    contextType: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "context_type",
    },
    contextId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "context_id",
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "PENDING",
    },
    requestedBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "requested_by",
    },
    requestedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "requested_at",
    },
    requestNote: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "request_note",
    },
    requestPayload: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "request_payload",
    },
    reviewedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "reviewed_by",
    },
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "reviewed_at",
    },
    reviewNote: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "review_note",
    },
  },
  {
    tableName: "APPROVAL_SUBMISSION",
    timestamps: false,
  }
);

ApprovalSubmission.hasMany(ApprovalSubmissionItem, {
  foreignKey: "submissionId",
  as: "items",
});

ApprovalSubmission.belongsTo(User, {
  foreignKey: "requestedBy",
  as: "requester",
});

ApprovalSubmission.belongsTo(User, {
  foreignKey: "reviewedBy",
  as: "reviewer",
});

ApprovalSubmission.belongsTo(Project, {
  foreignKey: "contextId",
  as: "project",
  constraints: false,
});

export default ApprovalSubmission;
