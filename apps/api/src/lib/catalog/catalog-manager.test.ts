import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { getCatalog, invalidateCache, getTemplateBySlug } from './catalog-manager';
import * as templateParser from './template-parser';

// Mock the modules
vi.mock('fs');
vi.mock('./template-parser');

describe('Catalog Manager', () => {
  const mockTemplatesPath = path.resolve(__dirname, '../../../../../templates');

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    invalidateCache(); // Clear cache before each test
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getCatalog', () => {
    it('should build catalog from filesystem on first call', async () => {
      // Mock filesystem
      const mockFiles = ['app1.yaml', 'app2.yml', 'readme.txt'];
      vi.mocked(fs.readdirSync).mockReturnValue(mockFiles as any);

      // Mock template parsing
      const mockTemplate1 = {
        slug: 'app1',
        filename: 'app1.yaml',
        name: 'App 1',
        slogan: 'First app',
        documentation: 'https://app1.com',
        category: 'backend',
        tags: ['tag1'],
        logo: 'logo1.png',
        port: 3000,
        services: [{ name: 'service1', image: 'image1:latest', environmentVariables: [], volumes: [] }],
        yaml: '# test yaml',
      };

      const mockTemplate2 = {
        slug: 'app2',
        filename: 'app2.yml',
        name: 'App 2',
        slogan: 'Second app',
        documentation: 'https://app2.com',
        category: 'frontend',
        tags: ['tag2'],
        logo: 'logo2.png',
        port: 8080,
        services: [{ name: 'service2', image: 'image2:latest', environmentVariables: [], volumes: [] }],
        yaml: '# test yaml 2',
      };

      vi.mocked(templateParser.parseTemplateYaml)
        .mockReturnValueOnce(mockTemplate1)
        .mockReturnValueOnce(mockTemplate2);

      vi.mocked(templateParser.validateTemplateStructure)
        .mockReturnValue({ valid: true, errors: [] });

      // Call getCatalog
      const result = await getCatalog();

      // Assertions
      expect(fs.readdirSync).toHaveBeenCalledWith(mockTemplatesPath);
      expect(templateParser.parseTemplateYaml).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
      expect(result[0].slug).toBe('app1');
      expect(result[1].slug).toBe('app2');
    });

    it('should return cached data on subsequent calls within TTL', async () => {
      // Mock filesystem
      const mockFiles = ['app1.yaml'];
      vi.mocked(fs.readdirSync).mockReturnValue(mockFiles as any);

      // Mock template parsing
      const mockTemplate = {
        slug: 'app1',
        filename: 'app1.yaml',
        name: 'App 1',
        slogan: 'First app',
        documentation: 'https://app1.com',
        category: 'backend',
        tags: ['tag1'],
        logo: 'logo1.png',
        port: 3000,
        services: [{ name: 'service1', image: 'image1:latest', environmentVariables: [], volumes: [] }],
        yaml: '# test yaml',
      };

      vi.mocked(templateParser.parseTemplateYaml).mockReturnValue(mockTemplate);
      vi.mocked(templateParser.validateTemplateStructure).mockReturnValue({ valid: true, errors: [] });

      // First call
      const result1 = await getCatalog();
      expect(fs.readdirSync).toHaveBeenCalledTimes(1);

      // Second call (should use cache)
      const result2 = await getCatalog();
      expect(fs.readdirSync).toHaveBeenCalledTimes(1); // Still 1, not called again
      expect(result2).toEqual(result1);
    });

    it('should skip invalid templates and log warnings', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Mock filesystem
      const mockFiles = ['valid.yaml', 'invalid.yaml'];
      vi.mocked(fs.readdirSync).mockReturnValue(mockFiles as any);

      // Mock template parsing
      const validTemplate = {
        slug: 'valid',
        filename: 'valid.yaml',
        name: 'Valid App',
        slogan: 'Valid',
        documentation: 'https://valid.com',
        category: 'backend',
        tags: [],
        logo: '',
        port: null,
        services: [{ name: 'service', image: 'image:latest', environmentVariables: [], volumes: [] }],
        yaml: '# valid',
      };

      const invalidTemplate = {
        slug: 'invalid',
        filename: 'invalid.yaml',
        name: 'Invalid App',
        slogan: 'Invalid',
        documentation: '',
        category: 'backend',
        tags: [],
        logo: '',
        port: null,
        services: [], // Empty services - invalid
        yaml: '# invalid',
      };

      vi.mocked(templateParser.parseTemplateYaml)
        .mockReturnValueOnce(validTemplate)
        .mockReturnValueOnce(invalidTemplate);

      vi.mocked(templateParser.validateTemplateStructure)
        .mockReturnValueOnce({ valid: true, errors: [] })
        .mockReturnValueOnce({ valid: false, errors: ['No services defined'] });

      // Call getCatalog
      const result = await getCatalog();

      // Should only include valid template
      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('valid');
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('should handle YAML parsing errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Mock filesystem
      const mockFiles = ['good.yaml', 'bad.yaml'];
      vi.mocked(fs.readdirSync).mockReturnValue(mockFiles as any);

      // Mock template parsing
      const goodTemplate = {
        slug: 'good',
        filename: 'good.yaml',
        name: 'Good App',
        slogan: 'Good',
        documentation: 'https://good.com',
        category: 'backend',
        tags: [],
        logo: '',
        port: null,
        services: [{ name: 'service', image: 'image:latest', environmentVariables: [], volumes: [] }],
        yaml: '# good',
      };

      vi.mocked(templateParser.parseTemplateYaml)
        .mockReturnValueOnce(goodTemplate)
        .mockImplementationOnce(() => {
          throw new Error('YAML syntax error');
        });

      vi.mocked(templateParser.validateTemplateStructure)
        .mockReturnValue({ valid: true, errors: [] });

      // Call getCatalog
      const result = await getCatalog();

      // Should only include successfully parsed template
      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('good');
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should return empty array if templates directory cannot be read', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Mock filesystem error
      vi.mocked(fs.readdirSync).mockImplementation(() => {
        throw new Error('Directory not found');
      });

      // Call getCatalog
      const result = await getCatalog();

      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should filter only YAML files (yaml and yml extensions)', async () => {
      // Mock filesystem with various file types
      const mockFiles = [
        'app1.yaml',
        'app2.yml',
        'readme.md',
        'config.json',
        'script.sh',
        'image.png',
      ];
      vi.mocked(fs.readdirSync).mockReturnValue(mockFiles as any);

      // Mock template parsing
      const mockTemplate = {
        slug: 'app',
        filename: 'app.yaml',
        name: 'App',
        slogan: 'Test',
        documentation: 'https://test.com',
        category: 'backend',
        tags: [],
        logo: '',
        port: null,
        services: [{ name: 'service', image: 'image:latest', environmentVariables: [], volumes: [] }],
        yaml: '# test',
      };

      vi.mocked(templateParser.parseTemplateYaml).mockReturnValue(mockTemplate);
      vi.mocked(templateParser.validateTemplateStructure).mockReturnValue({ valid: true, errors: [] });

      // Call getCatalog
      await getCatalog();

      // Should only parse YAML files
      expect(templateParser.parseTemplateYaml).toHaveBeenCalledTimes(2);
    });
  });

  describe('invalidateCache', () => {
    it('should force cache rebuild after invalidation', async () => {
      // Mock filesystem
      const mockFiles = ['app.yaml'];
      vi.mocked(fs.readdirSync).mockReturnValue(mockFiles as any);

      // Mock template parsing
      const mockTemplate = {
        slug: 'app',
        filename: 'app.yaml',
        name: 'App',
        slogan: 'Test',
        documentation: 'https://test.com',
        category: 'backend',
        tags: [],
        logo: '',
        port: null,
        services: [{ name: 'service', image: 'image:latest', environmentVariables: [], volumes: [] }],
        yaml: '# test',
      };

      vi.mocked(templateParser.parseTemplateYaml).mockReturnValue(mockTemplate);
      vi.mocked(templateParser.validateTemplateStructure).mockReturnValue({ valid: true, errors: [] });

      // First call
      await getCatalog();
      expect(fs.readdirSync).toHaveBeenCalledTimes(1);

      // Invalidate cache
      invalidateCache();

      // Second call should rebuild
      await getCatalog();
      expect(fs.readdirSync).toHaveBeenCalledTimes(2);
    });
  });

  describe('getTemplateBySlug', () => {
    it('should return template details with yaml content for existing template', async () => {
      const slug = 'myapp';
      const expectedPath = path.join(mockTemplatesPath, `${slug}.yaml`);

      vi.mocked(fs.existsSync).mockReturnValue(true);

      const mockTemplate = {
        slug: 'myapp',
        filename: 'myapp.yaml',
        name: 'My App',
        slogan: 'Great app',
        documentation: 'https://myapp.com',
        category: 'backend',
        tags: ['tag1'],
        logo: 'logo.png',
        port: 3000,
        services: [{ name: 'service', image: 'image:latest', environmentVariables: [], volumes: [] }],
        yaml: '# my app yaml content',
      };

      vi.mocked(templateParser.parseTemplateYaml).mockReturnValue(mockTemplate);

      const result = await getTemplateBySlug(slug);

      expect(fs.existsSync).toHaveBeenCalledWith(expectedPath);
      expect(result).not.toBeNull();
      expect(result?.slug).toBe('myapp');
      expect(result?.yaml).toBe('# my app yaml content');
    });

    it('should try both .yaml and .yml extensions', async () => {
      const slug = 'myapp';
      const yamlPath = path.join(mockTemplatesPath, `${slug}.yaml`);
      const ymlPath = path.join(mockTemplatesPath, `${slug}.yml`);

      vi.mocked(fs.existsSync)
        .mockReturnValueOnce(false) // .yaml doesn't exist
        .mockReturnValueOnce(true); // .yml exists

      const mockTemplate = {
        slug: 'myapp',
        filename: 'myapp.yml',
        name: 'My App',
        slogan: 'Great app',
        documentation: 'https://myapp.com',
        category: 'backend',
        tags: [],
        logo: '',
        port: null,
        services: [{ name: 'service', image: 'image:latest', environmentVariables: [], volumes: [] }],
        yaml: '# content',
      };

      vi.mocked(templateParser.parseTemplateYaml).mockReturnValue(mockTemplate);

      const result = await getTemplateBySlug(slug);

      expect(fs.existsSync).toHaveBeenCalledWith(yamlPath);
      expect(fs.existsSync).toHaveBeenCalledWith(ymlPath);
      expect(result).not.toBeNull();
    });

    it('should return null for non-existent template', async () => {
      const slug = 'nonexistent';

      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = await getTemplateBySlug(slug);

      expect(result).toBeNull();
    });

    it('should return null and log error on parsing failure', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const slug = 'badtemplate';

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(templateParser.parseTemplateYaml).mockImplementation(() => {
        throw new Error('Parse error');
      });

      const result = await getTemplateBySlug(slug);

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });
});
