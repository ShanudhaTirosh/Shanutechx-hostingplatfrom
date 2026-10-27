import sqlite3 from "sqlite3";
import path from "path";
import fs from "fs";
import { env } from "./env";

const dbPath = path.isAbsolute(env.DATABASE_URL)
  ? env.DATABASE_URL
  : path.join(process.cwd(), env.DATABASE_URL);

// Ensure directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

export interface CheckEntry {
  id?: number;
  site_id: string;
  ts: number;
  ok: number;
  latency_ms: number | null;
  status_code: number | null;
  error: string | null;
}

export interface Summary {
  total: number;
  okCount: number;
  percent: number;
}

export type IncidentType = "incident" | "maintenance";

export type IncidentStatus =
  | "investigating"
  | "identified"
  | "monitoring"
  | "resolved"
  | "scheduled"
  | "in_progress"
  | "completed";

export type IncidentImpact = "none" | "minor" | "major" | "critical";

export interface IncidentRow {
  id: string;
  title: string;
  type: IncidentType;
  status: IncidentStatus;
  impact: IncidentImpact;
  monitors: string; // JSON string array e.g. ["monitor-1"]
  scheduled_start: number | null;
  scheduled_end: number | null;
  created_at: number;
  updated_at: number;
  resolved_at: number | null;
}

export interface IncidentUpdateRow {
  id: number;
  incident_id: string;
  status: IncidentStatus;
  message: string;
  created_at: number;
}

export interface IncidentWithUpdates extends IncidentRow {
  parsed_monitors: string[];
  updates: IncidentUpdateRow[];
}

export interface NewIncident {
  id: string;
  title: string;
  type?: IncidentType;
  status: IncidentStatus;
  impact?: IncidentImpact;
  monitors?: string[];
  scheduled_start?: number | null;
  scheduled_end?: number | null;
  message: string;
}

export type MonitorType = "http" | "tcp" | "ping";

export interface MonitorRow {
  id: string;
  name: string;
  type: MonitorType;
  url: string | null;
  host: string | null;
  port: number | null;
  method: string;
  expected_status: number | null;
  keyword: string | null;
  interval_seconds: number;
  timeout_ms: number;
  enabled: number;
  sort_order: number;
  created_at: number;
  updated_at: number;
}

export interface NewMonitor {
  id: string;
  name: string;
  type: MonitorType;
  url?: string | null;
  host?: string | null;
  port?: number | null;
  method?: string;
  expected_status?: number | null;
  keyword?: string | null;
  interval_seconds: number;
  timeout_ms: number;
  enabled?: number;
  sort_order?: number;
}

function run(sql: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function all<T>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}

function get<T>(sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T | undefined);
    });
  });
}

export async function initDb() {
  await run(
    `CREATE TABLE IF NOT EXISTS checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id TEXT NOT NULL,
      ts INTEGER NOT NULL,
      ok INTEGER NOT NULL,
      latency_ms INTEGER,
      status_code INTEGER,
      error TEXT
    )`
  );
  await run("CREATE INDEX IF NOT EXISTS idx_checks_site_ts ON checks(site_id, ts)");

  // Monitors — DB-managed replacement for the hardcoded lib/config.ts sites.
  // id is a TEXT slug so existing checks.site_id history stays linked.
  await run(
    `CREATE TABLE IF NOT EXISTS monitors (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      type            TEXT NOT NULL DEFAULT 'http',
      url             TEXT,
      host            TEXT,
      port            INTEGER,
      method          TEXT NOT NULL DEFAULT 'GET',
      expected_status INTEGER,
      keyword         TEXT,
      interval_seconds INTEGER NOT NULL DEFAULT 30,
      timeout_ms      INTEGER NOT NULL DEFAULT 8000,
      enabled         INTEGER NOT NULL DEFAULT 1,
      sort_order      INTEGER NOT NULL DEFAULT 0,
      created_at      INTEGER NOT NULL,
      updated_at      INTEGER NOT NULL
    )`
  );
  await run("CREATE INDEX IF NOT EXISTS idx_monitors_sort ON monitors(sort_order, created_at)");

  // Settings — key/value JSON blobs: 'branding' | 'notifications' | 'retention' | 'admin'.
  await run(
    `CREATE TABLE IF NOT EXISTS settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`
  );

  // Incidents and Scheduled Maintenance
  await run(
    `CREATE TABLE IF NOT EXISTS incidents (
      id              TEXT PRIMARY KEY,
      title           TEXT NOT NULL,
      type            TEXT NOT NULL DEFAULT 'incident',
      status          TEXT NOT NULL,
      impact          TEXT NOT NULL DEFAULT 'minor',
      monitors        TEXT NOT NULL DEFAULT '[]',
      scheduled_start INTEGER,
      scheduled_end   INTEGER,
      created_at      INTEGER NOT NULL,
      updated_at      INTEGER NOT NULL,
      resolved_at     INTEGER
    )`
  );
  await run("CREATE INDEX IF NOT EXISTS idx_incidents_type_status ON incidents(type, status, created_at)");

  await run(
    `CREATE TABLE IF NOT EXISTS incident_updates (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      incident_id TEXT NOT NULL,
      status      TEXT NOT NULL,
      message     TEXT NOT NULL,
      created_at  INTEGER NOT NULL
    )`
  );
  await run("CREATE INDEX IF NOT EXISTS idx_incident_updates ON incident_updates(incident_id, created_at)");
}

