import { Request, Response, NextFunction } from 'express';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { requireRole, verifyResourceOwnership, isSupportStaff, hasInfrastructureAccess, UserRole } from './rbac';
import { AuthedRequest } from './auth';

describe('RBAC Middleware', () => {
  let mockRequest: Partial<AuthedRequest>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    
    mockRequest = {};
    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };
    nextFunction = vi.fn();
  });

  describe('requireRole', () => {
    it('should call next() when user has required role', () => {
      mockRequest.user = {
        id: 'user-1',
        firebaseUid: 'firebase-1',
        email: 'admin@example.com',
        role: 'admin',
      };

      const middleware = requireRole('admin', 'dev');
      middleware(mockRequest as AuthedRequest, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should call next() when user has one of multiple required roles', () => {
      mockRequest.user = {
        id: 'user-2',
        firebaseUid: 'firebase-2',
        email: 'dev@example.com',
        role: 'dev',
      };

      const middleware = requireRole('admin', 'dev');
      middleware(mockRequest as AuthedRequest, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should return 403 when user lacks required role', () => {
      mockRequest.user = {
        id: 'user-3',
        firebaseUid: 'firebase-3',
        email: 'customer@example.com',
        role: 'customer',
      };

      const middleware = requireRole('admin', 'dev');
      middleware(mockRequest as AuthedRequest, mockResponse as Response, nextFunction);

      expect(nextFunction).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Insufficient permissions',
          requiredRoles: ['admin', 'dev'],
          userRole: 'customer',
        })
      );
    });

    it('should return 401 when user is not authenticated', () => {
      mockRequest.user = undefined;

      const middleware = requireRole('admin');
      middleware(mockRequest as AuthedRequest, mockResponse as Response, nextFunction);

      expect(nextFunction).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Authentication required',
        })
      );
    });

    it('should work with single role parameter', () => {
      mockRequest.user = {
        id: 'user-4',
        firebaseUid: 'firebase-4',
        email: 'customer@example.com',
        role: 'customer',
      };

      const middleware = requireRole('customer');
      middleware(mockRequest as AuthedRequest, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should work with all four role types', () => {
      const roles: UserRole[] = ['customer', 'admin', 'support', 'dev'];

      roles.forEach((role) => {
        vi.clearAllMocks();
        
        mockRequest.user = {
          id: `user-${role}`,
          firebaseUid: `firebase-${role}`,
          email: `${role}@example.com`,
          role,
        };

        const middleware = requireRole(role);
        middleware(mockRequest as AuthedRequest, mockResponse as Response, nextFunction);

        expect(nextFunction).toHaveBeenCalled();
      });
    });

    it('should provide descriptive error message with role information', () => {
      mockRequest.user = {
        id: 'user-5',
        firebaseUid: 'firebase-5',
        email: 'support@example.com',
        role: 'support',
      };

      const middleware = requireRole('admin', 'dev');
      middleware(mockRequest as AuthedRequest, mockResponse as Response, nextFunction);

      const callArg = jsonMock.mock.calls[0][0];
      expect(callArg.message).toContain('admin, dev');
      expect(callArg.message).toContain('support');
    });
  });

  describe('verifyResourceOwnership', () => {
    it('should return true when user owns the resource', () => {
      mockRequest.user = {
        id: 'user-1',
        firebaseUid: 'firebase-1',
        email: 'customer@example.com',
        role: 'customer',
      };

      const result = verifyResourceOwnership(
        'user-1',
        mockRequest as AuthedRequest,
        mockResponse as Response
      );

      expect(result).toBe(true);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should return 404 when customer tries to access another customers resource', () => {
      mockRequest.user = {
        id: 'user-1',
        firebaseUid: 'firebase-1',
        email: 'customer@example.com',
        role: 'customer',
      };

      const result = verifyResourceOwnership(
        'user-2',
        mockRequest as AuthedRequest,
        mockResponse as Response
      );

      expect(result).toBe(false);
      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Resource not found',
        })
      );
    });

    it('should return true when admin accesses any resource', () => {
      mockRequest.user = {
        id: 'admin-1',
        firebaseUid: 'firebase-admin',
        email: 'admin@example.com',
        role: 'admin',
      };

      const result = verifyResourceOwnership(
        'user-1',
        mockRequest as AuthedRequest,
        mockResponse as Response
      );

      expect(result).toBe(true);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should return true when dev accesses any resource', () => {
      mockRequest.user = {
        id: 'dev-1',
        firebaseUid: 'firebase-dev',
        email: 'dev@example.com',
        role: 'dev',
      };

      const result = verifyResourceOwnership(
        'user-1',
        mockRequest as AuthedRequest,
        mockResponse as Response
      );

      expect(result).toBe(true);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should return 404 when support tries to access resource they dont own', () => {
      mockRequest.user = {
        id: 'support-1',
        firebaseUid: 'firebase-support',
        email: 'support@example.com',
        role: 'support',
      };

      const result = verifyResourceOwnership(
        'user-1',
        mockRequest as AuthedRequest,
        mockResponse as Response
      );

      expect(result).toBe(false);
      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it('should not reveal resource existence to unauthorized customers (404 not 403)', () => {
      mockRequest.user = {
        id: 'user-1',
        firebaseUid: 'firebase-1',
        email: 'customer@example.com',
        role: 'customer',
      };

      verifyResourceOwnership(
        'user-2',
        mockRequest as AuthedRequest,
        mockResponse as Response
      );

      // Critical security requirement: return 404, not 403
      expect(statusMock).toHaveBeenCalledWith(404);
      expect(statusMock).not.toHaveBeenCalledWith(403);
    });
  });

  describe('isSupportStaff', () => {
    it('should return true for admin role', () => {
      mockRequest.user = {
        id: 'admin-1',
        firebaseUid: 'firebase-admin',
        email: 'admin@example.com',
        role: 'admin',
      };

      expect(isSupportStaff(mockRequest as AuthedRequest)).toBe(true);
    });

    it('should return true for support role', () => {
      mockRequest.user = {
        id: 'support-1',
        firebaseUid: 'firebase-support',
        email: 'support@example.com',
        role: 'support',
      };

      expect(isSupportStaff(mockRequest as AuthedRequest)).toBe(true);
    });

    it('should return true for dev role', () => {
      mockRequest.user = {
        id: 'dev-1',
        firebaseUid: 'firebase-dev',
        email: 'dev@example.com',
        role: 'dev',
      };

      expect(isSupportStaff(mockRequest as AuthedRequest)).toBe(true);
    });

    it('should return false for customer role', () => {
      mockRequest.user = {
        id: 'user-1',
        firebaseUid: 'firebase-1',
        email: 'customer@example.com',
        role: 'customer',
      };

      expect(isSupportStaff(mockRequest as AuthedRequest)).toBe(false);
    });

    it('should return false when user is undefined', () => {
      mockRequest.user = undefined;

      expect(isSupportStaff(mockRequest as AuthedRequest)).toBe(false);
    });
  });

  describe('hasInfrastructureAccess', () => {
    it('should return true for admin role', () => {
      mockRequest.user = {
        id: 'admin-1',
        firebaseUid: 'firebase-admin',
        email: 'admin@example.com',
        role: 'admin',
      };

      expect(hasInfrastructureAccess(mockRequest as AuthedRequest)).toBe(true);
    });

    it('should return true for dev role', () => {
      mockRequest.user = {
        id: 'dev-1',
        firebaseUid: 'firebase-dev',
        email: 'dev@example.com',
        role: 'dev',
      };

      expect(hasInfrastructureAccess(mockRequest as AuthedRequest)).toBe(true);
    });

    it('should return false for support role', () => {
      mockRequest.user = {
        id: 'support-1',
        firebaseUid: 'firebase-support',
        email: 'support@example.com',
        role: 'support',
      };

      expect(hasInfrastructureAccess(mockRequest as AuthedRequest)).toBe(false);
    });

    it('should return false for customer role', () => {
      mockRequest.user = {
        id: 'user-1',
        firebaseUid: 'firebase-1',
        email: 'customer@example.com',
        role: 'customer',
      };

      expect(hasInfrastructureAccess(mockRequest as AuthedRequest)).toBe(false);
    });

    it('should return false when user is undefined', () => {
      mockRequest.user = undefined;

      expect(hasInfrastructureAccess(mockRequest as AuthedRequest)).toBe(false);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle catalog creation scenario (admin and dev only)', () => {
      const middleware = requireRole('admin', 'dev');

      // Admin should succeed
      mockRequest.user = {
        id: 'admin-1',
        firebaseUid: 'firebase-admin',
        email: 'admin@example.com',
        role: 'admin',
      };
      middleware(mockRequest as AuthedRequest, mockResponse as Response, nextFunction);
      expect(nextFunction).toHaveBeenCalled();

      vi.clearAllMocks();

      // Dev should succeed
      mockRequest.user = {
        id: 'dev-1',
        firebaseUid: 'firebase-dev',
        email: 'dev@example.com',
        role: 'dev',
      };
      middleware(mockRequest as AuthedRequest, mockResponse as Response, nextFunction);
      expect(nextFunction).toHaveBeenCalled();

      vi.clearAllMocks();

      // Customer should fail
      mockRequest.user = {
        id: 'user-1',
        firebaseUid: 'firebase-1',
        email: 'customer@example.com',
        role: 'customer',
      };
      middleware(mockRequest as AuthedRequest, mockResponse as Response, nextFunction);
      expect(nextFunction).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(403);
    });

    it('should handle deployment access scenario (customers see only their own)', () => {
      const deploymentOwnerId = 'user-1';

      // Owner customer should have access
      mockRequest.user = {
        id: 'user-1',
        firebaseUid: 'firebase-1',
        email: 'customer@example.com',
        role: 'customer',
      };
      expect(
        verifyResourceOwnership(deploymentOwnerId, mockRequest as AuthedRequest, mockResponse as Response)
      ).toBe(true);

      vi.clearAllMocks();

      // Different customer should get 404
      mockRequest.user = {
        id: 'user-2',
        firebaseUid: 'firebase-2',
        email: 'customer2@example.com',
        role: 'customer',
      };
      expect(
        verifyResourceOwnership(deploymentOwnerId, mockRequest as AuthedRequest, mockResponse as Response)
      ).toBe(false);
      expect(statusMock).toHaveBeenCalledWith(404);

      vi.clearAllMocks();

      // Admin should have access to any deployment
      mockRequest.user = {
        id: 'admin-1',
        firebaseUid: 'firebase-admin',
        email: 'admin@example.com',
        role: 'admin',
      };
      expect(
        verifyResourceOwnership(deploymentOwnerId, mockRequest as AuthedRequest, mockResponse as Response)
      ).toBe(true);
    });
  });
});
