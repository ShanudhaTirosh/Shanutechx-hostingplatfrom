import type { CatalogTemplate, CatalogDeployInput, Deployment, TemplateCategory } from '@shanutechx/types';
import type { ShanuTechXClient } from '@shanutechx/client';

export class CatalogHelper {
  constructor(private readonly client: ShanuTechXClient) {}

  /** List all catalog templates */
  async listTemplates(): Promise<CatalogTemplate[]> {
    return this.client.catalog.list();
  }

  /** Filter templates by category */
  async listByCategory(category: TemplateCategory): Promise<CatalogTemplate[]> {
    const templates = await this.listTemplates();
    return templates.filter((t) => t.category === category);
  }

  /** Get a template by slug */
  async getTemplate(slug: string): Promise<CatalogTemplate> {
    return this.client.catalog.get(slug);
  }

  /** Validate environment variables against template schema */
  static validateEnv(
    template: CatalogTemplate,
    envVars: Record<string, string> = {},
  ): { valid: boolean; missingKeys: string[] } {
    const vars = envVars ?? {};
    const missingKeys: string[] = [];
    for (const schema of template.envSchema) {
      const val = vars[schema.key];
      if (schema.required && (!val || !val.trim())) {
        missingKeys.push(schema.key);
      }
    }
    return {
      valid: missingKeys.length === 0,
      missingKeys,
    };
  }

  /** Deploy a template with env validation */
  async deployTemplate(input: CatalogDeployInput): Promise<Deployment> {
    const slug = input.templateSlug || input.slug;
    if (!slug) {
      throw new Error("Cannot deploy template: 'templateSlug' or 'slug' is required");
    }

    const template = await this.getTemplate(slug);
    const envVars = input.envVars ?? {};
    const { valid, missingKeys } = CatalogHelper.validateEnv(template, envVars);

    if (!valid) {
      throw new Error(
        `Cannot deploy template '${slug}': Missing required environment variables: ${missingKeys.join(', ')}`,
      );
    }

    return this.client.catalog.deploy(input);
  }
}
