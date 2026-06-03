export type JwtPayload = {
  id: number;
  login_token?: string;
  role: string;
  [key: string]: unknown;
};
