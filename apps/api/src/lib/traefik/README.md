# Traefik Configuration Module

This module provides an abstraction layer for managing Traefik routing rules and SSL configuration for custom domains in the ShanuTechX platform.

## Overview

The Traefik configuration module manages dynamic routing rules that route traffic from custom domains to backend services. It handles:

- **Dynamic routing rule creation** - Add routes for custom domains to deployments
- **SSL certificate provisioning** - Automatic certificate issuance via Let's Encrypt
- **HTTPS enforcement** - HTTP to HTTPS redirect configuration
- **Multiple domains** - Support multiple custom domains per deployment
- **Conflict prevention** - Validate domains and check for routing conflicts

## Architecture

The actual Traefik configuration is managed by the **node-agent** through Docker labels applied to containers. This module provides a high-level interface to interact with the node-agent API.

```
┌─────────────────┐
│ Traefik Module  │
│   (this layer)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Node Agent API │
│ (HTTP endpoints)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Docker Labels   │
│  on Container   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│     Traefik     │
│  (auto-config)  │
└─────────────────┘
```

## Configuration Approach

The platform uses **Docker labels** for Traefik configuration:

1. The node-agent applies Traefik labels to deployment containers
2. Traefik automatically discovers labeled containers
3. Traefik configures routes and provisions SSL certificates
4. Traffic is routed based on domain matching rules

### Example Docker Labels

```yaml
labels:
  traefik.enable: "true"
  traefik.http.routers.my-app.rule: "Host(`example.com`)"
  traefik.http.routers.my-app.entrypoints: "websecure"
  traefik.http.routers.my-app.tls: "true"
  traefik.http.routers.my-app.tls.certresolver: "letsencrypt"
  traefik.http.routers.my-app-http.rule: "Host(`example.com`)"
  traefik.http.routers.my-app-http.entrypoints: "web"
  traefik.http.routers.my-app-http.middlewares: "my-app-redirect"
  traefik.http.middlewares.my-app-redirect.redirectscheme.scheme: "https"
  traefik.http.middlewares.my-app-redirect.redirectscheme.permanent: "true"
  traefik.http.services.my-app.loadbalancer.server.port: "3000"
```

## Usage

### Adding a Custom Domain Route

```typescript
import { traefikConfig } from './lib/traefik';

const node = await prisma.node.findUnique({ where: { id: nodeId } });
const deployment = await prisma.deployment.findUnique({ where: { id: deploymentId } });

await traefikConfig.addRoute(node, deployment.id, {
  domain: 'example.com',
  targetService: deployment.id,
  targetPort: deployment.internalPort,
  useSSL: true,
});
```

### Removing a Custom Domain Route

```typescript
await traefikConfig.removeRoute(node, deploymentId, 'example.com');
```

### Updating SSL Configuration

```typescript
await traefikConfig.updateSSL(node, deploymentId, 'example.com', 'cert-id');
```

Note: With Let's Encrypt integration, SSL certificates are automatically managed by Traefik. This method triggers a route update to refresh the SSL configuration.

### Validating a Domain

```typescript
const isValid = traefikConfig.validateDomain('example.com');
if (!isValid) {
  throw new Error('Invalid domain format');
}
```

### Checking for Domain Conflicts

```typescript
const hasConflict = await traefikConfig.checkDomainConflict('example.com');
if (hasConflict) {
  throw new Error('Domain already in use');
}
```

## SSL Certificate Management

The platform uses **Let's Encrypt** for automatic SSL certificate provisioning:

1. When a route is added with `useSSL: true`, Traefik is configured to use the Let's Encrypt certificate resolver
2. Traefik automatically requests an SSL certificate from Let's Encrypt
3. The certificate is validated using HTTP-01 or TLS-ALPN-01 challenge
4. Traefik automatically renews certificates before expiration
5. All certificate management is handled by Traefik - no manual intervention required

## HTTP to HTTPS Redirect

When `useSSL: true` is set, the module automatically configures:

1. **HTTPS Router** - Listens on port 443 (websecure entrypoint) with TLS enabled
2. **HTTP Router** - Listens on port 80 (web entrypoint)
3. **Redirect Middleware** - Redirects HTTP requests to HTTPS with 301 permanent redirect

