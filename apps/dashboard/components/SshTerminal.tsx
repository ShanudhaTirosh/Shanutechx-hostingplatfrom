'use client';

import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { api } from '@/lib/api';
import { API_BASE } from '@/lib/useAuth';
import { Button } from '@/components/ui';

/**
 * Opens a real interactive SSH session to a customer's (or staff's) VPS,
 * proxied through apps/api/src/lib/sshTerminalGateway.ts. Flow: mint a
 * one-time ticket via POST .../ssh-ticket, then open a WebSocket carrying
 * that ticket as a query param (browsers can't set auth headers on a WS
 * handshake), and pipe raw bytes to/from xterm.js from there.
 */
export function SshTerminal({
  kind,
  id,
  onClose,
}: {
  kind: 'provision' | 'node';
  id: string;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState('Requesting session...');
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let term: Terminal | null = null;
    let fitAddon: FitAddon | null = null;
    let disposed = false;
    let resizeHandler: (() => void) | null = null;

    (async () => {
      try {
        // Node Engine host tickets use the nodeEngine endpoint; provision tickets use the vps endpoint.
        const ticketRes = kind === 'node'
          ? await api.nodeEngine.sshTicket(id)
          : await api.vps.sshTicket(id);
        const { ticket } = ticketRes;
        if (disposed || !containerRef.current) return;

        term = new Terminal({
          convertEol: true,
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          fontSize: 13,
          theme: {
            background: '#0a0a0f',
            foreground: '#e5e5ea',
          },
        });
        fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(containerRef.current);
        fitAddon.fit();

        const wsBase = API_BASE.replace(/^http/, 'ws');
        const ws = new WebSocket(`${wsBase}/ws/vps-ssh?ticket=${encodeURIComponent(ticket)}`);
        ws.binaryType = 'arraybuffer';
        wsRef.current = ws;

        ws.onopen = () => setStatus('Connecting...');

        ws.onmessage = (event) => {
          if (typeof event.data === 'string') {
            try {
              const msg = JSON.parse(event.data);
              if (msg.type === 'status') {
                setStatus(msg.message);
                if (msg.message.toLowerCase().includes('opening shell')) {
                  setConnected(true);
                }
                return;
              }
            } catch {
              // not a control message — fall through and print it
            }
            term!.write(event.data);
          } else {
            term!.write(new Uint8Array(event.data));
          }
        };

        ws.onclose = () => {
          setConnected(false);
          setStatus((prev) => (prev ? `${prev} — session ended.` : 'Session ended.'));
        };

        ws.onerror = () => {
          setStatus('Connection error.');
        };

        term.onData((data) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(data);
        });

        resizeHandler = () => {
          fitAddon?.fit();
          if (ws.readyState === WebSocket.OPEN && term) {
            ws.send('__STX_CTL__:' + JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
          }
        };
        window.addEventListener('resize', resizeHandler);
      } catch (err: any) {
        setStatus(err.message || 'Failed to open SSH session');
      }
    })();

    return () => {
      disposed = true;
      if (resizeHandler) window.removeEventListener('resize', resizeHandler);
      wsRef.current?.close();
      term?.dispose();
    };
  }, [kind, id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className="w-full max-w-4xl h-[70vh] flex flex-col rounded-2xl border border-white/10 bg-[#0a0a0f] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-white/[0.03]">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`h-2 w-2 rounded-full shrink-0 ${connected ? 'bg-emerald-400' : 'bg-orange-400 animate-pulse'}`} />
            <span className="text-xs text-text-muted truncate">{status}</span>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
        </div>
        <div ref={containerRef} className="flex-1 p-2 overflow-hidden" />
      </div>
    </div>
  );
}
