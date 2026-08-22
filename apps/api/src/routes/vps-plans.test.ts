import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import express, { Application } from 'express';
import { vpsPlansRouter } from './vps-plans';
import { prisma } from '../lib/prisma';
import { AuthedRequest } from '../middleware/auth';

// Mock dependencies
vi.mock('../lib/prisma', () => ({
  prisma: {
    vpsPlan: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock('../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock authentication middleware
vi.mock('../middleware/auth', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  },
  AuthedRequest: {},
}));

// Mock RBAC middleware
vi.mock('../middleware/rbac', () => ({
  requireRole: (...roles: string[]) => (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        requiredRoles: roles,
        userRole: req.user.role
      });
    }
    next();
  },
}));

/**
 * VPS Plans CRUD Endpoint Tests
 * 
 * Tests the VPS plans management endpoints to ensure proper:
 * - RBAC enforcement (admin/dev for create/update/delete, all authenticated for read)
 * - Input validation (positive integers for numeric fields)
 * - Database operations
 * - Error handling
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 5.3, 5.4, 5.5**
 */
describe('VPS Plans CRUD Endpoints', () => {
  let app: Application;
  let mockUser: any = null;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Attach mock user to request based on test scenario
    app.use((req: any, res, next) => {
      req.user = mockUser;
      next();
    });
    
    app.use('/api', vpsPlansRouter);
    
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockUser = null;
  });

  describe('GET /api/vps-plans', () => {
    const mockPlans = [
      {
        id: 'plan-1',
        provider: 'leaseweb',
        name: 'Basic VPS',
        bandwidth: '1TB',
        category: 'web_hosting',
        cpuCores: 2,
        ramGb: 4,
        storageGb: 50,
        price: 1000,
        currency: 'LKR',
        billingPeriod: 'monthly',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        leasewebProductCode: 'LW-BASIC',
      },
      {
        id: 'plan-2',
        provider: 'leaseweb',
        name: 'Premium VPS',
        bandwidth: '5TB',
        category: 'app_server',
        cpuCores: 4,
        ramGb: 8,
        storageGb: 100,
        price: 2000,
        currency: 'LKR',
        billingPeriod: 'monthly',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        leasewebProductCode: 'LW-PREMIUM',
      },
    ];

    it('should allow customer to view all VPS plans (Requirement 5.5)', async () => {
      mockUser = {
        id: 'customer-1',
        email: 'customer@example.com',
        role: 'customer',
        firebaseUid: 'firebase-customer',
      };

      vi.mocked(prisma.vpsPlan.findMany).mockResolvedValue(mockPlans);

      const response = await request(app)
        .get('/api/vps-plans');

      // Customer can browse VPS plans
      expect(response.status).toBe(200);
      expect(response.body.plans).toHaveLength(2);
      expect(response.body.plans[0].name).toBe('Basic VPS');
      expect(prisma.vpsPlan.findMany).toHaveBeenCalledWith({
        orderBy: [
          { category: 'asc' },
          { price: 'asc' },
        ],
      });
    });

    it('should allow admin to view all VPS plans', async () => {
      mockUser = {
        id: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
        firebaseUid: 'firebase-admin',
      };

      vi.mocked(prisma.vpsPlan.findMany).mockResolvedValue(mockPlans);

      const response = await request(app)
        .get('/api/vps-plans');

      expect(response.status).toBe(200);
      expect(response.body.plans).toHaveLength(2);
    });

    it('should allow dev to view all VPS plans', async () => {
      mockUser = {
        id: 'dev-1',
        email: 'dev@example.com',
        role: 'dev',
        firebaseUid: 'firebase-dev',
      };

      vi.mocked(prisma.vpsPlan.findMany).mockResolvedValue(mockPlans);

      const response = await request(app)
        .get('/api/vps-plans');

      expect(response.status).toBe(200);
      expect(response.body.plans).toHaveLength(2);
    });

    it('should return empty array when no plans exist', async () => {
      mockUser = {
        id: 'customer-1',
        email: 'customer@example.com',
        role: 'customer',
        firebaseUid: 'firebase-customer',
      };

      vi.mocked(prisma.vpsPlan.findMany).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/vps-plans');

      expect(response.status).toBe(200);
      expect(response.body.plans).toEqual([]);
    });

    it('should handle database errors gracefully', async () => {
      mockUser = {
        id: 'customer-1',
        email: 'customer@example.com',
        role: 'customer',
        firebaseUid: 'firebase-customer',
      };

      vi.mocked(prisma.vpsPlan.findMany).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/vps-plans');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch VPS plans');
    });
  });

  describe('POST /api/vps-plans', () => {
    const validPlanData = {
      provider: 'leaseweb',
      name: 'Test VPS',
      bandwidth: '2TB',
      category: 'web_hosting',
      cpuCores: 4,
      ramGb: 8,
      storageGb: 100,
      price: 1500,
      currency: 'LKR',
      billingPeriod: 'monthly',
      isActive: true,
      leasewebProductCode: 'LW-TEST',
    };

    const mockCreatedPlan = {
      id: 'plan-new',
      ...validPlanData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should allow admin to create VPS plan (Requirement 5.3)', async () => {
      mockUser = {
        id: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
        firebaseUid: 'firebase-admin',
      };

      vi.mocked(prisma.vpsPlan.create).mockResolvedValue(mockCreatedPlan);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      const response = await request(app)
        .post('/api/vps-plans')
        .send(validPlanData);

      expect(response.status).toBe(201);
      expect(response.body.plan.name).toBe('Test VPS');
      expect(prisma.vpsPlan.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          provider: 'leaseweb',
          cpuCores: 4,
          ramGb: 8,
          storageGb: 100,
        }),
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          adminId: 'admin-1',
          action: `vps-plan.create:${mockCreatedPlan.id}`,
          target: mockCreatedPlan.id,
        },
      });
    });

    it('should allow dev to create VPS plan (Requirement 5.3)', async () => {
      mockUser = {
        id: 'dev-1',
        email: 'dev@example.com',
        role: 'dev',
        firebaseUid: 'firebase-dev',
      };

      vi.mocked(prisma.vpsPlan.create).mockResolvedValue(mockCreatedPlan);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      const response = await request(app)
        .post('/api/vps-plans')
        .send(validPlanData);

      expect(response.status).toBe(201);
      expect(response.body.plan.name).toBe('Test VPS');
    });

    it('should prevent customer from creating VPS plan (Requirement 5.3)', async () => {
      mockUser = {
        id: 'customer-1',
        email: 'customer@example.com',
        role: 'customer',
        firebaseUid: 'firebase-customer',
      };

      const response = await request(app)
        .post('/api/vps-plans')
        .send(validPlanData);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Insufficient permissions');
      expect(response.body.requiredRoles).toEqual(['admin', 'dev']);
      expect(prisma.vpsPlan.create).not.toHaveBeenCalled();
    });

    it('should validate positive CPU cores (Requirement 2.3)', async () => {
      mockUser = {
        id: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
        firebaseUid: 'firebase-admin',
      };

      const response = await request(app)
        .post('/api/vps-plans')
        .send({
          ...validPlanData,
          cpuCores: -1, // Invalid: negative
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid VPS plan data');
      expect(prisma.vpsPlan.create).not.toHaveBeenCalled();
    });

    it('should validate positive RAM (Requirement 2.3)', async () => {
      mockUser = {
        id: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
        firebaseUid: 'firebase-admin',
      };

      const response = await request(app)
        .post('/api/vps-plans')
        .send({
          ...validPlanData,
          ramGb: 0, // Invalid: zero
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid VPS plan data');
      expect(prisma.vpsPlan.create).not.toHaveBeenCalled();
    });

    it('should validate positive storage (Requirement 2.3)', async () => {
      mockUser = {
        id: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
        firebaseUid: 'firebase-admin',
      };

      
      const response = await request(app)
        .post('/api/vps-plans')
        .send({
          ...validPlanData,
          storageGb: -50, // Invalid: negative
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid VPS plan data');
      expect(prisma.vpsPlan.create).not.toHaveBeenCalled();
    });

    it('should validate positive price (Requirement 2.3)', async () => {
      mockUser = {
        id: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
        firebaseUid: 'firebase-admin',
      };

      
      const response = await request(app)
        .post('/api/vps-plans')
        .send({
          ...validPlanData,
          price: 0, // Invalid: zero
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid VPS plan data');
      expect(prisma.vpsPlan.create).not.toHaveBeenCalled();
    });

    it('should validate category enum (Requirement 2.4)', async () => {
      mockUser = {
        id: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
        firebaseUid: 'firebase-admin',
      };

      
      const response = await request(app)
        .post('/api/vps-plans')
        .send({
          ...validPlanData,
          category: 'invalid_category', // Invalid: not in enum
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid VPS plan data');
      expect(prisma.vpsPlan.create).not.toHaveBeenCalled();
    });

    it('should require provider name (Requirement 2.1)', async () => {
      mockUser = {
        id: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
        firebaseUid: 'firebase-admin',
      };

      
      const response = await request(app)
        .post('/api/vps-plans')
        .send({
          ...validPlanData,
          provider: '', // Invalid: empty
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid VPS plan data');
      expect(prisma.vpsPlan.create).not.toHaveBeenCalled();
    });

    it('should require bandwidth specification (Requirement 2.1)', async () => {
      mockUser = {
        id: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
        firebaseUid: 'firebase-admin',
      };

      
      const response = await request(app)
        .post('/api/vps-plans')
        .send({
          ...validPlanData,
          bandwidth: '', // Invalid: empty
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid VPS plan data');
      expect(prisma.vpsPlan.create).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /api/vps-plans/:id', () => {
    const existingPlan = {
      id: 'plan-1',
      provider: 'leaseweb',
      name: 'Existing VPS',
      bandwidth: '1TB',
      category: 'web_hosting',
      cpuCores: 2,
      ramGb: 4,
      storageGb: 50,
      price: 1000,
      currency: 'LKR',
      billingPeriod: 'monthly',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      leasewebProductCode: 'LW-EXIST',
    };

    const updatedPlan = {
      ...existingPlan,
      name: 'Updated VPS',
      ramGb: 8,
    };

    it('should allow admin to update VPS plan (Requirement 5.4)', async () => {
      mockUser = {
        id: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
        firebaseUid: 'firebase-admin',
      };

      
      vi.mocked(prisma.vpsPlan.findUnique).mockResolvedValue(existingPlan);
      vi.mocked(prisma.vpsPlan.update).mockResolvedValue(updatedPlan);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      const response = await request(app)
        .patch('/api/vps-plans/plan-1')
        .send({
          name: 'Updated VPS',
          ramGb: 8,
        });

      expect(response.status).toBe(200);
      expect(response.body.plan.name).toBe('Updated VPS');
      expect(response.body.plan.ramGb).toBe(8);
      expect(prisma.vpsPlan.update).toHaveBeenCalledWith({
        where: { id: 'plan-1' },
        data: {
          name: 'Updated VPS',
          ramGb: 8,
        },
      });
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('should allow dev to update VPS plan (Requirement 5.4)', async () => {
      mockUser = {
        id: 'dev-1',
        email: 'dev@example.com',
        role: 'dev',
        firebaseUid: 'firebase-dev',
      };

      
      vi.mocked(prisma.vpsPlan.findUnique).mockResolvedValue(existingPlan);
      vi.mocked(prisma.vpsPlan.update).mockResolvedValue(updatedPlan);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      const response = await request(app)
        .patch('/api/vps-plans/plan-1')
        .send({
          name: 'Updated VPS',
        });

      expect(response.status).toBe(200);
      expect(response.body.plan.name).toBe('Updated VPS');
    });

    it('should prevent customer from updating VPS plan (Requirement 5.4)', async () => {
      mockUser = {
        id: 'customer-1',
        email: 'customer@example.com',
        role: 'customer',
        firebaseUid: 'firebase-customer',
      };

      
      const response = await request(app)
        .patch('/api/vps-plans/plan-1')
        .send({
          name: 'Updated VPS',
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Insufficient permissions');
      expect(prisma.vpsPlan.update).not.toHaveBeenCalled();
    });

    it('should return 404 for non-existent plan', async () => {
      mockUser = {
        id: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
        firebaseUid: 'firebase-admin',
      };

      
      vi.mocked(prisma.vpsPlan.findUnique).mockResolvedValue(null);

      const response = await request(app)
        .patch('/api/vps-plans/non-existent')
        .send({
          name: 'Updated VPS',
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('VPS plan not found');
      expect(prisma.vpsPlan.update).not.toHaveBeenCalled();
    });

    it('should validate positive values on update (Requirement 2.3)', async () => {
      mockUser = {
        id: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
        firebaseUid: 'firebase-admin',
      };

      
      vi.mocked(prisma.vpsPlan.findUnique).mockResolvedValue(existingPlan);

      const response = await request(app)
        .patch('/api/vps-plans/plan-1')
        .send({
          cpuCores: -4, // Invalid: negative
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid VPS plan data');
      expect(prisma.vpsPlan.update).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/vps-plans/:id', () => {
    const existingPlan = {
      id: 'plan-1',
      provider: 'leaseweb',
      name: 'Plan to Delete',
      bandwidth: '1TB',
      category: 'web_hosting',
      cpuCores: 2,
      ramGb: 4,
      storageGb: 50,
      price: 1000,
      currency: 'LKR',
      billingPeriod: 'monthly',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      leasewebProductCode: null,
    };

    it('should allow admin to delete VPS plan (Requirement 5.3)', async () => {
      mockUser = {
        id: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
        firebaseUid: 'firebase-admin',
      };

      
      vi.mocked(prisma.vpsPlan.findUnique).mockResolvedValue(existingPlan);
      vi.mocked(prisma.vpsPlan.delete).mockResolvedValue(existingPlan);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      const response = await request(app)
        .delete('/api/vps-plans/plan-1')
        ;

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.id).toBe('plan-1');
      expect(prisma.vpsPlan.delete).toHaveBeenCalledWith({
        where: { id: 'plan-1' },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          adminId: 'admin-1',
          action: 'vps-plan.delete:plan-1',
          target: 'plan-1',
        },
      });
    });

    it('should allow dev to delete VPS plan (Requirement 5.3)', async () => {
      mockUser = {
        id: 'dev-1',
        email: 'dev@example.com',
        role: 'dev',
        firebaseUid: 'firebase-dev',
      };

      
      vi.mocked(prisma.vpsPlan.findUnique).mockResolvedValue(existingPlan);
      vi.mocked(prisma.vpsPlan.delete).mockResolvedValue(existingPlan);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      const response = await request(app)
        .delete('/api/vps-plans/plan-1')
        ;

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should prevent customer from deleting VPS plan (Requirement 5.3)', async () => {
      mockUser = {
        id: 'customer-1',
        email: 'customer@example.com',
        role: 'customer',
        firebaseUid: 'firebase-customer',
      };

      
      const response = await request(app)
        .delete('/api/vps-plans/plan-1')
        ;

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Insufficient permissions');
      expect(prisma.vpsPlan.delete).not.toHaveBeenCalled();
    });

    it('should return 404 for non-existent plan', async () => {
      mockUser = {
        id: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
        firebaseUid: 'firebase-admin',
      };

      
      vi.mocked(prisma.vpsPlan.findUnique).mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/vps-plans/non-existent')
        ;

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('VPS plan not found');
      expect(prisma.vpsPlan.delete).not.toHaveBeenCalled();
    });
  });
});




