import { QueryTypes } from "sequelize";
import { db as dbConfig } from "../config";
import db from "../utils/db";

export async function isRenoAdminUser(userId: number): Promise<boolean> {
  const schema = dbConfig.schema || "dbo";
  const rows = (await db.query(
    `SELECT TOP 1 r.name
     FROM [${schema}].[user_roles] ur
     INNER JOIN [${schema}].[roles] r ON r.id = ur.role_id
     WHERE ur.user_id = :user_id
       AND UPPER(r.name) IN ('RENO_ADMIN', 'RENO_SUPER_ADMIN')`,
    {
      replacements: { user_id: userId },
      type: QueryTypes.SELECT,
    }
  )) as Array<{ name: string }>;

  return rows.length > 0;
}
