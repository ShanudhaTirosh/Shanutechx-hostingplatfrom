import crypto from 'crypto';
import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Client as SshClient } from 'ssh2';
import { logger } from './logger';
import { getVps, getCredentials, LeasewebApiError } from './leasewebClient';
import { decryptSecret } from './secretsVault';
import { env } from '../env';

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

interface SshTicket {
  vpsId: string;
  userId: string;
  expiresAt: number;
}

const tickets = new Map<string, SshTicket>();

export function issueSshTicket(vpsId: string, userId: string): string {
  const ticket = crypto.randomUUID();
  tickets.set(ticket, { vpsId, userId, expiresAt: Date.now() + 30_000 });
  return ticket;
}

function consumeSshTicket(ticket: string): SshTicket | null {
  const entry = tickets.get(ticket);
  if (!entry) return null;
  tickets.delete(ticket); // single-use regardless of outcome
  if (entry.expiresAt < Date.now()) return null;
  return entry;
}

// Sweep expired-but-unused tickets periodically so the map never grows unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of tickets) {
    if (entry.expiresAt < now) tickets.delete(key);
  }
}, 60_000).unref();

export function attachSshTerminalGateway(server: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '', 'http://internal');
    if (url.pathname !== '/ws/vps-ssh') return; // let other upgrade handlers (if any) take it

    const ticket = url.searchParams.get('ticket');
    const entry = ticket ? consumeSshTicket(ticket) : null;

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
      // Cockpit-native node ticket: format is 'node:IP:sshKeyRef'
      // These connect directly to the node using the stored SSH key,
      // bypassing Leaseweb entirely.
      if (entry.vpsId.startsWith('node:')) {
        const parts = entry.vpsId.split(':');
        const ip = parts[1];
        const sshKeyRef = parts.slice(2).join(':');

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
          ssh.shell({ term: 'xterm-256color' }, (err, stream) => {
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
                ssh.end();
                ssh = null;
              }
            });
          });
        });

        currentSsh.on('error', (err) => fail(`SSH connection failed: ${err.message}`));
        currentSsh.connect(connectOpts);
        return;
      }

      // Leaseweb-managed VPS path (original implementation)
      sendStatus('Fetching VPS details…');
      const [instance, credentials] = await Promise.all([
        getVps(entry.vpsId),
        getCredentials(entry.vpsId, 'OPERATING_SYSTEM'),
      ]);

      const ip = instance.ips?.[0]?.ip;
      if (!ip) return fail('No IP address found for this VPS.');

      if (closed || !ssh) return;

      sendStatus(`Connecting to ${ip}…`);

      const currentSsh = ssh;
      currentSsh.on('ready', () => {
        if (!ssh || closed) return;
        sendStatus('Connected. Opening shell…');
        ssh.shell({ term: 'xterm-256color' }, (err, stream) => {
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
              ssh.end();
              ssh = null;
            }
          });
        });
      });

      currentSsh.on('error', (err) => {
        fail(`SSH connection failed: ${err.message}`);
      });

      currentSsh.connect({
        host: ip,
        port: 22,
        username: credentials.username || 'root',
        password: credentials.password,
        readyTimeout: 15_000,
        keepaliveInterval: 10_000,
      });
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
