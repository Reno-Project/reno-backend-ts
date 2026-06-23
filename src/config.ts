const parseNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export const environment = process.env.NODE_ENV ?? 'development';
export const port = parseNumber(process.env.PORT, 3001);
export const timezone = process.env.TZ ?? 'UTC';

export const db = {
  name: process.env.DB_NAME || '',
  host: process.env.DB_HOST || '',
  user: process.env.DB_USER || '',
  password: process.env.DB_PASS || '',
  schema: process.env.DB_SCHEMA || '',
  pool: {
    max: 100,
    min: 1,
    acquire: 60000,
    idle: 100000,
  },
};
export const logDirectory = process.env.LOG_DIR || undefined;

export const jwtSecret =
  process.env.JWT_SECRET || process.env.SECRET_KEY || process.env.TOKEN_SECRET || "";

export const leanWebhookSecret = process.env.LEAN_WEBHOOK_SECRET || "";

export const apiV1 = process.env.API_V1 || "";

