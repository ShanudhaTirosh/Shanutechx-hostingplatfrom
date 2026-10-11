import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { logger } from '../lib/logger';

export const vpsPlansRouter = Router();
vpsPlansRouter.use('/vps-plans', requireAuth);

/**
 * Validation schema for VPS plan creation and updates.
 * Validates that numeric fields are positive integers with appropriate constraints.
 */
const vpsplanSchema = z.object({
  provider: z.string().min(1, 'Provider name is required'),
  name: z.string().min(1, 'Plan name is required'),
  bandwidth: z.string().min(1, 'Bandwidth specification is required'),
  category: z.enum(['web_hosting', 'app_server', 'database_server', 'storage_server'], {
    errorMap: () => ({ message: 'Category must be one of: web_hosting, app_server, database_server, storage_server' })
  }),
  cpuCores: z.number().int().positive('CPU cores must be a positive integer'),
  ramGb: z.number().int().positive('RAM must be a positive integer (GB)'),
  storageGb: z.number().int().positive('Storage must be a positive integer (GB)'),
  price: z.number().int().positive('Price must be a positive integer'),
  currency: z.enum(['LKR', 'USD']).default('LKR'),
  billingPeriod: z.enum(['one_time', 'monthly', 'yearly']).default('monthly'),
  isActive: z.boolean().default(true),
  leasewebProductCode: z.string().optional(),
});

const updateVpsPlanSchema = vpsplanSchema.partial();

/**
 * POST /api/vps-plans/calculate-custom
 * Calculates custom resource slider pricing for interactive checkout sliders (Paymenter Feature).
 */
vpsPlansRouter.post('/vps-plans/calculate-custom', async (req: AuthedRequest, res) => {
  const schema = z.object({
    cpuCores: z.number().int().min(1).max(64).default(1),
    ramGb: z.number().int().min(1).max(512).default(2),
    storageGb: z.number().int().min(10).max(4000).default(20),
    bandwidthGb: z.number().int().min(100).max(50000).default(1000),
    currency: z.enum(['LKR', 'USD']).default('LKR'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { cpuCores, ramGb, storageGb, bandwidthGb, currency } = parsed.data;

  // Base pricing rate constants
  // LKR rates: CPU 1200/core, RAM 800/GB, Disk 300 per 10GB, Bandwidth 200 per 500GB
  const cpuPriceLkr = cpuCores * 1200;
  const ramPriceLkr = ramGb * 800;
  const storagePriceLkr = Math.ceil(storageGb / 10) * 300;
  const bwPriceLkr = Math.ceil(bandwidthGb / 500) * 200;

  const totalMonthlyLkr = cpuPriceLkr + ramPriceLkr + storagePriceLkr + bwPriceLkr;
  const usdRate = 300; // 1 USD = 300 LKR
  const totalMonthlyUsd = Math.round((totalMonthlyLkr / usdRate) * 100) / 100;

  const finalTotal = currency === 'USD' ? totalMonthlyUsd : totalMonthlyLkr;

  res.json({
    specs: { cpuCores, ramGb, storageGb, bandwidthGb },
    breakdown: {
      cpuPrice: currency === 'USD' ? Math.round((cpuPriceLkr / usdRate) * 100) / 100 : cpuPriceLkr,
      ramPrice: currency === 'USD' ? Math.round((ramPriceLkr / usdRate) * 100) / 100 : ramPriceLkr,
      storagePrice: currency === 'USD' ? Math.round((storagePriceLkr / usdRate) * 100) / 100 : storagePriceLkr,
      bandwidthPrice: currency === 'USD' ? Math.round((bwPriceLkr / usdRate) * 100) / 100 : bwPriceLkr,
    },
    totalMonthly: finalTotal,
    totalMonthlyLkr,
    currency,
  });
});

/**
 * GET /api/vps-plans
 * Returns all VPS plans available for customer browsing and provisioning.
 * Access: All authenticated users (customers for browsing)
 */
vpsPlansRouter.get('/vps-plans', async (req: AuthedRequest, res) => {
  try {
    const plans = await prisma.vpsPlan.findMany({
      orderBy: [
        { category: 'asc' },
        { price: 'asc' },
      ],
    });

    logger.info({ userId: req.user!.id, planCount: plans.length }, 'VPS plans fetched');
    res.json({ plans });
  } catch (err: any) {
    logger.error({ err, userId: req.user!.id }, 'Failed to fetch VPS plans');
    res.status(500).json({ error: 'Failed to fetch VPS plans' });
  }
});

/**
 * POST /api/vps-plans
 * Create a new VPS plan.
 * Access: Admin and Dev only
 */
vpsPlansRouter.post('/vps-plans', requireRole('admin', 'dev'), async (req: AuthedRequest, res) => {
  try {
    const parsed = vpsplanSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ 
        error: 'Invalid VPS plan data', 
        details: parsed.error.flatten() 
      });
    }

    const planData = parsed.data;

    // Create the VPS plan
    const plan = await prisma.vpsPlan.create({
      data: planData,
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        action: `vps-plan.create:${plan.id}`,
        target: plan.id,
      },
    });

    logger.info({ planId: plan.id, userId: req.user!.id }, 'VPS plan created');
    res.status(201).json({ plan });
  } catch (err: any) {
    logger.error({ err, userId: req.user!.id }, 'Failed to create VPS plan');
    res.status(500).json({ error: 'Failed to create VPS plan', details: err.message });
  }
});

