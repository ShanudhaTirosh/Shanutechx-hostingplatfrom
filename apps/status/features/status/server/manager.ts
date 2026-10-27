import { dbOps, MonitorRow } from "@/lib/db";
import { getRetention } from "@/lib/settings";
import { pingMonitor } from "./monitor";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

interface MonitorManager {
  start(): Promise<void>;
  reloadFromDb(): Promise<void>;
  addOrUpdate(monitor: MonitorRow): void;
  remove(id: string): void;
  rescheduleRetention(): void;
}

function createManager(): MonitorManager {
  const handles = new Map<string, NodeJS.Timeout>();
  let retentionHandle: NodeJS.Timeout | null = null;
  let started = false;

  function remove(id: string) {
    const handle = handles.get(id);
    if (handle) {
      clearInterval(handle);
      handles.delete(id);
    }
  }

  function addOrUpdate(monitor: MonitorRow, initialDelayMs = 0) {
    // Disabled monitors must not run.
    if (!monitor.enabled) {
      remove(monitor.id);
      return;
    }

    remove(monitor.id);

    // Stagger checks to prevent thundering herd and DNS queue starvation
    const initTimer = setTimeout(() => {
      pingMonitor(monitor).catch((err) =>
        console.error(`Initial ping failed for ${monitor.id}`, err)
      );

      const handle = setInterval(() => {
        pingMonitor(monitor).catch((err) =>
          console.error(`Ping failed for ${monitor.id}`, err)
        );
      }, Math.max(10, monitor.interval_seconds) * 1000);

      handles.set(monitor.id, handle);
    }, initialDelayMs);

    handles.set(monitor.id, initTimer);
  }

  async function reloadFromDb() {
    const monitors = await dbOps.listMonitors({ enabledOnly: true });
    const wanted = new Set(monitors.map((m) => m.id));

    // Remove handles for monitors that disappeared or were disabled.
    for (const id of handles.keys()) {
      if (!wanted.has(id)) remove(id);
    }
    // Add/refresh the rest staggered over time
    let stagger = 0;
    for (const m of monitors) {
      addOrUpdate(m, stagger);
      stagger += 1500;
    }
  }

  async function pruneNow() {
    try {
      const { days } = await getRetention();
      const removed = await dbOps.pruneChecks(Date.now() - days * ONE_DAY_MS);
      if (removed > 0) console.log(`Retention: pruned ${removed} old checks`);
    } catch (err) {
      console.error("Retention prune failed", err);
    }
  }

  function rescheduleRetention() {
    if (retentionHandle) clearInterval(retentionHandle);
    pruneNow();
    retentionHandle = setInterval(pruneNow, ONE_DAY_MS);
  }

  async function start() {
    if (started) return;
    started = true;
    await reloadFromDb();
    rescheduleRetention();
    console.log(`Monitor manager started (${handles.size} active monitors)`);
  }

  return { start, reloadFromDb, addOrUpdate, remove, rescheduleRetention };
}

// Module-level singleton stashed on globalThis so it survives dev HMR and is shared
// across all route handlers running in the single Node server process.
const g = globalThis as unknown as { __spMonitorManager?: MonitorManager };
export const monitorManager: MonitorManager =
  g.__spMonitorManager ?? (g.__spMonitorManager = createManager());
