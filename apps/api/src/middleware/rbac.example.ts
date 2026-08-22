/**
 * RBAC Middleware Usage Examples
 * 
 * This file demonstrates how to use the RBAC middleware in route handlers.
 * These examples show the correct patterns for implementing role-based access control
 * across the Platform Admin & Catalog Management System.
 */

import { Router } from 'express';
import { requireAuth, AuthedRequest } from './auth';
import { requireRole, verifyResourceOwnership } from './rbac';
import { prisma } from '../lib/prisma';

const router = Router();

// ============================================================================
// EXAMPLE 1: Catalog Management (Admin and Dev Only)
// Validates: Requirements 5.1, 5.2
// ============================================================================

/**
 * Create a new catalog item
 * Only admin and dev users can create catalog items
 */
router.post(
  '/api/catalog',
  requireAuth,
  requireRole('admin', 'dev'),
  async (req, res) => {
    // Implementation here - user role already validated
    res.json({ message: 'Catalog item created' });
  }
);

/**
 * Edit an existing catalog item
 * Only admin and dev users can edit catalog items
 */
router.patch(
  '/api/catalog/:slug',
  requireAuth,
  requireRole('admin', 'dev'),
  async (req, res) => {
    // Implementation here - user role already validated
    res.json({ message: 'Catalog item updated' });
  }
);

// ============================================================================
// EXAMPLE 2: VPS Plan Management (Admin and Dev Only)
// Validates: Requirements 5.3, 5.4
// ============================================================================

/**
 * Create a new VPS plan
 * Only admin and dev users can create VPS plans
 */
router.post(
  '/api/vps-plans',
  requireAuth,
  requireRole('admin', 'dev'),
  async (req, res) => {
    // Implementation here
    res.json({ message: 'VPS plan created' });
  }
);

/**
 * Edit an existing VPS plan
 * Only admin and dev users can edit VPS plans
 */
router.patch(
  '/api/vps-plans/:id',
  requireAuth,
  requireRole('admin', 'dev'),
  async (req, res) => {
    // Implementation here
    res.json({ message: 'VPS plan updated' });
  }
);

// ============================================================================
// EXAMPLE 3: Catalog Browsing (All Authenticated Users)
// Validates: Requirement 5.5
// ============================================================================

/**
 * Browse catalog items
 * All authenticated users (customers, admin, support, dev) can view catalog
 */
router.get(
  '/api/catalog',
  requireAuth,
  requireRole('customer', 'admin', 'support', 'dev'),
  async (req, res) => {
    // All authenticated users can browse catalog
    res.json({ templates: [] });
  }
);

// ============================================================================
// EXAMPLE 4: Deployment Management with Resource Ownership
// Validates: Requirements 5.7, 5.8
// ============================================================================

/**
 * Get deployment details
 * Customers can only view their own deployments
 * Admin and dev can view all deployments
 */
router.get(
  '/api/deployments/:id',
  requireAuth,
  requireRole('customer', 'admin', 'dev'),
  async (req: AuthedRequest, res) => {
    const { id } = req.params;

    // Fetch the deployment
    const deployment = await prisma.deployment.findUnique({
      where: { id },
    });

    if (!deployment) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    // Verify resource ownership
    // Returns 404 (not 403) for customers accessing other customers' resources
    if (!verifyResourceOwnership(deployment.userId, req, res)) {
      return; // Response already sent by verifyResourceOwnership
    }

    // User has access to this deployment
    res.json({ deployment });
  }
);

/**
 * Stop a deployment
 * Customers can only stop their own deployments
 * Admin and dev can stop any deployment
 */
router.post(
  '/api/deployments/:id/stop',
  requireAuth,
  requireRole('customer', 'admin', 'dev'),
  async (req: AuthedRequest, res) => {
    const { id } = req.params;

    const deployment = await prisma.deployment.findUnique({
      where: { id },
    });

    if (!deployment) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    // Verify ownership before allowing stop
    if (!verifyResourceOwnership(deployment.userId, req, res)) {
      return;
    }

    // Implementation to stop deployment
    res.json({ status: 'stopped' });
  }
);