/**
 * PATCH /api/vps-plans/:id
 * Update an existing VPS plan.
 * Access: Admin and Dev only
 */
vpsPlansRouter.patch('/vps-plans/:id', requireRole('admin', 'dev'), async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const parsed = updateVpsPlanSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ 
        error: 'Invalid VPS plan data', 
        details: parsed.error.flatten() 
      });
    }

    // Check if plan exists
    const existingPlan = await prisma.vpsPlan.findUnique({
      where: { id },
    });

    if (!existingPlan) {
      return res.status(404).json({ error: 'VPS plan not found', id });
    }

    const updateData = parsed.data;

    // Update the VPS plan
    const plan = await prisma.vpsPlan.update({
      where: { id },
      data: updateData,
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        action: `vps-plan.update:${plan.id}`,
        target: plan.id,
      },
    });

    logger.info({ planId: plan.id, userId: req.user!.id }, 'VPS plan updated');
    res.json({ plan });
  } catch (err: any) {
    logger.error({ err, planId: req.params.id, userId: req.user!.id }, 'Failed to update VPS plan');
    res.status(500).json({ error: 'Failed to update VPS plan', details: err.message });
  }
});

/**
 * DELETE /api/vps-plans/:id
 * Delete a VPS plan.
 * Access: Admin and Dev only
 */
vpsPlansRouter.delete('/vps-plans/:id', requireRole('admin', 'dev'), async (req: AuthedRequest, res) => {
  const { id } = req.params;
  try {
    // Check if plan exists
    const existingPlan = await prisma.vpsPlan.findUnique({
      where: { id },
    });

    if (!existingPlan) {
      return res.status(404).json({ error: 'VPS plan not found', id });
    }

    // Delete the VPS plan
    await prisma.vpsPlan.delete({
      where: { id },
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        action: `vps-plan.delete:${id}`,
        target: id,
      },
    });

    logger.info({ planId: id, userId: req.user!.id }, 'VPS plan deleted');
    return res.json({ success: true, id, deleted: true });
  } catch (err: any) {
    // Fallback: gracefully set isActive: false when historical order references exist
    // to prevent foreign key constraint errors.
    logger.warn(
      { err, planId: id, userId: req.user!.id },
      'Failed to hard-delete VPS plan (likely existing order/provision references) — deactivating instead'
    );
    const deactivated = await prisma.vpsPlan
      .update({ where: { id }, data: { isActive: false } })
      .catch(() => null);

    if (!deactivated) {
      return res.status(500).json({ error: 'Failed to delete or deactivate VPS plan', details: err.message });
    }

    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        action: `vps-plan.deactivate:${id}`,
        target: id,
      },
    });

    return res.json({
      success: true,
      id,
      deactivated: true,
      message: 'VPS plan has existing order history, so it was deactivated instead of hard-deleted.',
    });
  }
});
