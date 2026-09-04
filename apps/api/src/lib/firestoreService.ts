import { firebaseFirestore } from './firebaseAdmin';
import { logger } from './logger';

/**
 * Executes a PostgreSQL/Prisma query, and if PostgreSQL is offline or unreachable,
 * transparently fails over to fetching the data from Firebase Firestore.
 */
export async function withDbFallback<T>(
  prismaOperation: () => Promise<T>,
  firestoreFallback: () => Promise<T>
): Promise<T> {
  try {
    return await prismaOperation();
  } catch (err: any) {
    const isDbOffline =
      err.name === 'PrismaClientInitializationError' ||
      err.name === 'PrismaClientKnownRequestError' ||
      err.code === 'P1001' || // Can't reach database server
      err.code === 'P1002' || // Database server timeout
      err.code === 'ECONNREFUSED' ||
      (err.message && (
        err.message.includes("Can't reach database") ||
        err.message.includes('connect ECONNREFUSED') ||
        err.message.includes('Timed out fetching a new connection')
      ));

    if (isDbOffline) {
      logger.warn(
        { err: err.message, code: err.code },
        'PostgreSQL database offline or unreachable. Failing over to Firestore primary cache...'
      );
      try {
        return await firestoreFallback();
      } catch (fsErr: any) {
        logger.error({ err: fsErr.message }, 'Firestore fallback also failed');
        throw err; // throw original error if firestore fails as well
      }
    }
    throw err;
  }
}

/**
 * Default fallback contact info when database and firestore documents are empty
 */
const DEFAULT_CONTACT_INFO = {
  supportEmail: 'support@shanutechx.cloud',
  contactEmail: 'sales@shanutechx.cloud',
  contactPhone: '+1 (800) 589-STX1',
  whatsappPhone: '+94 77 123 4567',
  contactAddress: 'ShanuTechX Cloud HQ, Tech City, Sri Lanka',
  supportHours: '24/7/365 Tier-3 Engineer Live Support',
  discordUrl: 'https://discord.gg/shanutechx',
  whatsappChannelUrl: 'https://wa.me/94771234567?text=Hello%20ShanuTechX%20Support',
  telegramUrl: 'https://t.me/shanutechx',
  githubUrl: 'https://github.com/shanutechx',
  twitterUrl: 'https://twitter.com/shanutechx',
  facebookUrl: 'https://facebook.com/shanutechx',
  companyName: 'ShanuTechX Cloud',
  heroTitle: 'Autonomous High-Performance Cloud Hosting',
  heroSubtitle: 'Deploy web apps, Node.js and Python services, and Discord bots in minutes.',
  announcementText: '🚀 New VPS High-Performance Nodes Online in Ashburn & Frankfurt!',
  announcementActive: true,
  copyrightText: `© ${new Date().getFullYear()} ShanuTechX Cloud. All rights reserved.`,
};

/**
 * Reads Site Settings / Contact Info from Firestore `site_settings` collection
 */
export async function getContactInfoFromFirestore() {
  if (!firebaseFirestore) {
    logger.warn('Firestore not initialized, returning default contact info');
    return DEFAULT_CONTACT_INFO;
  }

  try {
    const doc = await firebaseFirestore.collection('site_settings').doc('contact_info').get();
    if (doc.exists) {
      const data = doc.data() || {};
      return {
        ...DEFAULT_CONTACT_INFO,
        ...data,
      };
    }

    // Try reading cms_content page='home' / 'contact'
    const snapshot = await firebaseFirestore.collection('cms_content').get();
    if (!snapshot.empty) {
      const content: Record<string, any> = {};
      snapshot.docs.forEach((d) => {
        const item = d.data();
        if (item.key && item.value !== undefined) {
          content[item.key] = item.value;
        }
      });
      return {
        ...DEFAULT_CONTACT_INFO,
        ...content,
      };
    }
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to read contact info from Firestore');
  }

  return DEFAULT_CONTACT_INFO;
}

/**
 * Reads flat content block page from Firestore `cms_content` collection
 */
export async function getCmsPageFromFirestore(page: string) {
  const content: Record<string, unknown> = {};

  if (!firebaseFirestore) {
    return { page, content };
  }

  try {
    const snapshot = await firebaseFirestore
      .collection('cms_content')
      .where('page', '==', page)
      .get();

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.key) {
        content[data.key] = data.value;
      }
    });
  } catch (err: any) {
    logger.error({ err: err.message, page }, 'Failed to read CMS page from Firestore');
  }

  return { page, content };
}

/**
 * Reads Knowledge Base categories & articles from Firestore `knowledge_base` & `kb_categories`
 */
export async function getKbArticlesFromFirestore(categorySlug?: string, searchQuery?: string) {
  if (!firebaseFirestore) {
    return { categories: [], articles: [], total: 0 };
  }

  try {
    // 1. Fetch categories
    const catSnapshot = await firebaseFirestore.collection('kb_categories').get();
    const categories = catSnapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    // 2. Fetch published articles
    let queryRef: FirebaseFirestore.Query = firebaseFirestore
      .collection('knowledge_base')
      .where('published', '==', true);

    if (categorySlug && categorySlug !== 'all') {
      queryRef = queryRef.where('category', '==', categorySlug);
    }

    const artSnapshot = await queryRef.get();
    let articles = artSnapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        slug: data.slug || d.id,
        title: data.title || '',
        category: data.category || 'deployments',
        summary: data.summary || '',
        content: data.content || '',
        published: Boolean(data.published),
        views: Number(data.views || 0),
        helpfulCount: Number(data.helpfulCount || 0),
        updatedAt: data.updatedAt || new Date().toISOString(),
      };
    });

    // Client-side text search filtering if query parameter provided
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      articles = articles.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.summary.toLowerCase().includes(q) ||
          a.content.toLowerCase().includes(q)
      );
    }

    return {
      categories,
      articles,
      total: articles.length,
    };
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to read Knowledge Base from Firestore');
    return { categories: [], articles: [], total: 0 };
  }
}

/**
 * Reads single Knowledge Base Article by ID or Slug from Firestore
 */
export async function getKbArticleByIdFromFirestore(idOrSlug: string) {
  if (!firebaseFirestore) return null;

  try {
    // Try document ID direct fetch
    const docRef = firebaseFirestore.collection('knowledge_base').doc(idOrSlug);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      const data = docSnap.data()!;
      return {
        id: docSnap.id,
        slug: data.slug || docSnap.id,
        title: data.title || '',
        category: data.category || 'deployments',
        summary: data.summary || '',
        content: data.content || '',
        published: Boolean(data.published),
        views: Number(data.views || 0) + 1,
        helpfulCount: Number(data.helpfulCount || 0),
        updatedAt: data.updatedAt || new Date().toISOString(),
      };
    }

    // Try slug query
    const snapshot = await firebaseFirestore
      .collection('knowledge_base')
      .where('slug', '==', idOrSlug)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const d = snapshot.docs[0];
      const data = d.data();
      return {
        id: d.id,
        slug: data.slug || d.id,
        title: data.title || '',
        category: data.category || 'deployments',
        summary: data.summary || '',
        content: data.content || '',
        published: Boolean(data.published),
        views: Number(data.views || 0) + 1,
        helpfulCount: Number(data.helpfulCount || 0),
        updatedAt: data.updatedAt || new Date().toISOString(),
      };
    }
  } catch (err: any) {
    logger.error({ err: err.message, idOrSlug }, 'Failed to fetch KB article from Firestore');
  }

  return null;
}
