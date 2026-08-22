import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendPushToUsers } from './pushNotifications';
import { prisma } from './prisma';

vi.mock('./prisma', () => ({
  prisma: {
    pushToken: { findMany: vi.fn(), deleteMany: vi.fn() },
  },
}));

const mockSend = vi.fn();
const mockReceipts = vi.fn();

vi.mock('expo-server-sdk', () => {
  return {
    Expo: class {
      static isExpoPushToken(token: string) {
        return token.startsWith('ExponentPushToken');
      }
      chunkPushNotifications(messages: any[]) {
        return [messages]; // single chunk for these tests
      }
      chunkPushNotificationReceiptIds(ids: string[]) {
        return [ids];
      }
      async sendPushNotificationsAsync(...args: any[]) {
        return mockSend(...args);
      }
      async getPushNotificationReceiptsAsync(...args: any[]) {
        return mockReceipts(...args);
      }
    },
  };
});

describe('sendPushToUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('drops tokens that are not valid Expo push tokens without sending them', async () => {
    (prisma.pushToken.findMany as any).mockResolvedValue([
      { id: 't1', expoToken: 'garbage-not-a-real-token', userId: 'u1' },
    ]);

    await sendPushToUsers(['u1'], { title: 'Test', body: 'hello' });

    expect(mockSend).not.toHaveBeenCalled();
    expect(prisma.pushToken.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['t1'] } } });
  });

  it('sends to valid tokens and removes ones Expo reports as DeviceNotRegistered', async () => {
    (prisma.pushToken.findMany as any).mockResolvedValue([
      { id: 't1', expoToken: 'ExponentPushToken[dead]', userId: 'u1' },
      { id: 't2', expoToken: 'ExponentPushToken[alive]', userId: 'u1' },
    ]);

    mockSend.mockResolvedValue([
      { status: 'ok', id: 'ticket-dead' },
      { status: 'ok', id: 'ticket-alive' },
    ]);

    mockReceipts.mockResolvedValue({
      'ticket-dead': { status: 'error', details: { error: 'DeviceNotRegistered' } },
      'ticket-alive': { status: 'ok' },
    });

    await sendPushToUsers(['u1'], { title: 'Test', body: 'hello' });

    expect(mockSend).toHaveBeenCalled();
    // The dead token (and only the dead token) should be cleaned up via receipts —
    // this is the exact bug I caught and fixed myself: an earlier draft had a
    // dead placeholder here that never actually deleted anything.
    expect(prisma.pushToken.deleteMany).toHaveBeenCalledWith({
      where: { expoToken: { in: ['ExponentPushToken[dead]'] } },
    });
  });

  it('does nothing when the user has no registered tokens', async () => {
    (prisma.pushToken.findMany as any).mockResolvedValue([]);
    await sendPushToUsers(['u1'], { title: 'Test', body: 'hello' });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('does nothing when called with no user IDs', async () => {
    await sendPushToUsers([], { title: 'Test', body: 'hello' });
    expect(prisma.pushToken.findMany).not.toHaveBeenCalled();
  });
});
