import { Router } from 'express';

export const openapiRouter = Router();

/**
 * GET /api/docs/openapi.json
 * Generates and returns OpenAPI 3.0 specification for ShanuTechX platform APIs.
 */
openapiRouter.get('/docs/openapi.json', (_req, res) => {
  const openApiSpec = {
    openapi: '3.0.3',
    info: {
      title: 'ShanuTechX Platform API',
      version: '1.0.0',
      description: 'Comprehensive REST API for ShanuTechX PaaS, VPS management, email hosting, deployments, and node agent control.',
      contact: {
        name: 'ShanuTechX Developer Support',
        email: 'support@shanutechx.com',
        url: 'https://shanutechx.com',
      },
    },
    servers: [
      { url: 'https://api.shanutechx.com', description: 'Production API Server' },
      { url: 'http://localhost:5000', description: 'Local Development Server' },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Firebase ID Token or JWT API Key',
        },
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'ShanuTechX Personal Developer API Key',
        },
      },
    },
    security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
    paths: {
      '/api/me': {
        get: {
          summary: 'Get Current Authenticated User Profile',
          tags: ['Account'],
          responses: {
            200: { description: 'Authenticated User Profile' },
            401: { description: 'Unauthorized' },
          },
        },
      },
      '/api/deployments': {
        get: {
          summary: 'List Deployments',
          tags: ['Deployments'],
          responses: { 200: { description: 'List of deployments' } },
        },
        post: {
          summary: 'Create & Run Deployment',
          tags: ['Deployments'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    repoUrl: { type: 'string' },
                    branch: { type: 'string', default: 'main' },
                    serviceType: { type: 'string', example: 'web_hosting' },
                    preferredName: { type: 'string' },
                    internalPort: { type: 'number', default: 3000 },
                    envVars: { type: 'object' },
                  },
                  required: ['repoUrl', 'preferredName', 'internalPort'],
                },
              },
            },
          },
          responses: { 201: { description: 'Deployment triggered successfully' } },
        },
      },
      '/api/managed-databases': {
        get: {
          summary: 'List Provisioned Managed Databases',
          tags: ['Databases'],
          responses: { 200: { description: 'Managed databases' } },
        },
        post: {
          summary: 'Provision Managed Database (Postgres/MySQL/Redis)',
          tags: ['Databases'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', enum: ['postgres', 'mysql', 'redis'] },
                    password: { type: 'string' },
                  },
                  required: ['type', 'password'],
                },
              },
            },
          },
          responses: { 201: { description: 'Managed database provisioned' } },
        },
      },
      '/api/vps': {
        get: {
          summary: 'List Customer Leaseweb VPS Instances',
          tags: ['VPS'],
          responses: { 200: { description: 'List of VPS instances' } },
        },
      },
      '/api/email/mailboxes': {
        get: {
          summary: 'List Customer Email Mailboxes',
          tags: ['Email & Webmail'],
          responses: { 200: { description: 'Mailboxes list' } },
        },
        post: {
          summary: 'Create Mailbox Alias',
          tags: ['Email & Webmail'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string' },
                    storageQuotaMb: { type: 'number', default: 5120 },
                  },
                  required: ['email', 'password'],
                },
              },
            },
          },
          responses: { 201: { description: 'Mailbox created' } },
        },
      },
    },
  };

  res.json(openApiSpec);
});

/**
 * GET /api/docs
 * Interactive Swagger UI HTML documentation page.
 */
openapiRouter.get('/docs', (_req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ShanuTechX API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body { margin: 0; background: #0b0c16; color: #fff; }
    .swagger-ui { filter: invert(88%) hue-rotate(180deg); }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      SwaggerUIBundle({
        url: '/api/docs/openapi.json',
        dom_id: '#swagger-ui',
      });
    };
  </script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});
