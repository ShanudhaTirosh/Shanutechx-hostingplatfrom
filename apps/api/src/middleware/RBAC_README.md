# RBAC Middleware Documentation

## Overview

The RBAC (Role-Based Access Control) middleware provides a flexible, secure way to enforce role-based permissions across the ShanuTechX Platform Admin & Catalog Management System API.

## Files

- **`rbac.ts`** - Main middleware implementation
- **`rbac.test.ts`** - Comprehensive test suite (25 test cases)
- **`rbac.example.ts`** - Usage examples and patterns
- **`RBAC_README.md`** - This documentation

## User Roles

The system supports four user roles with distinct permissions:

| Role | Description | Access Level |
|------|-------------|--------------|
| `customer` | Regular platform users | Own resources only |
| `admin` | Platform administrators | All resources + user management |
| `support` | Customer support staff | Support features + customer assistance |
| `dev` | Infrastructure developers | All infrastructure + technical resources |

## Core Functions

### `requireRole(...roles: UserRole[])`

Factory function that creates Express middleware to enforce role requirements.

**Parameters:**
- `...roles` - One or more roles that are authorized to access the endpoint

**Returns:** Express middleware function

**Usage:**
```typescript
// Single role
router.post('/api/admin/users', requireAuth, requireRole('admin'), handler);

// Multiple roles
router.post('/api/catalog', requireAuth, requireRole('admin', 'dev'), handler);

// All authenticated users
router.get('/api/catalog', requireAuth, requireRole('customer', 'admin', 'support', 'dev'), handler);
```

**Behavior:**
- Returns `401` if user is not authenticated
- Returns `403` with descriptive error if user lacks required role
- Calls `next()` if user has one of the required roles

**Error Response Format:**
```json
{
  "error": "Insufficient permissions",
  "message": "This action requires one of the following roles: admin, dev. Your role: customer",
  "requiredRoles": ["admin", "dev"],
  "userRole": "customer"
}
```

### `verifyResourceOwnership(resourceOwnerId, req, res)`

Verifies that the authenticated user owns a specific resource or has admin/dev privileges.

**Parameters:**
- `resourceOwnerId: string` - The user ID who owns the resource
- `req: AuthedRequest` - The authenticated request object
- `res: Response` - The Express response object

**Returns:** `boolean` - `true` if access granted, `false` otherwise

**Security Feature:** Returns `404` (not `403`) when customers attempt to access other customers' resources to prevent information disclosure about resource existence.

**Usage:**
```typescript
router.get('/api/deployments/:id', requireAuth, requireRole('customer', 'admin', 'dev'), async (req: AuthedRequest, res) => {
  const deployment = await prisma.deployment.findUnique({ where: { id: req.params.id } });
  
  if (!deployment) {
    return res.status(404).json({ error: 'Deployment not found' });
  }
  
  // Verify ownership - returns 404 if unauthorized
  if (!verifyResourceOwnership(deployment.userId, req, res)) {
    return; // Response already sent
  }
  
  res.json({ deployment });
});
```

**Behavior:**
- Admin and dev users can access all resources (bypasses ownership check)
- Customers can only access their own resources
- Support role does NOT bypass ownership checks
- Returns `404` for unauthorized access (prevents information disclosure)

### `isSupportStaff(req)`

Utility function to check if a user has support staff privileges.

**Parameters:**
- `req: AuthedRequest` - The authenticated request object

**Returns:** `boolean` - `true` if user is admin, support, or dev

**Usage:**
```typescript
if (isSupportStaff(req)) {
  // Show additional support features
}
```

### `hasInfrastructureAccess(req)`

Utility function to check if a user has infrastructure access.

**Parameters:**
- `req: AuthedRequest` - The authenticated request object

**Returns:** `boolean` - `true` if user is admin or dev

**Usage:**
```typescript
if (hasInfrastructureAccess(req)) {
  // Show infrastructure management features
}
```

## Requirements Mapping

This middleware validates the following requirements from the Platform Admin & Catalog Management System:

| Requirement | Description | Implementation |
|-------------|-------------|----------------|
| 5.1 | Only admin/dev can create catalog items | `requireRole('admin', 'dev')` |
| 5.2 | Only admin/dev can edit catalog items | `requireRole('admin', 'dev')` |
| 5.3 | Only admin/dev can create VPS plans | `requireRole('admin', 'dev')` |
| 5.4 | Only admin/dev can edit VPS plans | `requireRole('admin', 'dev')` |
| 5.5 | Customers can view catalog items | `requireRole('customer', 'admin', 'support', 'dev')` |
| 5.6 | Customers can deploy catalog items | `requireRole('customer', 'admin', 'dev')` |
| 5.7 | Customers see only their own deployments | `verifyResourceOwnership()` |
| 5.8 | Customers manage only their own domains | `verifyResourceOwnership()` |
| 5.9 | Admin can view all deployments | Admin bypasses ownership checks |
| 5.10 | Dev can view all infrastructure | Dev bypasses ownership checks |
| 5.11 | Admin features hidden for customers | UI + `requireRole()` |
| 5.12 | Role validation at API & UI levels | Middleware + frontend guards |

## Common Patterns

### Pattern 1: Admin/Dev Only Operations

For operations that modify system-wide catalog or infrastructure:

```typescript
router.post('/api/catalog', requireAuth, requireRole('admin', 'dev'), handler);
router.patch('/api/vps-plans/:id', requireAuth, requireRole('admin', 'dev'), handler);
router.get('/api/leaseweb/resources', requireAuth, requireRole('admin', 'dev'), handler);
```

### Pattern 2: Customer Resource Management

For operations on resources owned by customers:

