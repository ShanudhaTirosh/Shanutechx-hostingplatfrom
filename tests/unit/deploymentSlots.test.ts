import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  isHostingOrderItem,
  splitOrderItemsIntoUnits,
  getAvailableDeploymentSlots,
  claimDeploymentSlot,
  DeploymentSlotError,
} from '../../apps/api/src/lib/deploymentSlots';
import { prisma } from '../../apps/api/src/lib/prisma';

describe('1-to-1 Deployment Slot Enforcement Suite', () => {
  describe('isHostingOrderItem category discrimination', () => {
    it('identifies web_hosting, node_hosting, python_hosting, and bot_hosting as hosting items', () => {
      assert.equal(
        isHostingOrderItem({ plan: { product: { category: 'web_hosting', name: 'Starter Web' } } }),
        true
      );
      assert.equal(
        isHostingOrderItem({ plan: { product: { category: 'node_hosting', name: 'Express Server' } } }),
        true
      );
      assert.equal(
        isHostingOrderItem({ plan: { product: { category: 'bot_hosting', name: 'Discord Bot' } } }),
        true
      );
      assert.equal(
        isHostingOrderItem({ plan: { product: { category: 'docker_hosting', name: 'Container Slot' } } }),
        true
      );
      assert.equal(
        isHostingOrderItem({ plan: { product: { category: 'app_catalog', name: 'WordPress One-Click' } } }),
        true
      );
    });

    it('correctly discriminates VPS, SMTP Mailboxes, and Managed Databases as non-hosting items', () => {
      // VPS
      assert.equal(
        isHostingOrderItem({ plan: { product: { category: 'vps', name: 'VPS Server 4GB' } } }),
        false
      );
      assert.equal(
        isHostingOrderItem({ service: { name: 'Leaseweb VPS', serviceType: 'vps' } }),
        false
      );

      // SMTP / Mailbox
      assert.equal(
        isHostingOrderItem({ plan: { product: { category: 'smtp', name: 'Starter Mailbox' } } }),
        false
      );
      assert.equal(
        isHostingOrderItem({ plan: { product: { category: 'email', name: 'Business Email' } } }),
        false
      );
      assert.equal(
        isHostingOrderItem({ service: { name: 'Custom SMTP Server', serviceType: 'smtp' } }),
        false
      );

      // Managed Database
      assert.equal(
        isHostingOrderItem({ plan: { product: { category: 'database', name: 'PostgreSQL DB' } } }),
        false
      );
      assert.equal(
        isHostingOrderItem({ plan: { product: { category: 'database', name: 'MongoDB Managed' } } }),
        false
      );
    });
  });

  describe('splitOrderItemsIntoUnits multi-quantity order splitting', () => {
    it('leaves single-quantity items untouched', async () => {
      let updateCalls: any[] = [];
      let createCalls: any[] = [];

      const originalFindMany = prisma.orderItem.findMany;
      const originalUpdate = prisma.orderItem.update;
      const originalCreate = prisma.orderItem.create;

      (prisma.orderItem as any).findMany = async () => [];
      (prisma.orderItem as any).update = async (args: any) => { updateCalls.push(args); };
      (prisma.orderItem as any).create = async (args: any) => { createCalls.push(args); };

      try {
        await splitOrderItemsIntoUnits('order-1');
        assert.equal(updateCalls.length, 0);
        assert.equal(createCalls.length, 0);
      } finally {
        (prisma.orderItem as any).findMany = originalFindMany;
        (prisma.orderItem as any).update = originalUpdate;
        (prisma.orderItem as any).create = originalCreate;
      }
    });

    it('splits quantity=3 item into 1 updated item and 2 newly created unit records', async () => {
      const updateCalls: any[] = [];
      const createCalls: any[] = [];

      const originalFindMany = prisma.orderItem.findMany;
      const originalUpdate = prisma.orderItem.update;
      const originalCreate = prisma.orderItem.create;

      (prisma.orderItem as any).findMany = async () => [
        {
          id: 'item-1',
          orderId: 'order-1',
          planId: 'plan-starter',
          serviceId: null,
          priceLkr: 1500,
          quantity: 3,
          configJson: { env: 'production' },
        },
      ];
      (prisma.orderItem as any).update = async (args: any) => {
        updateCalls.push(args);
        return args;
      };
      (prisma.orderItem as any).create = async (args: any) => {
        createCalls.push(args);
        return { id: `item-new-${createCalls.length}`, ...args.data };
      };

      try {
        await splitOrderItemsIntoUnits('order-1');

        // Original row updated to quantity 1
        assert.equal(updateCalls.length, 1);
        assert.deepEqual(updateCalls[0], {
          where: { id: 'item-1' },
          data: { quantity: 1 },
        });

        // 2 new individual rows created with quantity 1
        assert.equal(createCalls.length, 2);
        for (const call of createCalls) {
          assert.equal(call.data.orderId, 'order-1');
          assert.equal(call.data.planId, 'plan-starter');
          assert.equal(call.data.priceLkr, 1500);
          assert.equal(call.data.quantity, 1);
          assert.deepEqual(call.data.configJson, { env: 'production' });
        }
      } finally {
        (prisma.orderItem as any).findMany = originalFindMany;
        (prisma.orderItem as any).update = originalUpdate;
        (prisma.orderItem as any).create = originalCreate;
      }
    });
  });

  describe('getAvailableDeploymentSlots tracking', () => {
    it('accurately tallies total, used, and available slots', async () => {
      const originalFindMany = prisma.orderItem.findMany;

      (prisma.orderItem as any).findMany = async () => [
        {
          id: 'item-slot-1',
          orderId: 'order-101',
          priceLkr: 2000,
          order: { userId: 'user-1', status: 'paid', createdAt: new Date() },
          plan: { name: 'Pro Web Hosting', product: { category: 'web_hosting' } },
          service: null,
          deployment: { id: 'dep-1', subdomain: 'my-app', status: 'running' },
        },
        {
          id: 'item-slot-2',
          orderId: 'order-101',
          priceLkr: 2000,
          order: { userId: 'user-1', status: 'paid', createdAt: new Date() },
          plan: { name: 'Pro Web Hosting', product: { category: 'web_hosting' } },
          service: null,
          deployment: null, // Unused available slot
        },
        {
          id: 'item-vps',
          orderId: 'order-102',
          priceLkr: 8000,
          order: { userId: 'user-1', status: 'paid', createdAt: new Date() },
          plan: { name: 'Dedicated VPS', product: { category: 'vps' } },
          service: null,
          deployment: null,
        },
      ];

      try {
        const result = await getAvailableDeploymentSlots('user-1');
        // item-vps is excluded as non-hosting
        assert.equal(result.totalSlots, 2);
        assert.equal(result.usedSlots, 1);
        assert.equal(result.availableSlots, 1);
        assert.equal(result.slots[0].isUsed, true);
        assert.equal(result.slots[1].isUsed, false);
      } finally {
        (prisma.orderItem as any).findMany = originalFindMany;
      }
    });
  });

  describe('claimDeploymentSlot validation & server-side enforcement', () => {
    it('bypasses slot consumption for preview branch environments', async () => {
      const result = await claimDeploymentSlot('user-1', { isPreview: true });
      assert.deepEqual(result, { orderItemId: null });
    });

    it('bypasses slot consumption for admin and dev superusers', async () => {
      const result = await claimDeploymentSlot('dev-user', { isAdminOrDev: true });
      assert.deepEqual(result, { orderItemId: null });
    });

    it('allocates the first available unbound slot for a regular user with purchased units', async () => {
      const originalFindMany = prisma.orderItem.findMany;

      (prisma.orderItem as any).findMany = async () => [
        {
          id: 'item-available-1',
          orderId: 'order-200',
          order: { userId: 'cust-1', status: 'paid' },
          plan: { name: 'Standard Web Hosting', product: { category: 'web_hosting' } },
          service: null,
        },
      ];

      try {
        const result = await claimDeploymentSlot('cust-1', { isAdminOrDev: false });
        assert.deepEqual(result, { orderItemId: 'item-available-1' });
      } finally {
        (prisma.orderItem as any).findMany = originalFindMany;
      }
    });

    it('throws HTTP 403 when customer has no available deployment slots', async () => {
      const originalFindMany = prisma.orderItem.findMany;

      (prisma.orderItem as any).findMany = async () => [];

      try {
        await assert.rejects(
          async () => {
            await claimDeploymentSlot('cust-no-slots', { isAdminOrDev: false });
          },
          (err: any) => {
            assert.ok(err instanceof DeploymentSlotError);
            assert.equal(err.statusCode, 403);
            assert.match(err.message, /No available deployment slots/);
            assert.match(err.message, /Each purchased unit grants exactly one deployment/);
            return true;
          }
        );
      } finally {
        (prisma.orderItem as any).findMany = originalFindMany;
      }
    });

    it('throws HTTP 403 when user attempts to reuse a slot already bound to a deployment', async () => {
      const originalFindUnique = prisma.orderItem.findUnique;

      (prisma.orderItem as any).findUnique = async () => ({
        id: 'item-already-used',
        orderId: 'order-300',
        order: { userId: 'cust-1', status: 'paid' },
        plan: { name: 'Cloud App Slot', product: { category: 'web_hosting' } },
        service: null,
        deployment: { id: 'dep-existing-1', status: 'running' },
      });

      try {
        await assert.rejects(
          async () => {
            await claimDeploymentSlot('cust-1', { preferredOrderItemId: 'item-already-used' });
          },
          (err: any) => {
            assert.ok(err instanceof DeploymentSlotError);
            assert.equal(err.statusCode, 403);
            assert.match(err.message, /already bound to deployment dep-existing-1 and cannot be reused/);
            return true;
          }
        );
      } finally {
        (prisma.orderItem as any).findUnique = originalFindUnique;
      }
    });

    it('throws HTTP 403 when user attempts to claim another user’s slot', async () => {
      const originalFindUnique = prisma.orderItem.findUnique;

      (prisma.orderItem as any).findUnique = async () => ({
        id: 'item-other-user',
        orderId: 'order-301',
        order: { userId: 'victim-user', status: 'paid' },
        plan: { name: 'Cloud App Slot', product: { category: 'web_hosting' } },
        service: null,
        deployment: null,
      });

      try {
        await assert.rejects(
          async () => {
            await claimDeploymentSlot('attacker-user', { preferredOrderItemId: 'item-other-user' });
          },
          (err: any) => {
            assert.ok(err instanceof DeploymentSlotError);
            assert.equal(err.statusCode, 403);
            assert.match(err.message, /do not own this purchase record/);
            return true;
          }
        );
      } finally {
        (prisma.orderItem as any).findUnique = originalFindUnique;
      }
    });

    it('throws HTTP 403 when user attempts to claim an unpaid order slot', async () => {
      const originalFindUnique = prisma.orderItem.findUnique;

      (prisma.orderItem as any).findUnique = async () => ({
        id: 'item-unpaid',
        orderId: 'order-302',
        order: { userId: 'cust-1', status: 'awaiting_payment' },
        plan: { name: 'Cloud App Slot', product: { category: 'web_hosting' } },
        service: null,
        deployment: null,
      });

      try {
        await assert.rejects(
          async () => {
            await claimDeploymentSlot('cust-1', { preferredOrderItemId: 'item-unpaid' });
          },
          (err: any) => {
            assert.ok(err instanceof DeploymentSlotError);
            assert.equal(err.statusCode, 403);
            assert.match(err.message, /Payment for this order has not been completed/);
            return true;
          }
        );
      } finally {
        (prisma.orderItem as any).findUnique = originalFindUnique;
      }
    });
  });
});
