import type { ShanuTechXClient } from '@shanutechx/client';

export type LogCallback = (line: string) => void;

/**
 * Utility for watching container logs continuously.
 */
export class LogWatcher {
  private timer: ReturnType<typeof setInterval> | null = null;
  private seenLogs = new Set<string>();

  constructor(
    private readonly client: ShanuTechXClient,
    private readonly deploymentId: string,
    private readonly options: { pollIntervalMs?: number; maxLines?: number } = {},
  ) {}

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
          if (!this.seenLogs.has(line)) {
            this.seenLogs.add(line);
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
