import { dbOps } from "./db";
import { sites } from "./config";
import {
  DEFAULT_BRANDING,
  DEFAULT_RETENTION,
  notificationDefaultsFromEnv,
} from "./settings";

/**
 * First-run seeding. Only writes when the target is empty so re-deploys/restarts never
 * overwrite admin edits. lib/config.ts remains the source of truth for the initial monitors.
 */
export async function seedMonitorsIfEmpty(): Promise<void> {
  if ((await dbOps.countMonitors()) > 0) return;

  for (let i = 0; i < sites.length; i += 1) {
    const site = sites[i];
    await dbOps.insertMonitor({
      id: site.id, // preserve exact slug so existing checks history stays linked
      name: site.name,
      type: "http",
      url: site.url,
      method: "GET",
      interval_seconds: site.intervalSeconds,
      timeout_ms: site.timeoutMs,
      enabled: 1,
      sort_order: i,
    });
  }
  console.log(`Seeded ${sites.length} monitors from config`);
}

export async function seedSettingsDefaults(): Promise<void> {
  if (!(await dbOps.getSetting("branding"))) {
    await dbOps.setSetting("branding", DEFAULT_BRANDING);
  }
  if (!(await dbOps.getSetting("retention"))) {
    await dbOps.setSetting("retention", DEFAULT_RETENTION);
  }
  if (!(await dbOps.getSetting("notifications"))) {
    // Snapshot current env config so the admin UI shows what's active today.
    await dbOps.setSetting("notifications", notificationDefaultsFromEnv());
  }
}

export async function seedIncidentsIfEmpty(): Promise<void> {
  if ((await dbOps.countIncidents()) > 0) return;

  const inc = await dbOps.insertIncident({
    id: "inc-api-latency-resolution",
    title: "Elevated API Latency and Intermittent Gateway Timeouts",
    type: "incident",
    status: "investigating",
    impact: "minor",
    monitors: ["all"],
    message: "We observed elevated response times across external gateways and began investigation.",
  });

  await dbOps.addIncidentUpdate(inc.id, {
    status: "identified",
    message: "The issue was identified as a network routing congestion with upstream DNS providers. Traffic rerouting initiated.",
  });

  await dbOps.addIncidentUpdate(inc.id, {
    status: "monitoring",
    message: "Traffic rerouted successfully. Response latencies have normalized across all regions. We are monitoring.",
  });

  await dbOps.addIncidentUpdate(inc.id, {
    status: "resolved",
    message: "All services are operating normally. Incident has been resolved.",
  });

  console.log("Seeded initial sample resolved incident");
}
