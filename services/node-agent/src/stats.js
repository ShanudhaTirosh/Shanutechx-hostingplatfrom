const si = require('systeminformation');

/** Snapshot of this node's current resource usage. */
async function collectStats() {
  const [cpu, mem, fsSize] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsSize(),
  ]);

  const rootDisk = fsSize.find((d) => d.mount === '/') || fsSize[0];

  return {
    cpuUsedPct: Math.round(cpu.currentLoad * 100) / 100,
    ramUsedMb: Math.round(mem.active / (1024 * 1024)),
    diskUsedGb: rootDisk ? Math.round(rootDisk.used / (1024 * 1024 * 1024)) : 0,
  };
}

module.exports = { collectStats };
