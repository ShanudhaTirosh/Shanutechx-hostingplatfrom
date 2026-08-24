import type { ShanuTechXClient } from '@shanutechx/client';

export type LogCallback = (line: string) => void;

/**
 * Utility for watching container logs continuously.
 */
export class LogWatcher {
  private timer: ReturnType<typeof setInterval> | null = null;
  private seenLogs = new Set<string>();
  private seenQueue: string[] = [];
  private readonly maxCapacity: number;

  constructor(
    private readonly client: ShanuTechXClient,
    private readonly deploymentId: string,
    private readonly options: { pollIntervalMs?: number; maxLines?: number; maxHistory?: number } = {},
  ) {
    this.maxCapacity = options.maxHistory ?? 1000;
  }

  private trackLine(line: string): boolean {
    if (this.seenLogs.has(line)) {
      return false;
    }
    this.seenLogs.add(line);
    this.seenQueue.push(line);
    if (this.seenQueue.length > this.maxCapacity) {
      const oldest = this.seenQueue.shift();
      if (oldest !== undefined) {
        this.seenLogs.delete(oldest);
      }
    }
    return true;
  }

  /**
   * Start polling logs and invoking the listener for new log lines.
   */
  start(onLog: LogCallback): void {
    const interval = this.options.pollIntervalMs ?? 3000;
    const maxLines = this.options.maxLines ?? 100;

    const fetchLogs = async () => {
      try {
        const logs = await this.client.deployments.getLogs(this.deploymentId, maxLines);
        for (const line of logs) {
          if (this.trackLine(line)) {
            onLog(line);
          }
        }
      } catch (err) {
        // Silently retry on next poll cycle
      }
    };

    fetchLogs();
    this.timer = setInterval(fetchLogs, interval);
  }

  /** Stop watching logs */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
