import fs from 'fs';
import path from 'path';
import { prisma } from './prisma';
import { env } from '../env';
import { logger } from './logger';

export interface PaymentChannelDetails {
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  branch?: string;
  swiftCode?: string;
  mobileNumber?: string;
  helaPayId?: string;
  currency?: string;
  network?: string;
  walletAddress?: string;
  bybitUid?: string;
  memo?: string;
  note?: string;
  qrCodeUrl?: string;
}

export interface PaymentChannel {
  id: string; // 'bank_transfer' | 'helapay' | 'ezcash' | 'bybit_crypto'
  name: string;
  category: 'bank' | 'mobile_wallet' | 'crypto';
  enabled: boolean;
  badge?: string;
  details: PaymentChannelDetails;
}

export const DEFAULT_PAYMENT_CHANNELS: PaymentChannel[] = [
  {
    id: 'bank_transfer',
    name: 'Bank Transfer (Commercial Bank / Local Banks)',
    category: 'bank',
    enabled: true,
    badge: 'Popular',
    details: {
      bankName: 'Commercial Bank of Ceylon',
      branch: 'Negombo Branch',
      accountName: 'STX Enterprises (Shanudha Tirosh)',
      accountNumber: '100012345678',
      swiftCode: 'CCEYLKJA',
      note: 'Transfer to our Commercial Bank account using online banking, CDM, or teller. Please enter your Order Number in the payment reference/remarks field.',
    },
  },
  {
    id: 'helapay',
    name: 'Helakuru HelaPay',
    category: 'mobile_wallet',
    enabled: true,
    badge: 'Instant',
    details: {
      mobileNumber: '071-234-5678',
      helaPayId: 'shanudha@helapay',
      accountName: 'STX Enterprises / Shanudha Tirosh',
      note: 'Pay directly via Helakuru App using HelaPay QR or mobile transfer. Capture the completed payment receipt screen and upload it below.',
    },
  },
  {
    id: 'ezcash',
    name: 'Dialog eZ Cash',
    category: 'mobile_wallet',
    enabled: true,
    badge: 'Fast',
    details: {
      mobileNumber: '077-123-4567',
      accountName: 'STX Enterprises',
      note: 'Send payment to Dialog eZ Cash wallet (Dial #111# or use the eZ Cash mobile app). Upload a screenshot of the confirmation SMS or app receipt.',
    },
  },
  {
    id: 'bybit_crypto',
    name: 'Bybit Crypto Transfer (USDT)',
    category: 'crypto',
    enabled: true,
    badge: 'Global / Crypto',
    details: {
      currency: 'USDT',
      network: 'TRC20 (Tron Network) / Internal UID Transfer',
      walletAddress: 'TYxShanuTechXUSDTDepositWalletAddress9988',
      bybitUid: '88291041',
      memo: 'STX-ORDER',
      note: 'Zero-fee instant transfer via Bybit Internal UID Transfer (UID: 88291041) or direct TRC20 USDT transfer. Upload your Bybit withdrawal or tx screenshot.',
    },
  },
];

const CONFIG_FILE_PATH = path.join(
  process.env.UPLOADS_DIR || '/var/lib/shanutechx/uploads',
  'config',
  'payment_channels.json'
);

/**
 * Loads payment channels configuration.
 * Checks in-memory cache / persistent file / database, with defaults fallback.
 */
export async function getPaymentChannels(includeDisabled = false): Promise<PaymentChannel[]> {
  let channels: PaymentChannel[] = DEFAULT_PAYMENT_CHANNELS;

  // 1. Try reading from persistent config file
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const content = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        channels = parsed;
      }
    }
  } catch (err) {
    logger.warn({ err }, 'Failed reading payment channels config file, trying database');
  }

  // 2. Try database sync if file wasn't present or for freshness
  try {
    const item = await prisma.secretItem.findFirst({
      where: { key: 'PAYMENT_CHANNELS_CONFIG' },
    });
    if (item?.valueEnc) {
      const parsed = JSON.parse(item.valueEnc);
      if (Array.isArray(parsed) && parsed.length > 0) {
        channels = parsed;
      }
    }
  } catch {
    // Database secret item might not be created yet, fallback is safe
  }

  if (includeDisabled) {
    return channels;
  }
  return channels.filter((c) => {
    if (!c.enabled) return false;
    // Mobile wallet channels (Helakuru HelaPay and Dialog eZ Cash) require a configured mobile phone number
    if (c.id === 'helapay' || c.id === 'ezcash') {
      const phone = c.details?.mobileNumber?.trim();
      return Boolean(phone && phone.length >= 7);
    }
    // Bank transfer requires a configured account number
    if (c.id === 'bank_transfer') {
      const acc = c.details?.accountNumber?.trim();
      return Boolean(acc && acc.length >= 4);
    }
    // Crypto transfer requires wallet address or UID
    if (c.id === 'bybit_crypto') {
      return Boolean(c.details?.walletAddress?.trim() || c.details?.bybitUid?.trim());
    }
    return true;
  });
}

/**
 * Persists updated payment channels configuration to both file and database.
 */
export async function savePaymentChannels(channels: PaymentChannel[]): Promise<PaymentChannel[]> {
  // 1. Save to local persistent file
  try {
    const dir = path.dirname(CONFIG_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(channels, null, 2), 'utf-8');
  } catch (err) {
    logger.warn({ err }, 'Failed writing payment channels config file');
  }

  // 2. Save to database secret item
  try {
    let systemProject = await prisma.secretProject.findFirst({
      where: { name: 'Platform System Integrations' },
    });
    if (!systemProject) {
      systemProject = await prisma.secretProject.create({
        data: {
          name: 'Platform System Integrations',
          environment: 'production',
        },
      });
    }

    await prisma.secretItem.upsert({
      where: {
        projectId_key: {
          projectId: systemProject.id,
          key: 'PAYMENT_CHANNELS_CONFIG',
        },
      },
      update: {
        valueEnc: JSON.stringify(channels),
      },
      create: {
        projectId: systemProject.id,
        key: 'PAYMENT_CHANNELS_CONFIG',
        valueEnc: JSON.stringify(channels),
      },
    });
  } catch (err) {
    logger.warn({ err }, 'Failed saving payment channels to database secretItem');
  }

  return channels;
}

/**
 * Toggles a payment channel enabled or disabled.
 */
export async function togglePaymentChannel(channelId: string, enabled?: boolean): Promise<PaymentChannel | null> {
  const channels = await getPaymentChannels(true);
  const target = channels.find((c) => c.id === channelId);
  if (!target) return null;

  target.enabled = typeof enabled === 'boolean' ? enabled : !target.enabled;
  await savePaymentChannels(channels);
  return target;
}