```typescript
router.get('/api/deployments/:id', 
  requireAuth, 
  requireRole('customer', 'admin', 'dev'), 
  async (req: AuthedRequest, res) => {
    const resource = await fetchResource(req.params.id);
    if (!resource) return res.status(404).json({ error: 'Not found' });
    
    if (!verifyResourceOwnership(resource.userId, req, res)) return;
    
    res.json({ resource });
  }
);
```

### Pattern 3: List Resources with Filtering

For listing operations where customers see only their own resources:

```typescript
router.get('/api/deployments',
  requireAuth,
  requireRole('customer', 'admin', 'dev'),
  async (req: AuthedRequest, res) => {
    const where = (req.user?.role === 'admin' || req.user?.role === 'dev')
      ? {} // Admin/dev see all
      : { userId: req.user?.id }; // Customer sees only their own
    
    const deployments = await prisma.deployment.findMany({ where });
    res.json({ deployments });
  }
);
```

### Pattern 4: Admin-Only Operations

For operations restricted to admin role only:

```typescript
router.patch('/api/admin/users/:id/role', requireAuth, requireRole('admin'), handler);
```

## Testing

The middleware includes a comprehensive test suite with 25 test cases covering:

- ✅ Role validation for all four user roles
- ✅ Multiple role requirements
- ✅ Authentication validation
- ✅ Resource ownership verification
- ✅ Admin/dev privilege bypass
- ✅ 404 vs 403 error handling
- ✅ Support staff utilities
- ✅ Infrastructure access utilities
- ✅ Integration scenarios

**Run tests:**
```bash
npm run test -- rbac.test.ts
```

**All 25 tests pass** ✅

## Security Considerations

### 1. 404 Instead of 403

When customers attempt to access resources they don't own, the middleware returns `404` (not `403`) to prevent information disclosure:

```typescript
// ❌ Bad: Reveals resource exists
res.status(403).json({ error: 'Access denied' });

// ✅ Good: Doesn't reveal resource existence
res.status(404).json({ error: 'Resource not found' });
```

### 2. Always Use with requireAuth

RBAC middleware should always be used after `requireAuth`:

```typescript
// ✅ Correct
router.post('/api/catalog', requireAuth, requireRole('admin', 'dev'), handler);

// ❌ Wrong - role check without auth
router.post('/api/catalog', requireRole('admin', 'dev'), handler);
```

### 3. Verify Ownership Before Mutations

Always verify resource ownership before performing destructive operations:

```typescript
router.delete('/api/deployments/:id',
  requireAuth,
  requireRole('customer', 'admin', 'dev'),
  async (req: AuthedRequest, res) => {
    const deployment = await prisma.deployment.findUnique({ where: { id: req.params.id } });
    if (!deployment) return res.status(404).json({ error: 'Not found' });
    
    // Critical: Verify ownership before deletion
    if (!verifyResourceOwnership(deployment.userId, req, res)) return;
    
    await prisma.deployment.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  }
);
```

## Migration Guide

### Replacing Existing Auth Middleware

If you have existing role checks, migrate to the new RBAC middleware:

**Before:**
```typescript
router.post('/api/catalog', requireAuth, requireAdmin, handler);
```

**After:**
```typescript
router.post('/api/catalog', requireAuth, requireRole('admin', 'dev'), handler);
```

### Adding Resource Ownership Checks

**Before:**
```typescript
router.get('/api/deployments/:id', requireAuth, async (req, res) => {
  const deployment = await prisma.deployment.findUnique({ where: { id: req.params.id } });
  res.json({ deployment });
});
```

**After:**
```typescript
router.get('/api/deployments/:id', 
  requireAuth, 
  requireRole('customer', 'admin', 'dev'),
  async (req: AuthedRequest, res) => {
    const deployment = await prisma.deployment.findUnique({ where: { id: req.params.id } });
    if (!deployment) return res.status(404).json({ error: 'Not found' });
    
    if (!verifyResourceOwnership(deployment.userId, req, res)) return;
    
    res.json({ deployment });
  }
);
```

## TypeScript Support

All functions are fully typed with TypeScript:

```typescript
import { AuthedRequest } from './auth';
import { requireRole, verifyResourceOwnership, UserRole } from './rbac';

// Type-safe role array
const roles: UserRole[] = ['admin', 'dev'];

// Type-safe request handlers
router.get('/api/resource', requireAuth, requireRole('admin'), async (req: AuthedRequest, res) => {
  // req.user is properly typed
  const userId = req.user?.id;
});
```

## Best Practices

1. **Always use `requireAuth` before `requireRole`**
2. **Use `verifyResourceOwnership()` for customer-owned resources**
3. **Return 404 (not 403) for unauthorized customer access**
4. **Be explicit about required roles in route definitions**
5. **Test both successful and unauthorized access scenarios**
6. **Document which requirements each endpoint validates**
7. **Use TypeScript's `AuthedRequest` type for type safety**

## Examples

See `rbac.example.ts` for comprehensive usage examples including:
- Catalog management (admin/dev only)
- VPS plan management (admin/dev only)
- Deployment management (with ownership verification)
- Custom domain management (with ownership verification)
- User management (admin only)
- Mail server UI (admin/dev only)
- Leaseweb resources (admin/dev only)
- Filtered list operations

## Support

For questions or issues with the RBAC middleware:
1. Check the test suite (`rbac.test.ts`) for expected behavior
2. Review usage examples (`rbac.example.ts`)
3. Consult the requirements document for role permission mappings
4. Check TypeScript diagnostics for type errors

---

**Last Updated:** December 2024  
**Version:** 1.0.0  
**Test Coverage:** 25/25 tests passing ✅
