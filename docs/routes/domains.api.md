# Domain Management API Documentation

This document describes the REST API endpoints for custom domain management in the ShanuTechX Platform.

## Overview

The Domain API provides endpoints for:
- Attaching custom domains to deployments
- Verifying CNAME DNS records
- Provisioning SSL certificates automatically
- Removing custom domains
- Listing domains for a deployment

All endpoints require authentication via Firebase ID token in the `Authorization` header.

## Authentication

All requests must include a valid Firebase ID token:

```
Authorization: Bearer <firebase-id-token>
```

## Authorization

Domain operations enforce ownership-based access control:
- **Customers** can only manage domains for their own deployments
- **Admin** and **Dev** users can manage domains for any deployment
- Attempting to access another customer's domains returns `404` (not `403`) to avoid revealing resource existence

## Endpoints

### POST /api/domains/attach

Attach a custom domain to a deployment.

**Request Body:**
```json
{
  "deploymentId": "clxyz123abc",
  "domain": "app.example.com"
}
```

**Response (201 Created):**
```json
{
  "customDomain": {
    "id": "cldomain123",
    "domain": "app.example.com",
    "status": "pending",
    "cnameTarget": "my-deployment.shanutechx.com"
  },
  "cnameTarget": "my-deployment.shanutechx.com",
  "instructions": "To configure your custom domain \"app.example.com\", please add the following CNAME record at your DNS provider:\n\nType: CNAME\nName: app.example.com\nTarget: my-deployment.shanutechx.com\nTTL: 300 (or automatic)\n\nOnce the CNAME record is configured, click \"Verify Domain\" to check the DNS configuration.\n\nAfter verification succeeds, we will automatically provision an SSL certificate and configure secure HTTPS routing for your custom domain."
}
```

**Error Responses:**

- `400 Bad Request` - Invalid request data
  ```json
  {
    "error": "Invalid request data",
    "details": {
      "fieldErrors": {
        "domain": ["Invalid domain format"]
      }
    }
  }
  ```

- `403 Forbidden` - Not deployment owner
  ```json
  {
    "error": "Insufficient permissions",
    "message": "You do not have access to this deployment"
  }
  ```

- `404 Not Found` - Deployment not found
  ```json
  {
    "error": "Deployment not found",
    "message": "No deployment found with ID: clxyz123abc"
  }
  ```

- `409 Conflict` - Domain already attached or deployment has no subdomain
  ```json
  {
    "error": "Domain already attached",
    "message": "Domain app.example.com is already attached to another deployment"
  }
  ```

---

### POST /api/domains/:id/verify

Verify a custom domain's CNAME record and trigger SSL provisioning.

**Path Parameters:**
- `id` - The custom domain ID

**Response (200 OK) - Verification Succeeded:**
```json
{
  "status": "verified",
  "domain": "app.example.com",
  "verified": true,
  "resolvedTarget": "my-deployment.shanutechx.com",
  "sslStatus": "active",
  "message": "Domain verified successfully and SSL certificate is active. Your custom domain is now live!"
}
```

**Response (409 Conflict) - Verification Failed:**
```json
{
  "status": "failed",
  "domain": "app.example.com",
  "verified": false,
  "resolvedTarget": "",
  "expectedTarget": "my-deployment.shanutechx.com",
  "message": "CNAME record not found. Please add a CNAME record: app.example.com -> my-deployment.shanutechx.com"
}
```

Or if CNAME points to wrong target:
```json
{
  "status": "failed",
  "domain": "app.example.com",
  "verified": false,
  "resolvedTarget": "wrong-target.example.com",
  "expectedTarget": "my-deployment.shanutechx.com",
  "message": "CNAME record points to incorrect target. Expected: my-deployment.shanutechx.com, Found: wrong-target.example.com"
}
```

**Error Responses:**

- `400 Bad Request` - Invalid domain ID
- `403 Forbidden` - Not domain owner
- `404 Not Found` - Custom domain not found
- `500 Internal Server Error` - Verification system error

---

### DELETE /api/domains/:id

Remove a custom domain from a deployment.

**Path Parameters:**
- `id` - The custom domain ID

