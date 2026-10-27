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
    const payload = {
      slug: (input as any).slug ?? input.templateSlug,
      nodeId: input.nodeId,
      envVars: input.envVars,
      projectName: input.projectName ?? input.subdomain ?? input.preferredName,
      subdomain: input.subdomain,
      preferredName: input.preferredName ?? input.projectName,
      cpuLimit: input.cpuLimit,
      memoryLimit: input.memoryLimit,
      storageLimit: input.storageLimit,
      exposureMode: input.exposureMode,
      orderItemId: input.orderItemId,
      builder: input.builder,
    };
    const res = await this.httpPost<{ ok: boolean; deployment?: Deployment } | Deployment>(
      '/api/catalog/deploy',
      payload,
    );
    if ('deployment' in res && res.deployment) {
      return res.deployment;
    }
    return res as Deployment;
  }

  async listCategories(): Promise<string[]> {
    const templates = await this.list();
    return Array.from(new Set(templates.map((t) => t.category).filter(Boolean)));
  }

  async getByCategory(category: string): Promise<CatalogTemplate[]> {
    const templates = await this.list();
    return templates.filter((t) => t.category.toLowerCase() === category.toLowerCase());
  }

  async search(query: string): Promise<CatalogTemplate[]> {
    const q = query.toLowerCase().trim();
    if (!q) return this.list();
    const templates = await this.list();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.tags?.some((tag) => tag.toLowerCase().includes(q))
    );
  }
}