This ensures all traffic to custom domains is served over HTTPS.

## Routing Priority

To avoid conflicts when multiple routes could match the same request, Traefik uses priority rules:

- **Default priority**: Based on rule length (longer rules = higher priority)
- **Custom priority**: Can be set via `routingPriority` parameter
- **Host rules**: Generally have priority over path-based rules

Example:
```typescript
// Higher priority route (processed first)
generateRouterConfig({
  domain: 'api.example.com',
  deploymentId: 'dep-123',
  internalPort: 3000,
  sslEnabled: true,
  httpsRedirect: true,
  routingPriority: 100,
});
```

## Error Handling

The module throws descriptive errors for common failure scenarios:

- **Route creation failure** - Node-agent API error
- **Route removal failure** - Container not found or API error
- **SSL configuration failure** - Certificate provisioning error
- **Domain validation failure** - Invalid domain format
- **Domain conflict** - Domain already in use

All errors are logged with context for debugging.

## Environment Variables

The module uses the following environment variables (defined in `env.ts`):

- `ROOT_DOMAIN` - The platform's root domain (e.g., `shanutechx.com`)
- `NODE_AGENT_SECRET` - Authentication secret for node-agent API calls
- `NODE_AGENT_PORT` - Port where node-agent listens (default: 5000)

## Integration with Custom Domain Flow

The complete custom domain attachment flow:

1. **Customer requests domain attachment** → `POST /api/domains/attach`
2. **System generates CNAME target** → `{deployment-id}.{root-domain}`
3. **Customer configures DNS** → CNAME record at their DNS provider
4. **System verifies CNAME** → `POST /api/domains/:id/verify`
5. **System adds Traefik route** → `traefikConfig.addRoute()`
6. **Traefik provisions SSL** → Let's Encrypt certificate
7. **Domain is active** → Traffic routed with HTTPS

## Testing

The module includes utility methods for testing:

### Generate Router Configuration

```typescript
const labels = traefikConfig.generateRouterConfig({
  domain: 'example.com',
  deploymentId: 'dep-123',
  internalPort: 3000,
  sslEnabled: true,
  httpsRedirect: true,
});

// Returns Docker label configuration
console.log(labels);
```

This is useful for:
- Debugging Traefik configuration issues
- Testing label generation logic
- Verifying routing rules before applying them

## Troubleshooting

### Route not working after creation

1. **Check container labels**: Verify the Docker container has the correct Traefik labels
2. **Check Traefik logs**: Look for certificate provisioning or routing errors
3. **Verify DNS resolution**: Ensure the domain resolves to the correct IP
4. **Check SSL certificate**: Verify Let's Encrypt certificate was issued

### SSL certificate not provisioned

1. **Check domain ownership**: CNAME must point to the platform
2. **Check Let's Encrypt rate limits**: May be hitting rate limits for the domain
3. **Check Traefik logs**: Look for ACME challenge failures
4. **Verify firewall**: Ensure ports 80/443 are accessible

### HTTP to HTTPS redirect not working

1. **Check middleware configuration**: Verify redirect middleware is applied
2. **Check entrypoint configuration**: Ensure both web and websecure entrypoints are configured
3. **Check Traefik logs**: Look for middleware errors

## Related Modules

- **`nodeAgentClient.ts`** - Low-level API client for node-agent communication
- **`customDomain.ts`** - Domain verification logic (CNAME validation)
- **`cloudflare/client.ts`** - Cloudflare API integration for DNS management
- **`deployPipeline.ts`** - Deployment orchestration and subdomain configuration

## Future Enhancements

Potential improvements for this module:

1. **Advanced load balancing** - Support for multiple backend servers
2. **Custom middleware chains** - Rate limiting, authentication, etc.
3. **Path-based routing** - Route specific paths to different services
4. **Weighted routing** - Canary deployments and A/B testing
5. **Circuit breaker** - Automatic failover on service errors
6. **Custom SSL certificates** - Support for user-provided certificates
7. **Wildcard domains** - Support for `*.example.com` routing
