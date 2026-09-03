import { firebaseFirestore, firebaseDb } from './firebaseAdmin';
import { prisma } from './prisma';
import { logger } from './logger';

/**
 * Syncs all products & plans from PostgreSQL into Firebase Firestore and Realtime Database
 */
export async function syncProductsToFirebase() {
  try {
    const products = await prisma.product.findMany({
      include: { plans: true },
    });

    if (firebaseFirestore) {
      const batch = firebaseFirestore.batch();
      for (const prod of products) {
        const docRef = firebaseFirestore.collection('products').doc(prod.id);
        batch.set(
          docRef,
          {
            id: prod.id,
            name: prod.name,
            slug: prod.slug,
            category: prod.category,
            description: prod.description || '',
            iconUrl: prod.iconUrl || '',
            isActive: prod.isActive,
            plans: prod.plans.map((p) => ({
              id: p.id,
              name: p.name,
              price: p.price,
              currency: p.currency,
              billingType: p.billingType,
              specsJson: p.specsJson || {},
              isActive: p.isActive,
            })),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }
      await batch.commit();
      logger.info({ count: products.length }, 'Synced products to Firebase Firestore');
    }

    if (firebaseDb) {
      const catalogRef = firebaseDb.ref('catalog/products');
      const catalogData: Record<string, any> = {};
      for (const prod of products) {
        catalogData[prod.id] = {
          id: prod.id,
          name: prod.name,
          category: prod.category,
          isActive: prod.isActive,
          plansCount: prod.plans.length,
          updatedAt: Date.now(),
        };
      }
      await catalogRef.set(catalogData);
      logger.info('Synced products to Firebase Realtime Database');
    }

    return { success: true, count: products.length };
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to sync products to Firebase');
    return { success: false, error: err.message };
  }
}

/**
 * Syncs client account profiles & settings to Firestore and Realtime Database
 */
export async function syncUserToFirebase(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firebaseUid: true,
        email: true,
        displayName: true,
        phoneNumber: true,
        role: true,
        isBanned: true,
        assignedAdminId: true,
        createdAt: true,
      },
    });

    if (!user) return { success: false, error: 'User not found' };

    const payload = {
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (firebaseFirestore) {
      await firebaseFirestore.collection('clients').doc(user.id).set(payload, { merge: true });
      if (user.firebaseUid) {
        await firebaseFirestore.collection('clients_by_uid').doc(user.firebaseUid).set(payload, { merge: true });
      }
    }

    if (firebaseDb) {
      await firebaseDb.ref(`clients/${user.id}`).set({
        email: user.email,
        displayName: user.displayName || user.email.split('@')[0],
        role: user.role,
        isBanned: user.isBanned,
        updatedAt: Date.now(),
      });
    }

    return { success: true, user };
  } catch (err: any) {
    logger.error({ err: err.message, userId }, 'Failed to sync user to Firebase');
    return { success: false, error: err.message };
  }
}

/**
 * Syncs client orders to Firebase Firestore
 */
export async function syncOrdersToFirebase() {
  try {
    const orders = await prisma.order.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            plan: { include: { product: true } },
            service: true,
          },
        },
        user: { select: { id: true, email: true, displayName: true } },
      },
    });

    if (firebaseFirestore) {
      const batch = firebaseFirestore.batch();
      for (const order of orders) {
        const docRef = firebaseFirestore.collection('orders').doc(order.id);
        batch.set(
          docRef,
          {
            id: order.id,
            userId: order.userId,
            customerEmail: order.user.email,
            status: order.status,
            total: order.total,
            currency: order.currency,
            totalLkr: order.totalLkr,
            itemNames: order.items.map((i) => i.plan?.product?.name || i.service?.name || 'Cloud Service'),
            createdAt: order.createdAt.toISOString(),
          },
          { merge: true }
        );
      }
      await batch.commit();
      logger.info({ count: orders.length }, 'Synced orders to Firebase Firestore');
    }

    return { success: true, count: orders.length };
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to sync orders to Firebase');
    return { success: false, error: err.message };
  }
}

/**
 * Syncs Panel & Platform settings to Firestore & Realtime Database
 */
export async function syncPanelSettingsToFirebase() {
  try {
    const smtpConfig = await prisma.platformSmtpConfig.findUnique({
      where: { id: 'global' },
    });

    const settingsData = {
      platformName: 'STX HOSTING',
      domain: 'shanutechx.com',
      smtpConfigured: !!smtpConfig,
      senderEmail: smtpConfig?.senderEmail || 'support@shanutechx.com',
      updatedAt: new Date().toISOString(),
    };

    if (firebaseFirestore) {
      await firebaseFirestore.collection('panel_settings').doc('global').set(settingsData, { merge: true });
    }

    if (firebaseDb) {
      await firebaseDb.ref('settings/panel').set({
        ...settingsData,
        updatedAt: Date.now(),
      });
    }

    return { success: true, settings: settingsData };
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to sync panel settings to Firebase');
    return { success: false, error: err.message };
  }
}

/**
 * Triggers full data migration/sync from PostgreSQL to Firebase Firestore & Realtime DB
 */
export async function fullFirebaseDataMigration() {
  logger.info('Starting full data migration to Firebase Firestore & Realtime Database...');
  const [productsResult, ordersResult, settingsResult] = await Promise.all([
    syncProductsToFirebase(),
    syncOrdersToFirebase(),
    syncPanelSettingsToFirebase(),
  ]);

  // Sync all users to Firestore
  const users = await prisma.user.findMany({ select: { id: true } });
  let userSuccessCount = 0;
  for (const u of users) {
    const res = await syncUserToFirebase(u.id);
    if (res.success) userSuccessCount++;
  }

  return {
    products: productsResult,
    orders: ordersResult,
    settings: settingsResult,
    syncedUsersCount: userSuccessCount,
    timestamp: new Date().toISOString(),
  };
}
