import crypto from 'crypto';
import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Client as SshClient, ConnectConfig } from 'ssh2';
import { logger } from './logger';
import { decryptSecret } from './secretsVault';
import { prisma } from './prisma';
import { canAccessResource } from '../middleware/rbac';
import { env } from '../env';
import { getVpsSshConfig } from './vpsSshClient';

/**
 * Real, interactive browser-based SSH terminal gateway for customer & manual VPS provisions,
 * as well as infrastructure host compute nodes.
 *
 * Flow:
 *   1. Frontend calls `POST /api/vps-provisions/:id/ssh-ticket` (or `POST /api/nodes/:id/ssh-ticket`)
 *      where auth and RBAC ownership are validated.
 *   2. The API issues a single-use, 30-second ticket stored in Redis / memory state.
 *   3. Frontend opens WebSocket connection `wss://.../ws/vps-ssh?ticket=...`.
 *   4. This module consumes the ticket, verifies account validity (`isBanned`), fetches the
 *      `VpsProvision` (or NodeEngine host config) from Prisma DB, decrypts stored credentials
 *      from platform vault via `getVpsSshConfig`, and opens a real `ssh2` session.
 *   5. Pipes bidirectional data between browser `xterm.js` and remote PTY shell until closed.
 *
 * Tickets are single-use and expire in 30s — ensuring maximum security without exposing
 * long-lived secrets in WebSockets handshake URLs.
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

      // NodeEngine infrastructure node ticket: format is 'node:IP:sshKeyRef'
      // Connects directly to the infrastructure host node using the vault SSH key.
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

      // 1. Resolve VpsProvision row by ID
      const provision = await prisma.vpsProvision.findFirst({
        where: {
          id: entry.vpsId,
          status: { not: 'terminated' },
        },
      });

      if (!provision) {
        return fail('VPS provision record not found.');
      }

      const hasAccess = await canAccessResource(provision.userId, { user } as any, 'vps', provision.id);
      if (!hasAccess) {
        return fail('You do not have access to this VPS provision.');
      }

      let connectOpts: ConnectConfig;

      sendStatus(`Connecting to VPS at ${provision.ip}…`);
      try {
        connectOpts = getVpsSshConfig(provision);
      } catch (err: any) {
        return fail(`Failed to read VPS SSH configuration: ${err?.message || 'Invalid config'}`);
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
    } catch (err: any) {
      const message = `Unexpected error: ${err?.message || 'SSH connection failed'}`;
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
