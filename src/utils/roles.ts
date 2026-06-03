import { QueryTypes } from "sequelize";
import { db as dbConfig } from "../config";
import db from "./db";
import Logger from "./logger";

const DEFAULT_CONTRACTOR_ROLES = [
  "contractor",
  "sub_contractor",
  "electrician",
  "plumber",
  "carpenter",
  "painter",
  "landscaper",
  "hvac",
  "roofer",
  "flooring",
  "general_contractor",
];

export async function getAllContractorRoles(): Promise<string[]> {
  const envRoles = process.env.CONTRACTOR_ROLES;
  if (envRoles) {
    return envRoles.split(",").map((role) => role.trim()).filter(Boolean);
  }

  const schema = dbConfig.schema || "dbo";
  try {
    const rows = (await db.query(
      `SELECT name FROM [${schema}].[roles] WHERE is_contractor = 1`,
      { type: QueryTypes.SELECT }
    )) as Array<{ name: string }>;
    if (rows.length > 0) {
      return rows.map((row) => String(row.name));
    }
  } catch (error) {
    Logger.warn("getAllContractorRoles: could not load from DB, using defaults", error);
  }

  return DEFAULT_CONTRACTOR_ROLES;
}
