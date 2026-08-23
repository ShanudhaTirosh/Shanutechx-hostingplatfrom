import crypto from 'crypto';

interface ExecTicket {
  ticketId: string;
  nodeId: string;
  containerId: string;
  userId: string;
  expiresAt: number;
}

const activeTickets = new Map<string, ExecTicket>();

/**
 * Issues a short-lived (60 second) ticket token for real-time WebSocket container docker exec session.
 */
export function issueContainerExecTicket(nodeId: string, containerId: string, userId: string): { ticket: string; expiresAt: number } {
  const ticket = crypto.randomBytes(24).toString('hex');
  const expiresAt = Date.now() + 60 * 1000;

  activeTickets.set(ticket, { ticketId: ticket, nodeId, containerId, userId, expiresAt });
  return { ticket, expiresAt };
}

/**
 * Validates and consumes an exec ticket.
 */
export function consumeContainerExecTicket(ticket: string): ExecTicket | null {
  const data = activeTickets.get(ticket);
  if (!data) return null;
  activeTickets.delete(ticket);

  if (Date.now() > data.expiresAt) return null;
  return data;
}
