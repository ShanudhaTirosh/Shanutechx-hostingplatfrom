import fs from 'fs';
import path from 'path';
import { parseTemplateYaml, validateTemplateStructure, TemplateMeta } from './template-parser';

/**
 * In-memory cache structure with TTL
 */
interface CatalogCache {
  data: TemplateMeta[];
  expiresAt: number; // Unix timestamp in milliseconds
}

/**
 * Cache TTL: 5 minutes in milliseconds
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Templates folder path relative to the API directory
 * The templates folder is at the workspace root (../../../../../templates from apps/api/dist/lib/catalog)
 */
const TEMPLATES_PATH = path.resolve(__dirname, '../../../../../templates');

/**
 * In-memory catalog cache
 */
let catalogCache: CatalogCache | null = null;

/**
 * Get the catalog of all available templates
 * Returns cached data if available and not expired, otherwise rebuilds from filesystem
 * 
 * @returns Array of template metadata
 */
export async function getCatalog(): Promise<TemplateMeta[]> {
  // Check if cache is valid
  if (catalogCache && Date.now() < catalogCache.expiresAt) {
    return catalogCache.data;
  }

  // Rebuild cache from filesystem
  const templates = await buildCatalogFromFilesystem();
  
  // Update cache with new data and expiration time
  catalogCache = {
    data: templates,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };

  return templates;
}

/**
 * Invalidate the catalog cache
 * Forces the next getCatalog() call to rebuild from filesystem
 */
export function invalidateCache(): void {
  catalogCache = null;
}

/**
 * Build catalog by scanning templates folder and parsing all YAML files
 * Handles YAML parsing errors gracefully by logging and skipping invalid templates
 * 
 * @returns Array of template metadata
 */
async function buildCatalogFromFilesystem(): Promise<TemplateMeta[]> {
  const templates: TemplateMeta[] = [];

  try {
    // Read templates directory
    const files = fs.readdirSync(TEMPLATES_PATH);

    // Filter for YAML files (.yaml or .yml extensions)
    const yamlFiles = files.filter(
      (file) => file.endsWith('.yaml') || file.endsWith('.yml')
    );

    // Parse each YAML file
    for (const filename of yamlFiles) {
      try {
        const filePath = path.join(TEMPLATES_PATH, filename);
        
        // Parse template YAML
        const templateDetails = parseTemplateYaml(filePath);

        // Validate template structure
        const validation = validateTemplateStructure(templateDetails);
        
        if (!validation.valid) {
          console.warn(
            `Template validation failed for ${filename}:`,
            validation.errors.join(', ')
          );
          // Skip invalid templates but log the issues
          continue;
        }

        // Extract metadata (without services and yaml content)
        const templateMeta: TemplateMeta = {
          slug: templateDetails.slug,
          filename: templateDetails.filename,
          name: templateDetails.name,
          slogan: templateDetails.slogan,
          documentation: templateDetails.documentation,
          category: templateDetails.category,
          tags: templateDetails.tags,
          logo: templateDetails.logo,
          port: templateDetails.port,
        };

        templates.push(templateMeta);
      } catch (error) {
        // Log parsing error and skip this template
        console.error(
          `Failed to parse template ${filename}:`,
          error instanceof Error ? error.message : String(error)
        );
        // Continue to next template
        continue;
      }
    }

    console.log(
      `Catalog rebuilt: ${templates.length} valid templates loaded from filesystem`
    );

    return templates;
  } catch (error) {
    console.error(
      'Failed to read templates directory:',
      error instanceof Error ? error.message : String(error)
    );
    // Return empty array if templates directory cannot be read
    return [];
  }
}

/**
 * Get a single template by slug with full details
 * This bypasses the cache and reads directly from filesystem
 * 
 * @param slug - Template slug (filename without extension)
 * @returns Template details or null if not found
 */
export async function getTemplateBySlug(slug: string): Promise<{
  slug: string;
  filename: string;
  name: string;
  slogan: string;
  documentation: string;
  category: string;
  tags: string[];
  logo: string;
  port: number | null;
  yaml: string;
} | null> {
  try {
    // Try both .yaml and .yml extensions
    const possiblePaths = [
      path.join(TEMPLATES_PATH, `${slug}.yaml`),
      path.join(TEMPLATES_PATH, `${slug}.yml`),
    ];

    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath)) {
        const templateDetails = parseTemplateYaml(filePath);
        
        // Return metadata with yaml content
        return {
          slug: templateDetails.slug,
          filename: templateDetails.filename,
          name: templateDetails.name,
          slogan: templateDetails.slogan,
          documentation: templateDetails.documentation,
          category: templateDetails.category,
          tags: templateDetails.tags,
          logo: templateDetails.logo,
          port: templateDetails.port,
          yaml: templateDetails.yaml,
        };
      }
    }

    return null;
  } catch (error) {
    console.error(
      `Failed to get template by slug ${slug}:`,
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}