export const dbOps = {
  async insertCheck(entry: {
    siteId: string;
    ts: number;
    ok: boolean;
    latency?: number | null;
    statusCode?: number | null;
    error?: string | null;
  }) {
    await run(
      "INSERT INTO checks (site_id, ts, ok, latency_ms, status_code, error) VALUES (?, ?, ?, ?, ?, ?)",
      [
        entry.siteId,
        entry.ts,
        entry.ok ? 1 : 0,
        entry.latency ?? null,
        entry.statusCode ?? null,
        entry.error ?? null,
      ]
    );
  },
  async listChecks(siteId: string, days: number): Promise<CheckEntry[]> {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return all<CheckEntry>(
      "SELECT site_id, ts, ok, latency_ms, status_code, error FROM checks WHERE site_id = ? AND ts >= ? ORDER BY ts DESC",
      [siteId, cutoff]
    );
  },
  async getLatest(siteId: string): Promise<CheckEntry | undefined> {
    return get<CheckEntry>(
      "SELECT site_id, ts, ok, latency_ms, status_code, error FROM checks WHERE site_id = ? ORDER BY ts DESC LIMIT 1",
      [siteId]
    );
  },
  async getSummary(siteId: string, days: number): Promise<Summary> {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const row = await get<{ total: number; okCount: number }>(
      "SELECT COUNT(*) as total, SUM(ok) as okCount FROM checks WHERE site_id = ? AND ts >= ?",
      [siteId, cutoff]
    );
    const total = row?.total || 0;
    const okCount = row?.okCount || 0;
    const percent = total ? Number(((okCount / total) * 100).toFixed(2)) : 0;
    return { total, okCount, percent };
  },
  async getDashboardData(siteIds: string[], days: number) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    // Batch fetch summaries
    const summaries = await all<{ site_id: string; total: number; okCount: number }>(
      `SELECT site_id, COUNT(*) as total, SUM(ok) as okCount
       FROM checks
       WHERE site_id IN (${siteIds.map(() => "?").join(",")}) AND ts >= ?
       GROUP BY site_id`,
      [...siteIds, cutoff]
    );

    // Batch fetch latest status
    const latests = await all<CheckEntry>(
      `SELECT c1.* FROM checks c1
       JOIN (SELECT site_id, MAX(ts) as max_ts FROM checks GROUP BY site_id) c2
       ON c1.site_id = c2.site_id AND c1.ts = c2.max_ts
       WHERE c1.site_id IN (${siteIds.map(() => "?").join(",")})`,
      [...siteIds]
    );

    // Fetch checks for timeline (last 50 checks per site for simplicity or filter by cutoff)
    const checks = await all<CheckEntry>(
      `SELECT site_id, ts, ok, error
       FROM checks
       WHERE site_id IN (${siteIds.map(() => "?").join(",")}) AND ts >= ?
       ORDER BY ts DESC`,
      [...siteIds, cutoff]
    );

    return { summaries, latests, checks };
  },

  // --- Retention ---
  async pruneChecks(beforeTs: number): Promise<number> {
    const res = await run("DELETE FROM checks WHERE ts < ?", [beforeTs]);
    return res?.changes ?? 0;
  },

  // --- Monitors ---
  async listMonitors(opts?: { enabledOnly?: boolean }): Promise<MonitorRow[]> {
    const where = opts?.enabledOnly ? "WHERE enabled = 1" : "";
    return all<MonitorRow>(
      `SELECT * FROM monitors ${where} ORDER BY sort_order, created_at`
    );
  },
  async getMonitor(id: string): Promise<MonitorRow | undefined> {
    return get<MonitorRow>("SELECT * FROM monitors WHERE id = ?", [id]);
  },
  async countMonitors(): Promise<number> {
    const row = await get<{ c: number }>("SELECT COUNT(*) as c FROM monitors");
    return row?.c ?? 0;
  },
  async insertMonitor(m: NewMonitor): Promise<MonitorRow> {
    const now = Date.now();
    await run(
      `INSERT INTO monitors
        (id, name, type, url, host, port, method, expected_status, keyword,
         interval_seconds, timeout_ms, enabled, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        m.id,
        m.name,
        m.type,
        m.url ?? null,
        m.host ?? null,
        m.port ?? null,
        m.method ?? "GET",
        m.expected_status ?? null,
        m.keyword ?? null,
        m.interval_seconds,
        m.timeout_ms,
        m.enabled ?? 1,
        m.sort_order ?? 0,
        now,
        now,
      ]
    );
    return (await this.getMonitor(m.id))!;
  },
  async updateMonitor(
    id: string,
    patch: Partial<Omit<MonitorRow, "id" | "created_at" | "updated_at">>
  ): Promise<MonitorRow | undefined> {
    const fields = Object.keys(patch);
    if (fields.length > 0) {
      const set = fields.map((f) => `${f} = ?`).join(", ");
      const values = fields.map((f) => (patch as any)[f]);
      await run(`UPDATE monitors SET ${set}, updated_at = ? WHERE id = ?`, [
        ...values,
        Date.now(),
        id,
      ]);
    }
    return this.getMonitor(id);
  },
  async deleteMonitor(id: string): Promise<void> {
    // Intentionally retains checks history so an accidental delete doesn't lose uptime data.
    await run("DELETE FROM monitors WHERE id = ?", [id]);
  },

  // --- Settings (key/value JSON) ---
  async getSetting<T>(key: string): Promise<T | undefined> {
    try {
      const row = await get<{ value: string }>(
        "SELECT value FROM settings WHERE key = ?",
        [key]
      );
      if (!row) return undefined;
      return JSON.parse(row.value) as T;
    } catch {
      // Table may not exist yet (e.g. at build time before initDb) — fall back to defaults.
      return undefined;
    }
  },
  async setSetting<T>(key: string, value: T): Promise<void> {
    await run(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, JSON.stringify(value), Date.now()]
    );
  },

  // --- Incidents & Maintenance ---
  async countIncidents(): Promise<number> {
    const row = await get<{ c: number }>("SELECT COUNT(*) as c FROM incidents");
    return row?.c ?? 0;
  },

  async listIncidents(opts?: {
    type?: IncidentType;
    status?: IncidentStatus;
    activeOnly?: boolean;
    limit?: number;
  }): Promise<IncidentWithUpdates[]> {
    const conditions: string[] = [];
    const params: any[] = [];

    if (opts?.type) {
      conditions.push("type = ?");
      params.push(opts.type);
    }
    if (opts?.status) {
      conditions.push("status = ?");
      params.push(opts.status);
    }
    if (opts?.activeOnly) {
      conditions.push("status NOT IN ('resolved', 'completed')");
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = opts?.limit ? `LIMIT ${Number(opts.limit)}` : "";

    const incidents = await all<IncidentRow>(
      `SELECT * FROM incidents ${where} ORDER BY created_at DESC ${limit}`,
      params
    );

    if (incidents.length === 0) return [];

    const ids = incidents.map((i) => i.id);
    const placeholders = ids.map(() => "?").join(",");
    const updates = await all<IncidentUpdateRow>(
      `SELECT * FROM incident_updates WHERE incident_id IN (${placeholders}) ORDER BY created_at DESC`,
      ids
    );

    const updateMap = new Map<string, IncidentUpdateRow[]>();
    for (const u of updates) {
      const arr = updateMap.get(u.incident_id) ?? [];
      arr.push(u);
      updateMap.set(u.incident_id, arr);
    }

    const parseMonitors = (raw: string | null | undefined): string[] => {
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };

    return incidents.map((inc) => ({
      ...inc,
      parsed_monitors: parseMonitors(inc.monitors),
      updates: updateMap.get(inc.id) ?? [],
    }));
  },

  async getIncident(id: string): Promise<IncidentWithUpdates | undefined> {
    const inc = await get<IncidentRow>("SELECT * FROM incidents WHERE id = ?", [id]);
    if (!inc) return undefined;

    const updates = await all<IncidentUpdateRow>(
      "SELECT * FROM incident_updates WHERE incident_id = ? ORDER BY created_at DESC",
      [id]
    );

    const parseMonitors = (raw: string | null | undefined): string[] => {
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };

    return {
      ...inc,
      parsed_monitors: parseMonitors(inc.monitors),
      updates,
    };
  },

  async insertIncident(data: NewIncident): Promise<IncidentWithUpdates> {
    const now = Date.now();
    const isResolvedOrCompleted = data.status === "resolved" || data.status === "completed";
    const monitorsJson = JSON.stringify(data.monitors ?? []);

    await run(
      `INSERT INTO incidents
        (id, title, type, status, impact, monitors, scheduled_start, scheduled_end, created_at, updated_at, resolved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.id,
        data.title,
        data.type ?? "incident",
        data.status,
        data.impact ?? "minor",
        monitorsJson,
        data.scheduled_start ?? null,
        data.scheduled_end ?? null,
        now,
        now,
        isResolvedOrCompleted ? now : null,
      ]
    );

    await run(
      `INSERT INTO incident_updates (incident_id, status, message, created_at)
       VALUES (?, ?, ?, ?)`,
      [data.id, data.status, data.message, now]
    );

    return (await this.getIncident(data.id))!;
  },

  async updateIncident(
    id: string,
    patch: Partial<Omit<IncidentRow, "id" | "created_at" | "updated_at">> & {
      monitorsArray?: string[];
    }
  ): Promise<IncidentWithUpdates | undefined> {
    const existing = await this.getIncident(id);
    if (!existing) return undefined;

    const now = Date.now();
    const fieldsToSet: string[] = ["updated_at = ?"];
    const values: any[] = [now];

    if (patch.title !== undefined) {
      fieldsToSet.push("title = ?");
      values.push(patch.title);
    }
    if (patch.type !== undefined) {
      fieldsToSet.push("type = ?");
      values.push(patch.type);
    }
    if (patch.impact !== undefined) {
      fieldsToSet.push("impact = ?");
      values.push(patch.impact);
    }
    if (patch.monitorsArray !== undefined) {
      fieldsToSet.push("monitors = ?");
      values.push(JSON.stringify(patch.monitorsArray));
    } else if (patch.monitors !== undefined) {
      fieldsToSet.push("monitors = ?");
      values.push(patch.monitors);
    }
    if (patch.scheduled_start !== undefined) {
      fieldsToSet.push("scheduled_start = ?");
      values.push(patch.scheduled_start);
    }
    if (patch.scheduled_end !== undefined) {
      fieldsToSet.push("scheduled_end = ?");
      values.push(patch.scheduled_end);
    }
    if (patch.status !== undefined) {
      fieldsToSet.push("status = ?");
      values.push(patch.status);

      const isResolved = patch.status === "resolved" || patch.status === "completed";
      fieldsToSet.push("resolved_at = ?");
      values.push(isResolved ? (existing.resolved_at ?? now) : null);
    }

    values.push(id);
    await run(`UPDATE incidents SET ${fieldsToSet.join(", ")} WHERE id = ?`, values);

    return this.getIncident(id);
  },

  async addIncidentUpdate(
    incidentId: string,
    update: { status: IncidentStatus; message: string }
  ): Promise<IncidentWithUpdates | undefined> {
    const now = Date.now();
    await run(
      `INSERT INTO incident_updates (incident_id, status, message, created_at)
       VALUES (?, ?, ?, ?)`,
      [incidentId, update.status, update.message, now]
    );

    const isResolved = update.status === "resolved" || update.status === "completed";
    await run(
      `UPDATE incidents SET status = ?, updated_at = ?, resolved_at = ? WHERE id = ?`,
      [update.status, now, isResolved ? now : null, incidentId]
    );

    return this.getIncident(incidentId);
  },

  async deleteIncident(id: string): Promise<void> {
    await run("DELETE FROM incident_updates WHERE incident_id = ?", [id]);
    await run("DELETE FROM incidents WHERE id = ?", [id]);
  },
};
