import type { WebhookInfo } from '@shanutechx/types';
import type { ShanuTechXClient } from '@shanutechx/client';

export class WebhookHelper {
  static async getInfo(
    client: ShanuTechXClient,
    deploymentId: string,
  ): Promise<WebhookInfo> {
    return client.deployments.getWebhookInfo(deploymentId);
  }
}
