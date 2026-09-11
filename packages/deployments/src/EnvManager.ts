import type { ShanuTechXClient } from '@shanutechx/client';

/**
 * Environment variables manager for a deployment.
 */
export class EnvManager {
  constructor(
    private readonly client: ShanuTechXClient,
    private readonly deploymentId: string,
  ) {}

  /** Load current decrypted env vars */
  async load(): Promise<Record<string, string>> {
    return this.client.deployments.getEnvVars(this.deploymentId);
  }

  /** Update/merge environment variables */
  async set(newVars: Record<string, string>): Promise<Record<string, string>> {
    await (this.client.deployments as any).updateEnvVars(this.deploymentId, newVars, 'merge');
    return this.load();
  }

  /** Delete specific keys */
  async unset(keys: string[]): Promise<Record<string, string>> {
    const current = await this.load();
    for (const key of keys) {
      delete current[key];
    }
    await (this.client.deployments as any).updateEnvVars(this.deploymentId, current, 'replace');
    return current;
  }

  /**
   * Parse key-value lines from a .env string into an object.
   */
  static parseEnvString(envContent: string): Record<string, string> {
    const result: Record<string, string> = {};
    const lines = envContent.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      result[key] = val;
    }
    return result;
  }

  /**
   * Format an env record as a .env file string.
   */
  static formatEnvString(envRecord: Record<string, string>): string {
    return Object.entries(envRecord)
      .map(([k, v]) => `${k}=${v.includes(' ') ? `"${v}"` : v}`)
      .join('\n');
  }
}