/**
 * Delete a deployment
 * Customers can only delete their own deployments
 */
router.delete(
  '/api/deployments/:id',
  requireAuth,
  requireRole('customer', 'admin', 'dev'),
  async (req: AuthedRequest, res) => {
    const { id } = req.params;

    const deployment = await prisma.deployment.findUnique({
      where: { id },
    });

    if (!deployment) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    if (!verifyResourceOwnership(deployment.userId, req, res)) {
      return;
    }

    // Delete deployment
    await prisma.deployment.delete({ where: { id } });
    res.json({ success: true });
  }
);

// ============================================================================
// EXAMPLE 5: Custom Domain Management (Resource Ownership)
// Validates: Requirement 5.8
// ============================================================================

/**
 * Attach custom domain to deployment
 * Customers can only attach domains to their own deployments
 */
router.post(
  '/api/domains/attach',
  requireAuth,
  requireRole('customer', 'admin', 'dev'),
  async (req: AuthedRequest, res) => {
    const { deploymentId, domain } = req.body;

    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
    });

    if (!deployment) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    // Verify customer owns the deployment before allowing domain attachment
    if (!verifyResourceOwnership(deployment.userId, req, res)) {
      return;
    }

    // Implementation to attach domain
    res.json({ domain, status: 'pending' });
  }
);

// ============================================================================
// EXAMPLE 6: User Management (Admin Only)
// Shows how to restrict to single role
// ============================================================================

/**
 * List all users
 * Only admin can access user management
 */
router.get(
  '/api/admin/users',
  requireAuth,
  requireRole('admin'),
  async (req, res) => {
    // Only admin users reach this point
    const users = await prisma.user.findMany();
    res.json({ users });
  }
);

/**
 * Change user role
 * Only admin can change user roles
 */
router.patch(
  '/api/admin/users/:id/role',
  requireAuth,
  requireRole('admin'),
  async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    // Only admin users can change roles
    await prisma.user.update({
      where: { id },
      data: { role },
    });

    res.json({ message: 'Role updated' });
  }
);

// ============================================================================
// EXAMPLE 7: Mail Server UI (Admin and Dev Only)
// Validates: Requirement 10.2
// ============================================================================

/**
 * Access mail server UI
 * Only admin and dev users can access mail server management
 */
router.get(
  '/api/mail/accounts',
  requireAuth,
  requireRole('admin', 'dev'),
  async (req, res) => {
    // Fetch mail accounts
    res.json({ accounts: [] });
  }
);

// ============================================================================
// EXAMPLE 8: Leaseweb Resource Management (Admin and Dev Only)
// Validates: Requirement 5.10
// ============================================================================

/**
 * View Leaseweb resources
 * Admin and dev users can view all infrastructure
 * Customers cannot access this endpoint
 */
router.get(
  '/api/leaseweb/resources',
  requireAuth,
  requireRole('admin', 'dev'),
  async (req, res) => {
    // Fetch Leaseweb resources
    res.json({ resources: [] });
  }
);

// ============================================================================
// EXAMPLE 9: Filtering Deployments by User
// Shows how admin/dev see all, customers see only their own
// ============================================================================

/**
 * List deployments
 * Customers see only their own deployments
 * Admin and dev see all deployments
 */
router.get(
  '/api/deployments',
  requireAuth,
  requireRole('customer', 'admin', 'dev'),
  async (req: AuthedRequest, res) => {
    let deployments;

    // Admin and dev can see all deployments
    if (req.user?.role === 'admin' || req.user?.role === 'dev') {
      deployments = await prisma.deployment.findMany();
    } else {
      // Customers see only their own deployments
      deployments = await prisma.deployment.findMany({
        where: { userId: req.user?.id },
      });
    }

    res.json({ deployments });
  }
);

export default router;
