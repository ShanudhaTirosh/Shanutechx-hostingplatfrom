import crypto from 'crypto';
import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Client as SshClient, ConnectConfig } from 'ssh2';
import { logger } from './logger';
import { getVps, getCredentials, LeasewebApiError } from './leasewebClient';
import { decryptSecret } from './secretsVault';
import { prisma } from './prisma';
import { canAccessResource } from '../middleware/rbac';
import { env } from '../env';
import { getVpsSshConfig } from './vpsSshClient';

/**
 * Real, interactive SSH-from-the-browser for a customer's (or staff's) VPS.
 * Flow:
 *   1. Frontend calls POST /leaseweb/instances/:kind/:id/ssh-ticket (auth +
 *      ownership already checked there) and gets back a one-time ticket.
 *   2. Frontend opens `wss://.../ws/vps-ssh?ticket=...` — no auth headers
 *      needed on the WS handshake itself, since the ticket already proves
 *      the caller was authorized moments ago.
 *   3. This module looks up the ticket, fetches the VPS's IP + root/
 *      Administrator credentials from Leaseweb, opens a real SSH2 session,
 *      and pipes bytes between the browser's xterm.js instance and the
 *      remote shell until either side closes.
 *
 * Tickets are single-use and expire in 30s — plenty of time for the
 * frontend to open the WebSocket immediately after minting one, but not
 * long enough to be replayable if it leaked into a log somewhere.
 */

import { storeState, consumeState } from './redis';

export interface SshTicket {
  vpsId: string;
  userId: string;
  expiresAt: number;
}

export async function issueSshTicket(vpsId: string, userId: string): Promise<string> {
  const ticket = crypto.randomUUID();
  const entry: SshTicket = { vpsId, userId, expiresAt: Date.now() + 30_000 };
  await storeState('ssh_ticket', ticket, entry, 30);
  return ticket;
}

async function consumeSshTicket(ticket: string): Promise<SshTicket | null> {
  const entry = await consumeState<SshTicket>('ssh_ticket', ticket);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) return null;
  return entry;
}

export function attachSshTerminalGateway(server: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', async (req, socket, head) => {
    const url = new URL(req.url ?? '', 'http://internal');
    if (url.pathname !== '/ws/vps-ssh') return; // let other upgrade handlers (if any) take it

    const ticket = url.searchParams.get('ticket');
    const entry = ticket ? await consumeSshTicket(ticket) : null;

    if (!entry) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      handleTerminalConnection(ws, entry);
    });
  });
}

