import jwt from "jsonwebtoken";
import { jwtSecret } from "../config";
import type { JwtPayload } from "../types/auth";

export function verify(token: string): JwtPayload | null {
  if (!jwtSecret) {
    return null;
  }
  try {
    const decoded = jwt.verify(token, jwtSecret);
    if (typeof decoded !== "object" || decoded === null) {
      return null;
    }
    return decoded as JwtPayload;
  } catch {
    return null;
  }
}
