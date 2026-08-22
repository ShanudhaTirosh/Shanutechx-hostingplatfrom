import { describe, it, expect, beforeEach } from 'vitest';
import { getCatalog, invalidateCache, getTemplateBySlug } from './catalog-manager';

/**
 * Integration tests for catalog-manager
 * These tests use the actual filesystem and real templates
 */
describe('Catalog Manager Integration Tests', () => {
  beforeEach(() => {
    // Clear cache before each test to ensure fresh reads
    invalidateCache();
  });

  describe('getCatalog', () => {
    it('should load real templates from filesystem', async () => {
      const catalog = await getCatalog();

      // Should have loaded templates
      expect(catalog.length).toBeGreaterThan(0);
      
      // Each template should have required fields
      for (const template of catalog) {
        expect(template).toHaveProperty('slug');
        expect(template).toHaveProperty('filename');
        expect(template).toHaveProperty('name');
        expect(template).toHaveProperty('category');
        expect(template.slug).toBeTruthy();
        expect(template.filename).toBeTruthy();
      }
    });

    it('should cache templates and return same data on subsequent calls', async () => {
      const firstCall = await getCatalog();
      const secondCall = await getCatalog();

      expect(secondCall).toEqual(firstCall);
      expect(secondCall.length).toBe(firstCall.length);
    });

    it('should reload templates after cache invalidation', async () => {
      const firstCall = await getCatalog();
      
      // Invalidate cache
      invalidateCache();
      
      const secondCall = await getCatalog();
      
      // Should still have same templates (but freshly loaded)
      expect(secondCall.length).toBe(firstCall.length);
    });

    it('should extract metadata correctly from real templates', async () => {
      const catalog = await getCatalog();
      
      // Find a specific template we know exists (n8n)
      const n8nTemplate = catalog.find(t => t.slug === 'n8n');
      
      if (n8nTemplate) {
        expect(n8nTemplate.name).toBeTruthy();
        expect(n8nTemplate.category).toBeTruthy();
        expect(n8nTemplate.filename).toMatch(/\.ya?ml$/);
      }
    });
  });

  describe('getTemplateBySlug', () => {
    it('should return full template details with yaml content', async () => {
      // Try to get n8n template
      const template = await getTemplateBySlug('n8n');
      
      if (template) {
        expect(template.slug).toBe('n8n');
        expect(template.yaml).toBeTruthy();
        expect(template.yaml).toContain('services:');
        expect(template.name).toBeTruthy();
      }
    });

    it('should return null for non-existent template', async () => {
      const template = await getTemplateBySlug('this-template-does-not-exist');
      expect(template).toBeNull();
    });

    it('should work with both .yaml and .yml extensions', async () => {
      const catalog = await getCatalog();
      
      // Find templates with different extensions
      const yamlTemplate = catalog.find(t => t.filename.endsWith('.yaml'));
      const ymlTemplate = catalog.find(t => t.filename.endsWith('.yml'));
      
      if (yamlTemplate) {
        const details = await getTemplateBySlug(yamlTemplate.slug);
        expect(details).not.toBeNull();
        expect(details?.slug).toBe(yamlTemplate.slug);
      }
      
      if (ymlTemplate) {
        const details = await getTemplateBySlug(ymlTemplate.slug);
        expect(details).not.toBeNull();
        expect(details?.slug).toBe(ymlTemplate.slug);
      }
    });
  });

  describe('Cache TTL behavior', () => {
    it('should respect 5-minute cache TTL', async () => {
      // First call populates cache
      const firstResult = await getCatalog();
      expect(firstResult.length).toBeGreaterThan(0);
      
      // Second call within TTL should use cache
      const secondResult = await getCatalog();
      expect(secondResult).toEqual(firstResult);
      
      // Note: We cannot easily test cache expiration without mocking time or waiting 5 minutes
      // This test just verifies the cache works within the TTL period
    });
  });
});
