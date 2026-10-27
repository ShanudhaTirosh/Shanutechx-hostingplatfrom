import { z } from "zod";

const envSchema = z.object({
  PORT: z.string().optional().default("3000"),
  DATABASE_URL: z.string().optional().default("./data/status.db"),
  EMAIL_ENABLED: z.string().optional().transform((v) => v === "true").default("false"),
  EMAIL_HOST: z.string().optional(),
  EMAIL_PORT: z.string().optional().transform((v) => parseInt(v || "587", 10)).default("587"),
  EMAIL_SECURE: z.string().optional().transform((v) => v === "true").default("false"),
  EMAIL_USER: z.string().optional(),
  EMAIL_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional().default('"Status Page" <no-reply@example.com>'),
  EMAIL_TO: z.string().optional(),
  GOOGLE_CHAT_ENABLED: z.string().optional().transform((v) => v === "true").default("false"),
  GOOGLE_CHAT_WEBHOOK_URL: z.string().optional(),
  DISCORD_ENABLED: z.string().optional().transform((v) => v === "true").default("false"),
  DISCORD_WEBHOOK_URL: z.string().optional(),
  TEAMS_ENABLED: z.string().optional().transform((v) => v === "true").default("false"),
  TEAMS_WEBHOOK_URL: z.string().optional(),
  TELEGRAM_ENABLED: z.string().optional().transform((v) => v === "true").default("false"),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  // Admin auth (single password). Used as bootstrap fallback before a password is set in the DB.
  ADMIN_PASSWORD: z.string().optional(),
  // Secret used to sign session cookies. MUST be stable across restarts.
  SESSION_SECRET: z.string().optional(),
});

export const env = envSchema.parse(process.env);
