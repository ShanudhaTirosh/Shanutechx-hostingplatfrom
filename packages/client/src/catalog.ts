import type { CatalogTemplate, CatalogDeployInput, Deployment } from '@shanutechx/types';
import { BaseClient } from './base.js';

export class CatalogResource extends BaseClient {
  async list(): Promise<CatalogTemplate[]> {
    const res = await this.httpGet<{ templates: CatalogTemplate[] }>('/api/catalog');
    return res.templates;
  }

  async get(slug: string): Promise<CatalogTemplate> {
    const res = await this.httpGet<{ template: CatalogTemplate }>(`/api/catalog/${slug}`);
    return res.template;
  }

  async deploy(input: CatalogDeployInput): Promise<Deployment> {
    return this.httpPost<Deployment>('/api/catalog/deploy', input);
  }
}
