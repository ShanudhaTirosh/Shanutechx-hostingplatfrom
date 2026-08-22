/**
 * Traefik Configuration Module
 * 
 * This module provides an abstraction layer for managing Traefik routing rules
 * and SSL configuration. It supports:
 * 
 * - Dynamic routing rule creation for custom domains
 * - SSL certificate provisioning via Let's Encrypt
 * - HTTP to HTTPS redirect enforcement
 * - Multiple domains per deployment
 * - Routing priority management to avoid conflicts
 * 
 * The actual Traefik configuration is managed by the node-agent through Docker
 * labels applied to containers. Traefik automatically discovers and configures
 * routes based on these labels.
 * 
 * @module traefik
 */

export { TraefikConfig, traefikConfig } from './config';
export type { AddRouteParams, TraefikRouteConfig } from './config';
export * from './types';
