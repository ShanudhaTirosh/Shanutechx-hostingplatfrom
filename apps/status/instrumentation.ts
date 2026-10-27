export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (!process.env.UV_THREADPOOL_SIZE) {
      process.env.UV_THREADPOOL_SIZE = "64";
    }

    try {
      const dns = await import("dns");
      if (typeof dns.setDefaultResultOrder === "function") {
        dns.setDefaultResultOrder("ipv4first");
      }
    } catch {}

    const { initDb } = await import("@/lib/db");
    const { seedMonitorsIfEmpty, seedSettingsDefaults, seedIncidentsIfEmpty } = await import("@/lib/seed");
    const { monitorManager } = await import("@/features/status/server/manager");

    try {
      await initDb();
      console.log("Database initialized from instrumentation");
      await seedMonitorsIfEmpty();
      await seedSettingsDefaults();
      await seedIncidentsIfEmpty();
      await monitorManager.start();
      console.log("Monitoring service started from instrumentation");
    } catch (error) {
      console.error("Failed to initialize monitoring in instrumentation:", error);
    }
  }
}
