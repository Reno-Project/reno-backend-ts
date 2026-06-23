export type JwtPayload = {
  id: number;
  email?: string;
  login_token?: string;
  role: string;
  [key: string]: unknown;
};