function handleTerminalConnection(ws: WebSocket, entry: SshTicket): void {
  let ssh: SshClient | null = new SshClient();
  let closed = false;

  function sendStatus(message: string) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'status', message }));
    }
  }

  function fail(message: string) {
    sendStatus(message);
    ws.close();
  }

  (async () => {
    try {
      // BUG-16 FIX: Verify user exists and still has access rights before establishing SSH connection
      const user = await prisma.user.findUnique({ where: { id: entry.userId } });
      if (!user || user.isBanned) {
        return fail('User account is invalid or banned.');
      }

      // Cockpit-native node ticket: format is 'node:IP:sshKeyRef'
      // These connect directly to the node using the stored SSH key,
      // bypassing Leaseweb entirely.
      if (entry.vpsId.startsWith('node:')) {
        // Only admin or dev can access raw infrastructure node terminals
        if (user.role !== 'admin' && user.role !== 'dev') {
          return fail('Admin/Dev role required to connect to node terminal.');
        }

        // BUG-19 FIX: Parse node IP and sshKeyRef robustly handling IPv6 addresses or extra colons
        const raw = entry.vpsId.slice(5); // strip 'node:'
        let ip: string;
        let sshKeyRef: string;

        if (raw.startsWith('[')) {
          const closingBracket = raw.indexOf(']');
          if (closingBracket !== -1 && raw[closingBracket + 1] === ':') {
            ip = raw.slice(1, closingBracket);
            sshKeyRef = raw.slice(closingBracket + 2);
          } else {
            const idx = raw.indexOf(':');
            ip = raw.slice(0, idx);
            sshKeyRef = raw.slice(idx + 1);
          }
        } else {
          const idx = raw.indexOf(':');
          ip = raw.slice(0, idx);
          sshKeyRef = raw.slice(idx + 1);
        }

        sendStatus(`Connecting to node at ${ip}…`);

        // Decrypt the SSH key from the vault if it's an encrypted ref,
        // or use as a password if it starts with 'ssh://'
        let connectOpts: any = { host: ip, port: 22, readyTimeout: 15_000, keepaliveInterval: 10_000 };

        if (sshKeyRef.startsWith('ssh://')) {
          fail('This node was registered using password authentication without a stored private key. Browser SSH terminal requires an SSH private key reference.');
          return;
        } else {
          // Encrypted private key stored in vault
          try {
            const privateKey = decryptSecret(sshKeyRef, env.secretsEncryptionKey);
            connectOpts.username = 'root';
            connectOpts.privateKey = privateKey;
          } catch (err: any) {
            fail(`Failed to decrypt SSH key: ${err?.message || 'Invalid key reference or encryption key'}`);
            return;
          }
        }

        const currentSsh = ssh;
        if (!currentSsh) return;

        currentSsh.on('ready', () => {
          if (!ssh || closed) return;
          sendStatus('Connected. Opening shell…');
          const sshInst = ssh;
          sshInst.shell({ term: 'xterm-256color' }, (err, stream) => {
            if (err || closed || !ssh) {
              fail(`Failed to open shell: ${err?.message ?? 'connection closed'}`);
              return;
            }
            ws.on('message', (data) => {
              const text = data.toString();
              if (text.startsWith('{')) {
                try {
                  const msg = JSON.parse(text);
                  if (msg.type === 'resize' && msg.cols && msg.rows) {
                    stream.setWindow(msg.rows, msg.cols, 0, 0);
                    return;
                  }
                } catch { /* raw input */ }
              }
              stream.write(data);
            });
            stream.on('data', (chunk: Buffer) => { if (ws.readyState === WebSocket.OPEN) ws.send(chunk); });
            stream.on('close', () => { ws.close(); });
            ws.on('close', () => {
              closed = true;
              try {
                if (typeof (stream as any).close === 'function') (stream as any).close();
                else stream.end();
              } catch {}
              if (ssh) {
                try { ssh.end(); } catch {}
                ssh = null;
              }
            });
          });
        });

        currentSsh.on('error', (err) => {
          if (!closed) fail(`SSH connection failed: ${err.message}`);
        });
        currentSsh.connect(connectOpts);
        return;
      }

      // 1. Try resolving VpsProvision row by ID (for both Direct SSH and Leaseweb provisions)
      const provision = await prisma.vpsProvision.findFirst({
        where: {
          OR: [{ id: entry.vpsId }, { leasewebVpsId: entry.vpsId }],
          status: { not: 'terminated' },
        },
      });

      if (provision && user.role === 'customer' && provision.userId !== user.id) {
        return fail('You do not own this VPS provision.');
      }

      let connectOpts: ConnectConfig;

      // Direct SSH path (Manual / Provider without API access)
      if (provision && provision.ip && !provision.leasewebVpsId) {
        sendStatus(`Connecting to VPS at ${provision.ip}…`);
        try {
          connectOpts = getVpsSshConfig(provision);
        } catch (err: any) {
          return fail(`Failed to read VPS SSH configuration: ${err.message}`);
        }
      } else {
        // Leaseweb-managed VPS path
        const targetLeasewebId = provision?.leasewebVpsId || entry.vpsId;
        sendStatus('Fetching VPS credentials from Leaseweb…');
        const [instance, credentials] = await Promise.all([
          getVps(targetLeasewebId),
          getCredentials(targetLeasewebId, 'OPERATING_SYSTEM'),
        ]);

        const ip = instance.ips?.[0]?.ip;
        if (!ip) return fail('No IP address found for this VPS.');

        connectOpts = {
          host: ip,
          port: 22,
          username: credentials.username || 'root',
          password: credentials.password,
          readyTimeout: 15_000,
          keepaliveInterval: 10_000,
        };
      }

      if (closed || !ssh) return;

      sendStatus(`Establishing SSH session to ${connectOpts.host}:${connectOpts.port}…`);

      const currentSsh = ssh;
      currentSsh.on('ready', () => {
        if (!ssh || closed) return;
        sendStatus('Connected. Opening terminal shell…');
        const sshInst = ssh;
        sshInst.shell({ term: 'xterm-256color' }, (err, stream) => {
          if (err || closed || !ssh) {
            fail(`Failed to open shell: ${err?.message ?? 'connection closed'}`);
            return;
          }

          ws.on('message', (data) => {
            // A JSON control message resizes the pty; anything else is raw keystrokes.
            const text = data.toString();
            if (text.startsWith('{')) {
              try {
                const msg = JSON.parse(text);
                if (msg.type === 'resize' && msg.cols && msg.rows) {
                  stream.setWindow(msg.rows, msg.cols, 0, 0);
                  return;
                }
              } catch {
                // fall through — treat as raw input if it wasn't valid JSON
              }
            }
            stream.write(data);
          });

          stream.on('data', (chunk: Buffer) => {
            if (ws.readyState === WebSocket.OPEN) ws.send(chunk);
          });

          stream.on('close', () => {
            ws.close();
          });

          ws.on('close', () => {
            closed = true;
            try {
              if (typeof (stream as any).close === 'function') (stream as any).close();
              else stream.end();
            } catch {}
            if (ssh) {
              try { ssh.end(); } catch {}
              ssh = null;
            }
          });
        });
      });

      currentSsh.on('error', (err) => {
        if (!closed) fail(`SSH connection failed: ${err.message}`);
      });

      currentSsh.connect(connectOpts);
    } catch (err) {
      const message =
        err instanceof LeasewebApiError
          ? `Could not fetch VPS credentials: ${err.message}`
          : `Unexpected error: ${(err as Error).message}`;
      logger.error({ err, vpsId: entry.vpsId }, 'SSH terminal setup failed');
      fail(message);
    }
  })();

  ws.on('close', () => {
    closed = true;
    if (ssh) {
      ssh.end();
      ssh = null;
    }
  });
}
