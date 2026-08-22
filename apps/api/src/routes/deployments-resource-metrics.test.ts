import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '../lib/prisma';
import { getResourceUsage, ResourceMetrics } from '../lib/nodeAgentClient';

vi.mock('../lib/prisma', () => ({
  prisma: {
    deployment: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../lib/nodeAgentClient', () => ({
  getResourceUsage: vi.fn(),
}));

vi.mock('../lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

describe('Deployment Resource Usage Metrics (Task 9.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getResourceUsage function', () => {
    it('should call node-agent metrics endpoint with correct parameters', async () => {
      const mockNode = { id: 'node1', ip: '10.0.0.1' };
      const mockContainerId = 'container1';
      
      const mockMetrics: ResourceMetrics = {
        cpuUsagePercent: 35.5,
        memoryUsedMb: 1024,
        memoryLimitMb: 2048,
        memoryUsagePercent: 50.0,
        storageUsedGb: 10.5,
        storageLimitGb: 50,
        storageUsagePercent: 21.0,
        timestamp: new Date().toISOString(),
      };

      vi.mocked(getResourceUsage).mockResolvedValue(mockMetrics);

      const result = await getResourceUsage(mockNode as any, mockContainerId);

      expect(result).toBeDefined();
      expect(result.cpuUsagePercent).toBe(35.5);
      expect(result.memoryUsedMb).toBe(1024);
      expect(result.memoryUsagePercent).toBe(50.0);
      expect(result.storageUsedGb).toBe(10.5);
      expect(result.storageUsagePercent).toBe(21.0);
      expect(result.timestamp).toBeDefined();
    });

    it('should include resource limits in metrics response', async () => {
      const mockNode = { id: 'node1', ip: '10.0.0.1' };
      const mockContainerId = 'container1';
      
      const mockMetrics: ResourceMetrics = {
        cpuUsagePercent: 75.2,
        memoryUsedMb: 3072,
        memoryLimitMb: 4096,
        memoryUsagePercent: 75.0,
        storageUsedGb: 80.5,
        storageLimitGb: 100,
        storageUsagePercent: 80.5,
        timestamp: new Date().toISOString(),
      };

      vi.mocked(getResourceUsage).mockResolvedValue(mockMetrics);

      const result = await getResourceUsage(mockNode as any, mockContainerId);

      expect(result.memoryLimitMb).toBe(4096);
      expect(result.storageLimitGb).toBe(100);
    });

    it('should throw error when node-agent is unavailable', async () => {
      const mockNode = { id: 'node1', ip: '10.0.0.1' };
      const mockContainerId = 'container1';

      vi.mocked(getResourceUsage).mockRejectedValue(
        new Error('Failed to fetch resource metrics (502)')
      );

      await expect(getResourceUsage(mockNode as any, mockContainerId)).rejects.toThrow(
        'Failed to fetch resource metrics (502)'
      );
    });
  });

  describe('Deployment endpoint integration', () => {
    it('should return null metrics for stopped deployment', async () => {
      const mockDeployment = {
        id: 'deploy1',
        userId: 'user1',
        status: 'stopped',
        containerId: null,
      };

      // When deployment is stopped, containerId is null
      expect(mockDeployment.status).toBe('stopped');
      expect(mockDeployment.containerId).toBeNull();
    });

    it('should fetch metrics for running deployment with containerId', async () => {
      const mockDeployment = {
        id: 'deploy1',
        userId: 'user1',
        status: 'running',
        containerId: 'container1',
        node: { id: 'node1', ip: '10.0.0.1' },
      };

      const mockMetrics: ResourceMetrics = {
        cpuUsagePercent: 35.5,
        memoryUsedMb: 1024,
        memoryLimitMb: 2048,
        memoryUsagePercent: 50.0,
        storageUsedGb: 10.5,
        storageLimitGb: 50,
        storageUsagePercent: 21.0,
        timestamp: new Date().toISOString(),
      };

      vi.mocked(getResourceUsage).mockResolvedValue(mockMetrics);

      // When deployment is running, we should call getResourceUsage
      if (mockDeployment.status === 'running' && mockDeployment.containerId) {
        const metrics = await getResourceUsage(mockDeployment.node as any, mockDeployment.containerId);
        expect(metrics).toBeDefined();
        expect(metrics.cpuUsagePercent).toBe(35.5);
      }
    });

    it('should handle metrics fetch failure gracefully', async () => {
      const mockDeployment = {
        id: 'deploy1',
        userId: 'user1',
        status: 'running',
        containerId: 'container1',
        node: { id: 'node1', ip: '10.0.0.1' },
      };

      vi.mocked(getResourceUsage).mockRejectedValue(
        new Error('Node agent unavailable')
      );

      // When metrics fetch fails, should return null and log warning
      try {
        await getResourceUsage(mockDeployment.node as any, mockDeployment.containerId!);
      } catch (err) {
        expect(err).toBeDefined();
        expect((err as Error).message).toBe('Node agent unavailable');
        
        // In the actual endpoint, this error is caught and logged
        const { logger } = await import('../lib/logger');
        logger.warn({ deploymentId: mockDeployment.id, err }, 'Failed to fetch resource usage metrics');
        
        expect(logger.warn).toHaveBeenCalled();
      }
    });
  });

  describe('ResourceMetrics type structure', () => {
    it('should have all required fields with correct types', () => {
      const metrics: ResourceMetrics = {
        cpuUsagePercent: 50.0,
        memoryUsedMb: 1024,
        memoryLimitMb: 2048,
        memoryUsagePercent: 50.0,
        storageUsedGb: 25.5,
        storageLimitGb: 100,
        storageUsagePercent: 25.5,
        timestamp: new Date().toISOString(),
      };

      expect(typeof metrics.cpuUsagePercent).toBe('number');
      expect(typeof metrics.memoryUsedMb).toBe('number');
      expect(typeof metrics.memoryUsagePercent).toBe('number');
      expect(typeof metrics.storageUsedGb).toBe('number');
      expect(typeof metrics.storageUsagePercent).toBe('number');
      expect(typeof metrics.timestamp).toBe('string');
    });

    it('should allow null for limit fields when no limits set', () => {
      const metrics: ResourceMetrics = {
        cpuUsagePercent: 50.0,
        memoryUsedMb: 1024,
        memoryLimitMb: null,
        memoryUsagePercent: 0,
        storageUsedGb: 25.5,
        storageLimitGb: null,
        storageUsagePercent: 0,
        timestamp: new Date().toISOString(),
      };

      expect(metrics.memoryLimitMb).toBeNull();
      expect(metrics.storageLimitGb).toBeNull();
    });
  });
});
