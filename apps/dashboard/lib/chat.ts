import { getDatabase, ref, push, set, onValue, off, serverTimestamp, query, orderByChild } from 'firebase/database';
import { getApps } from 'firebase/app';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderRole: 'customer' | 'staff';
  text: string;
  timestamp: number;
}

export interface ChatIndexEntry {
  lastMessageAt: number;
  lastMessageText: string;
  lastSenderRole: 'customer' | 'staff';
  unreadByAdmin: boolean;
  unreadByCustomer: boolean;
}

// Computed lazily, not at module load — evaluating getDatabase() at import
// time can run during Next.js's build-time prerendering pass (no Firebase
// app initialized yet in that context), which is exactly what broke the
// login/dashboard pages earlier before they were marked force-dynamic.
// Being lazy here means this module is safe to import from anywhere.
function requireDb() {
  if (!getApps().length) {
    throw new Error('Firebase Realtime Database is not configured');
  }
  return getDatabase();
}

/** Sends a message in a customer's chat thread, keyed by their own UID. */
export async function sendChatMessage(
  customerUid: string,
  senderId: string,
  senderRole: 'customer' | 'staff',
  text: string
): Promise<void> {
  const database = requireDb();
  const messagesRef = ref(database, `chats/${customerUid}/messages`);
  const newMessageRef = push(messagesRef);

  await set(newMessageRef, {
    senderId,
    senderRole,
    text,
    timestamp: serverTimestamp(),
  });

  // Keep the lightweight index in sync so the admin inbox can list every
  // conversation (sorted, with unread state) without reading every
  // customer's full message history just to render a list.
  await set(ref(database, `chatIndex/${customerUid}`), {
    lastMessageAt: serverTimestamp(),
    lastMessageText: text.slice(0, 200),
    lastSenderRole: senderRole,
    unreadByAdmin: senderRole === 'customer',
    unreadByCustomer: senderRole === 'staff',
  });
}

/** Subscribes to a customer's chat thread; returns an unsubscribe function. */
export function subscribeToChat(
  customerUid: string,
  onMessages: (messages: ChatMessage[]) => void
): () => void {
  const database = requireDb();
  const messagesQuery = query(ref(database, `chats/${customerUid}/messages`), orderByChild('timestamp'));

  const handler = onValue(messagesQuery, (snapshot) => {
    const messages: ChatMessage[] = [];
    snapshot.forEach((child) => {
      messages.push({ id: child.key as string, ...child.val() });
    });
    onMessages(messages);
  });

  return () => off(messagesQuery, 'value', handler);
}

/** Admin-only: subscribes to the index of every customer conversation. */
export function subscribeToChatIndex(
  onIndex: (entries: Record<string, ChatIndexEntry>) => void
): () => void {
  const database = requireDb();
  const indexRef = ref(database, 'chatIndex');

  const handler = onValue(indexRef, (snapshot) => {
    onIndex(snapshot.val() ?? {});
  });

  return () => off(indexRef, 'value', handler);
}

/** Marks a conversation as read by whichever side just opened it. */
export async function markChatRead(customerUid: string, readBy: 'customer' | 'staff'): Promise<void> {
  const database = requireDb();
  const field = readBy === 'staff' ? 'unreadByAdmin' : 'unreadByCustomer';
  await set(ref(database, `chatIndex/${customerUid}/${field}`), false);
}
