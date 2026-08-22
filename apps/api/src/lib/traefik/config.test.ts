import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TraefikConfig } from './config';

describe('TraefikConfig', () => {
  let traefikConfig: TraefikConfig;

  beforeEach(() => {
    traefikConfig = new TraefikConfig();
  });

  describe('validateDomain', () => {
    it('should validate correct domain formats', () => {
      expect(traefikConfig.validateDomain('example.com')).toBe(true);
      expect(traefikConfig.validateDomain('subdomain.example.com')).toBe(true);
      expect(traefikConfig.validateDomain('app.staging.example.com')).toBe(true);
      expect(traefikConfig.validateDomain('my-app.example.io')).toBe(true);
    });

    it('should reject invalid domain formats', () => {
      expect(traefikConfig.validateDomain('invalid')).toBe(false);
      expect(traefikConfig.validateDomain('invalid.')).toBe(false);
      expect(traefikConfig.validateDomain('.invalid.com')).toBe(false);
      expect(traefikConfig.validateDomain('invalid..com')).toBe(false);
      expect(traefikConfig.validateDomain('invalid-.com')).toBe(false);
      expect(traefikConfig.validateDomain('-invalid.com')).toBe(false);
      expect(traefikConfig.validateDomain('')).toBe(false);
      expect(traefikConfig.validateDomain('http://example.com')).toBe(false);
    });

    it('should handle edge cases', () => {
      // Domain with numbers
      expect(traefikConfig.validateDomain('app123.example.com')).toBe(true);
      
      // Domain with hyphens
      expect(traefikConfig.validateDomain('my-app.example.com')).toBe(true);
      
      // Long TLD
      expect(traefikConfig.validateDomain('example.technology')).toBe(true);
      
      // Short TLD
      expect(traefikConfig.validateDomain('example.io')).toBe(true);
    });
  });

  describe('generateRouterConfig', () => {
    it('should generate basic router configuration', () => {
      const config = traefikConfig.generateRouterConfig({
        domain: 'example.com',
        deploymentId: 'dep-123',
        internalPort: 3000,
        sslEnabled: false,
        httpsRedirect: false,
      });

      expect(config['traefik.enable']).toBe('true');
      expect(config).toHaveProperty('traefik.http.routers.custom-dep-123-example-com.rule');
      expect(config['traefik.http.routers.custom-dep-123-example-com.rule']).toBe('Host(`example.com`)');
      expect(config['traefik.http.routers.custom-dep-123-example-com.entrypoints']).toBe('web');
      expect(config['traefik.http.services.service-dep-123.loadbalancer.server.port']).toBe('3000');
    });

    it('should generate SSL configuration when enabled', () => {
      const config = traefikConfig.generateRouterConfig({
        domain: 'example.com',
        deploymentId: 'dep-123',
        internalPort: 3000,
        sslEnabled: true,
        httpsRedirect: false,
      });

      expect(config['traefik.http.routers.custom-dep-123-example-com.entrypoints']).toBe('websecure');
      expect(config['traefik.http.routers.custom-dep-123-example-com.tls']).toBe('true');
      expect(config['traefik.http.routers.custom-dep-123-example-com.tls.certresolver']).toBe('letsencrypt');
    });

    it('should generate HTTP to HTTPS redirect when enabled', () => {
      const config = traefikConfig.generateRouterConfig({
        domain: 'example.com',
        deploymentId: 'dep-123',
        internalPort: 3000,
        sslEnabled: true,
        httpsRedirect: true,
      });

      // Should have HTTPS router
      expect(config['traefik.http.routers.custom-dep-123-example-com.entrypoints']).toBe('websecure');
      expect(config['traefik.http.routers.custom-dep-123-example-com.tls']).toBe('true');

      // Should have HTTP router with redirect
      expect(config).toHaveProperty('traefik.http.routers.custom-dep-123-example-com-http.rule');
      expect(config['traefik.http.routers.custom-dep-123-example-com-http.rule']).toBe('Host(`example.com`)');
      expect(config['traefik.http.routers.custom-dep-123-example-com-http.entrypoints']).toBe('web');

      // Should have redirect middleware
      expect(config).toHaveProperty('traefik.http.middlewares.custom-dep-123-example-com-redirect.redirectscheme.scheme');
      expect(config['traefik.http.middlewares.custom-dep-123-example-com-redirect.redirectscheme.scheme']).toBe('https');
      expect(config['traefik.http.middlewares.custom-dep-123-example-com-redirect.redirectscheme.permanent']).toBe('true');
    });

    it('should not generate redirect when SSL is disabled', () => {
      const config = traefikConfig.generateRouterConfig({
        domain: 'example.com',
        deploymentId: 'dep-123',
        internalPort: 3000,
        sslEnabled: false,
        httpsRedirect: true, // This should be ignored when SSL is disabled
      });

      // Should not have redirect middleware
      const redirectKeys = Object.keys(config).filter(key => key.includes('redirect'));
      expect(redirectKeys).toHaveLength(0);
    });

    it('should set routing priority when specified', () => {
      const config = traefikConfig.generateRouterConfig({
        domain: 'example.com',
        deploymentId: 'dep-123',
        internalPort: 3000,
        sslEnabled: true,
        httpsRedirect: false,
        routingPriority: 100,
      });

      expect(config['traefik.http.routers.custom-dep-123-example-com.priority']).toBe('100');
    });

    it('should sanitize domain name in router names', () => {
      const config = traefikConfig.generateRouterConfig({
        domain: 'my-app.staging.example.com',
        deploymentId: 'dep-123',
        internalPort: 3000,
        sslEnabled: false,
        httpsRedirect: false,
      });

      // Domain with dots and hyphens should be sanitized to only hyphens
      expect(config).toHaveProperty('traefik.http.routers.custom-dep-123-my-app-staging-example-com.rule');
    });

    it('should handle different port numbers', () => {
      const config = traefikConfig.generateRouterConfig({
        domain: 'example.com',
        deploymentId: 'dep-123',
        internalPort: 8080,
        sslEnabled: false,
        httpsRedirect: false,
      });

      expect(config['traefik.http.services.service-dep-123.loadbalancer.server.port']).toBe('8080');
    });
  });

  describe('label generation consistency', () => {
    it('should generate consistent labels for the same configuration', () => {
      const config1 = traefikConfig.generateRouterConfig({
        domain: 'example.com',
        deploymentId: 'dep-123',
        internalPort: 3000,
        sslEnabled: true,
        httpsRedirect: true,
      });

      const config2 = traefikConfig.generateRouterConfig({
        domain: 'example.com',
        deploymentId: 'dep-123',
        internalPort: 3000,
        sslEnabled: true,
        httpsRedirect: true,
      });

      expect(config1).toEqual(config2);
    });

    it('should generate different labels for different deployments', () => {
      const config1 = traefikConfig.generateRouterConfig({
        domain: 'example.com',
        deploymentId: 'dep-123',
        internalPort: 3000,
        sslEnabled: true,
        httpsRedirect: true,
      });

      const config2 = traefikConfig.generateRouterConfig({
        domain: 'example.com',
        deploymentId: 'dep-456',
        internalPort: 3000,
        sslEnabled: true,
        httpsRedirect: true,
      });

      // Router names should be different
      const router1Keys = Object.keys(config1).filter(k => k.includes('routers.custom-dep-123'));
      const router2Keys = Object.keys(config2).filter(k => k.includes('routers.custom-dep-456'));
      
      expect(router1Keys.length).toBeGreaterThan(0);
      expect(router2Keys.length).toBeGreaterThan(0);
      expect(router1Keys).not.toEqual(router2Keys);
    });
  });

  describe('router name sanitization', () => {
    it('should remove all non-alphanumeric characters except hyphens', () => {
      const specialChars = ['api.example.com', 'my_app.example.com', 'app@example.com'];
      
      for (const domain of specialChars) {
        const config = traefikConfig.generateRouterConfig({
          domain,
          deploymentId: 'dep-123',
          internalPort: 3000,
          sslEnabled: false,
          httpsRedirect: false,
        });

        const routerKeys = Object.keys(config).filter(k => k.includes('routers.custom'));
        expect(routerKeys.length).toBeGreaterThan(0);
        
        // Verify no special chars in router name (except hyphens and dots in the key path)
        for (const key of routerKeys) {
          const routerName = key.split('.')[3]; // Extract router name
          expect(routerName).toMatch(/^[a-zA-Z0-9-]+$/);
        }
      }
    });
  });
});
