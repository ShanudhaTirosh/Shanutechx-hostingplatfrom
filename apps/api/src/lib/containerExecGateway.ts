import crypto from 'crypto';
import { storeState, consumeState } from './redis';

export interface ExecTicket {
  ticketId: string;
  nodeId: string;
  containerId: string;
  userId: string;
  expiresAt: number;
}

/**
 * Issues a short-lived (60 second) ticket token for real-time WebSocket container docker exec session.
 */
export async function issueContainerExecTicket(nodeId: string, containerId: string, userId: string): Promise<{ ticket: string; expiresAt: number }> {
  const ticket = crypto.randomBytes(24).toString('hex');
  const expiresAt = Date.now() + 60 * 1000;

  const data: ExecTicket = { ticketId: ticket, nodeId, containerId, userId, expiresAt };
  await storeState('exec_ticket', ticket, data, 60);
  return { ticket, expiresAt };
}

/**
 * Validates and consumes an exec ticket.
 */
export async function consumeContainerExecTicket(ticket: string): Promise<ExecTicket | null> {
  const data = await consumeState<ExecTicket>('exec_ticket', ticket);
  if (!data) return null;
  if (Date.now() > data.expiresAt) return null;
  return data;
}
