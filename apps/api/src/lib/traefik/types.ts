/**
 * Traefik Configuration Types
 * 
 * Type definitions for Traefik dynamic configuration and routing.
 */

/**
 * Traefik entrypoint names
 */
export type TraefikEntrypoint = 'web' | 'websecure';

/**
 * Traefik TLS configuration
 */
export interface TraefikTLSConfig {
  certResolver?: string;
  domains?: Array<{
    main: string;
    sans?: string[];
  }>;
}

/**
 * Traefik HTTP router configuration
 */
export interface TraefikRouter {
  rule: string;
  entryPoints: TraefikEntrypoint[];
  service: string;
  middlewares?: string[];
  tls?: TraefikTLSConfig;
  priority?: number;
}

/**
 * Traefik HTTP service configuration
 */
export interface TraefikService {
  loadBalancer: {
    servers: Array<{
      url: string;
    }>;
    passHostHeader?: boolean;
  };
}

/**
 * Traefik middleware configuration
 */
export interface TraefikMiddleware {
  redirectScheme?: {
    scheme: 'http' | 'https';
    permanent?: boolean;
  };
  headers?: {
    customRequestHeaders?: Record<string, string>;
    customResponseHeaders?: Record<string, string>;
    sslRedirect?: boolean;
    stsSeconds?: number;
    stsIncludeSubdomains?: boolean;
    stsPreload?: boolean;
  };
  rateLimit?: {
    average: number;
    burst: number;
  };
}

/**
 * Complete Traefik HTTP configuration
 */
export interface TraefikHTTPConfig {
  routers: Record<string, TraefikRouter>;
  services: Record<string, TraefikService>;
  middlewares?: Record<string, TraefikMiddleware>;
}

/**
 * Traefik dynamic configuration (file-based)
 */
export interface TraefikDynamicConfig {
  http: TraefikHTTPConfig;
}

/**
 * Docker labels for Traefik configuration
 */
export interface TraefikDockerLabels {
  'traefik.enable': string;
  [key: `traefik.http.routers.${string}.rule`]: string;
  [key: `traefik.http.routers.${string}.entrypoints`]: string;
  [key: `traefik.http.routers.${string}.service`]: string;
  [key: `traefik.http.routers.${string}.tls`]: string;
  [key: `traefik.http.routers.${string}.tls.certresolver`]: string;
  [key: `traefik.http.routers.${string}.middlewares`]: string;
  [key: `traefik.http.routers.${string}.priority`]: string;
  [key: `traefik.http.services.${string}.loadbalancer.server.port`]: string;
  [key: `traefik.http.middlewares.${string}.redirectscheme.scheme`]: string;
  [key: `traefik.http.middlewares.${string}.redirectscheme.permanent`]: string;
}

/**
 * Route status for tracking
 */
export type RouteStatus = 'pending' | 'active' | 'failed' | 'removed';

/**
 * Custom domain route configuration
 */
export interface CustomDomainRoute {
  domain: string;
  deploymentId: string;
  internalPort: number;
  sslEnabled: boolean;
  httpsRedirect: boolean;
  status: RouteStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * SSL certificate information
 */
export interface SSLCertificate {
  domain: string;
  certificateId: string;
  issuer: 'letsencrypt' | 'cloudflare' | 'custom';
  status: 'pending' | 'active' | 'expired' | 'failed';
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Routing rule configuration
 */
export interface RoutingRule {
  type: 'host' | 'path' | 'headers' | 'query';
  value: string;
  operator?: 'equals' | 'startsWith' | 'contains' | 'regex';
}

/**
 * Load balancer configuration
 */
export interface LoadBalancerConfig {
  servers: Array<{
    host: string;
    port: number;
    weight?: number;
  }>;
  healthCheck?: {
    path: string;
    interval: string;
    timeout: string;
  };
  sticky?: {
    cookie?: {
      name: string;
      secure?: boolean;
      httpOnly?: boolean;
    };
  };
}

/**
 * Middleware chain configuration
 */
export interface MiddlewareChain {
  name: string;
  middlewares: string[];
}

/**
 * Route configuration error
 */
export class TraefikConfigError extends Error {
  constructor(
    message: string,
    public domain?: string,
    public deploymentId?: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'TraefikConfigError';
  }
}
