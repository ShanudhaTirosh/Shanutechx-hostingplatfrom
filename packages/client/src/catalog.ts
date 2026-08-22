import type { CatalogTemplate, CatalogDeployInput, Deployment } from '@shanutechx/types';
import { BaseClient } from './base.js';

export class CatalogResource extends BaseClient {
  async list(): Promise<CatalogTemplate[]> {
    const res = await this.httpGet<{ templates: CatalogTemplate[] }>('/api/catalog');
    return res.templates;
  }

  async get(slug: string): Promise<CatalogTemplate> {
    return this.httpGet<CatalogTemplate>(`/api/catalog/${slug}`);
  }

  async deploy(input: CatalogDeployInput): Promise<Deployment> {
    return this.httpPost<Deployment>('/api/catalog/deploy', input);
  }
}
