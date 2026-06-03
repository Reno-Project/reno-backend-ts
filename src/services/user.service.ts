import User from "../models/user";
import type { JwtPayload } from "../types/auth";

export async function verifyUser(
  payload: JwtPayload,
  role: string | false = false
): Promise<boolean> {
  const { id: user_id } = payload;
  const where: Record<string, unknown> = {
    id: user_id,
    is_deleted: 0,
    is_block: 0,
  };
  if (role) {
    where.role = role;
  }
  const count = await User.findAll({ where });
  return count.length > 0;
}