**Response (200 OK):**
```json
{
  "success": true,
  "domain": "app.example.com",
  "message": "Custom domain \"app.example.com\" has been successfully removed"
}
```

**Error Responses:**

- `400 Bad Request` - Invalid domain ID
- `403 Forbidden` - Not domain owner
- `404 Not Found` - Custom domain not found
- `500 Internal Server Error` - Removal system error

---

### GET /api/deployments/:id/domains

List all custom domains attached to a deployment.

**Path Parameters:**
- `id` - The deployment ID

**Response (200 OK):**
```json
{
  "domains": [
    {
      "id": "cldomain123",
      "domain": "app.example.com",
      "cnameTarget": "my-deployment.shanutechx.com",
      "status": "active",
      "sslCertId": "cloudflare-cert-123",
      "verifiedAt": "2024-01-15T10:30:00.000Z",
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    },
    {
      "id": "cldomain456",
      "domain": "www.example.com",
      "cnameTarget": "my-deployment.shanutechx.com",
      "status": "pending",
      "sslCertId": null,
      "verifiedAt": null,
      "createdAt": "2024-01-15T11:00:00.000Z",
      "updatedAt": "2024-01-15T11:00:00.000Z"
    }
  ],
  "total": 2
}
```

**Error Responses:**

- `400 Bad Request` - Invalid deployment ID
- `403 Forbidden` - Not deployment owner
- `404 Not Found` - Deployment not found
- `500 Internal Server Error` - System error

---

## Domain Status Values

Custom domains progress through the following states:

- `pending` - Domain attached, waiting for CNAME verification
- `verified` - CNAME verified, SSL certificate being provisioned
- `failed` - CNAME verification failed (wrong target or not configured)
- `ssl_provisioning` - SSL certificate requested from Cloudflare
- `active` - SSL certificate active, domain fully configured and live

## Workflow

1. **Attach Domain**: `POST /api/domains/attach`
   - Creates CustomDomain record with status `pending`
   - Returns CNAME target and setup instructions

2. **Customer Configures DNS**: Customer adds CNAME record at their DNS provider
   - May take 1-60 minutes for DNS propagation

3. **Verify Domain**: `POST /api/domains/:id/verify`
   - Checks if CNAME resolves correctly
   - If verified, automatically triggers SSL provisioning
   - Configures Traefik routing when SSL is active

4. **Domain Live**: Status becomes `active`
   - Traffic routed to deployment
   - HTTPS enforced automatically
   - SSL certificate auto-renewed before expiration

## Example: Complete Domain Attachment Flow

```bash
# 1. Attach domain
curl -X POST https://api.shanutechx.com/api/domains/attach \
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "deploymentId": "clxyz123abc",
    "domain": "app.example.com"
  }'

# Response includes CNAME target: my-deployment.shanutechx.com

# 2. Customer adds CNAME record at DNS provider:
#    app.example.com -> my-deployment.shanutechx.com

# 3. Wait for DNS propagation (1-60 minutes)

# 4. Verify domain
curl -X POST https://api.shanutechx.com/api/domains/cldomain123/verify \
  -H "Authorization: Bearer $FIREBASE_TOKEN"

# Response indicates verification success and SSL status

# 5. Domain is now live at https://app.example.com
```

## Error Handling

All endpoints follow consistent error response format:

```json
{
  "error": "Error type",
  "message": "Human-readable error message"
}
```

For validation errors (400), additional `details` field contains field-level errors.

## Rate Limiting

Domain API endpoints are subject to the global rate limiter configured in the API server.

## Security Considerations

- All domain operations require authentication
- Customers can only manage domains for their own deployments
- Admin/dev users have unrestricted access for support purposes
- Failed domain ownership checks return 404 (not 403) to prevent resource enumeration
- Domain format is strictly validated to prevent injection attacks
- SSL certificates are automatically provisioned and renewed via Cloudflare
- HTTPS is enforced for all custom domains

## Support

For issues with custom domain configuration, customers should:
1. Verify CNAME record is correctly configured at DNS provider
2. Wait for DNS propagation (may take up to 60 minutes)
3. Check domain status via `GET /api/deployments/:id/domains`
4. Contact support if verification continues to fail
