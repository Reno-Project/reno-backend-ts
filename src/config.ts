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
console.log(process.env);

export const mail = {
  host: process.env.SMTP_MAIL_HOST || "",
  port: parseNumber(process.env.SMTP_MAIL_PORT, 587),
  secure: process.env.SMTP_MAIL_SECURE === "true",
  user: process.env.SMTP_MAIL_USERNAME || "",
  password: process.env.SMTP_MAIL_PASSWORD || "",
  requireTls: process.env.SMTP_REQUIRE_TLS === "true",
  senderEmail: process.env.SENDER_EMAIL || "",
};

export const portalLink = (process.env.PORTAL_LINK || "").replace(/\/$/, "");

export function buildContractorPaymentsUrl(projectId: number): string | null {
  if (!portalLink) {
    return null;
  }
  return `${portalLink}/admin/projects/${projectId}/contractor-payments`;
}

