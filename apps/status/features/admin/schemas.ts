import { z } from "zod";

/** Zod schemas shared between admin API routes and admin UI forms. */

export const monitorTypeSchema = z.enum(["http", "tcp", "ping"]);

const optionalInt = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  });

const optionalText = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null));

export const createMonitorSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(120),
    type: monitorTypeSchema.default("http"),
    url: optionalText,
    host: optionalText,
    port: optionalInt,
    method: z.enum(["GET", "HEAD", "POST"]).default("GET"),
    expected_status: optionalInt,
    keyword: optionalText,
    interval_seconds: z.coerce.number().int().min(5).max(86400).default(30),
    timeout_ms: z.coerce.number().int().min(1000).max(120000).default(8000),
    enabled: z.coerce.boolean().default(true),
    sort_order: z.coerce.number().int().default(0),
  })
  .superRefine((data, ctx) => {
    if (data.type === "http") {
      if (!data.url || !/^https?:\/\//i.test(data.url)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["url"],
          message: "A valid http(s) URL is required for HTTP monitors",
        });
      }
    }
    if (data.type === "tcp") {
      if (!data.host)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["host"], message: "Host is required" });
      if (!data.port || data.port < 1 || data.port > 65535)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["port"], message: "Valid port (1-65535) is required" });
    }
    if (data.type === "ping" && !data.host) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["host"], message: "Host is required" });
    }
  });

export type CreateMonitorInput = z.infer<typeof createMonitorSchema>;

// PATCH: every field optional; same shape, no cross-field requirement enforcement here
// (route re-reads the merged row and trusts existing values).
export const updateMonitorSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  type: monitorTypeSchema.optional(),
  url: optionalText,
  host: optionalText,
  port: optionalInt,
  method: z.enum(["GET", "HEAD", "POST"]).optional(),
  expected_status: optionalInt,
  keyword: optionalText,
  interval_seconds: z.coerce.number().int().min(5).max(86400).optional(),
  timeout_ms: z.coerce.number().int().min(1000).max(120000).optional(),
  enabled: z.coerce.boolean().optional(),
  sort_order: z.coerce.number().int().optional(),
});

export type UpdateMonitorInput = z.infer<typeof updateMonitorSchema>;

// ---------- Settings ----------
export const brandingSchema = z.object({
  siteName: z.string().min(1).max(120),
  tagline: z.string().max(200),
  description: z.string().max(400),
  footerText: z.string().max(200),
  footerLinkText: z.string().max(120),
  footerLinkUrl: z.string().max(400),
  metaTitle: z.string().max(160),
  metaDescription: z.string().max(320),
});

export const notificationsSchema = z.object({
  email: z.object({
    enabled: z.coerce.boolean(),
    host: z.string().optional().nullable(),
    port: z.coerce.number().int().min(1).max(65535),
    secure: z.coerce.boolean(),
    user: z.string().optional().nullable(),
    pass: z.string().optional().nullable(),
    from: z.string(),
    to: z.string().optional().nullable(),
  }),
  googleChat: z.object({
    enabled: z.coerce.boolean(),
    webhookUrl: z.string().optional().nullable(),
  }),
  discord: z.object({
    enabled: z.coerce.boolean(),
    webhookUrl: z.string().optional().nullable(),
  }).default({ enabled: false }),
  teams: z.object({
    enabled: z.coerce.boolean(),
    webhookUrl: z.string().optional().nullable(),
  }),
  telegram: z.object({
    enabled: z.coerce.boolean(),
    botToken: z.string().optional().nullable(),
    chatId: z.string().optional().nullable(),
  }),
});

export const retentionSchema = z.object({
  days: z.coerce.number().int().min(1).max(3650),
});

export const settingsUpdateSchema = z.object({
  branding: brandingSchema.optional(),
  notifications: notificationsSchema.optional(),
  retention: retentionSchema.optional(),
  password: z.string().min(6).max(200).optional(),
});

export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>;

// ---------- Incidents & Maintenance ----------
export const incidentTypeSchema = z.enum(["incident", "maintenance"]);

export const incidentStatusSchema = z.enum([
  "investigating",
  "identified",
  "monitoring",
  "resolved",
  "scheduled",
  "in_progress",
  "completed",
]);

export const incidentImpactSchema = z.enum(["none", "minor", "major", "critical"]);

export const createIncidentSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  type: incidentTypeSchema.default("incident"),
  status: incidentStatusSchema,
  impact: incidentImpactSchema.default("minor"),
  monitors: z.array(z.string()).default([]),
  message: z.string().min(1, "Initial update message is required").max(5000),
  scheduled_start: optionalInt,
  scheduled_end: optionalInt,
  notify: z.coerce.boolean().default(false),
});

export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;

export const updateIncidentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  type: incidentTypeSchema.optional(),
  status: incidentStatusSchema.optional(),
  impact: incidentImpactSchema.optional(),
  monitors: z.array(z.string()).optional(),
  scheduled_start: optionalInt,
  scheduled_end: optionalInt,
});

export type UpdateIncidentInput = z.infer<typeof updateIncidentSchema>;

export const addIncidentUpdateSchema = z.object({
  status: incidentStatusSchema,
  message: z.string().min(1, "Update message is required").max(5000),
  notify: z.coerce.boolean().default(false),
});

export type AddIncidentUpdateInput = z.infer<typeof addIncidentUpdateSchema>;
