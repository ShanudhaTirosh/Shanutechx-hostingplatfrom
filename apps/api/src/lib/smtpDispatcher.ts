import net from 'net';
import tls from 'tls';
import { logger } from './logger';

export interface SmtpServerOptions {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure?: boolean; // true for 465, false for 587/25
  timeoutMs?: number;
}

export interface MailOptions {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Tests connection to an SMTP server by performing TCP/TLS handshake, EHLO, and AUTH.
 */
export async function verifySmtpConnection(options: SmtpServerOptions): Promise<{ ok: boolean; message: string; latencyMs: number }> {
  const startTime = Date.now();
  return new Promise((resolve) => {
    const isImplicitTls = options.port === 465 || options.secure === true;
    let socket: net.Socket;

    const timeout = setTimeout(() => {
      if (socket) socket.destroy();
      resolve({ ok: false, message: 'SMTP connection timed out after 10000ms', latencyMs: Date.now() - startTime });
    }, options.timeoutMs || 10000);

    const onConnect = () => {
      let buffer = '';
      let step = 0;

      const send = (data: string) => {
        if (socket.writable) {
          socket.write(data + '\r\n');
        }
      };

      const handleResponse = (dataBuf: Buffer) => {
        buffer += dataBuf.toString();
        const lines = buffer.split('\r\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line) continue;
          const code = parseInt(line.slice(0, 3), 10);

          if (step === 0 && (code === 220 || code === 250)) {
            step = 1;
            send(`EHLO shanutechx.platform`);
          } else if (step === 1 && code === 250) {
            if (options.user && options.pass) {
              step = 2;
              const authPlain = Buffer.from(`\0${options.user}\0${options.pass}`).toString('base64');
              send(`AUTH PLAIN ${authPlain}`);
            } else {
              clearTimeout(timeout);
              socket.end();
              resolve({ ok: true, message: 'EHLO successful (No AUTH provided)', latencyMs: Date.now() - startTime });
            }
          } else if (step === 2) {
            clearTimeout(timeout);
            socket.end();
            if (code === 235 || code === 250) {
              resolve({ ok: true, message: 'SMTP Authentication Successful (235 OK)', latencyMs: Date.now() - startTime });
            } else {
              resolve({ ok: false, message: `SMTP Auth Failed: ${line}`, latencyMs: Date.now() - startTime });
            }
          }
        }
      };

      if (socket instanceof tls.TLSSocket) {
        socket.on('data', handleResponse);
      } else {
        socket.on('data', handleResponse);
      }
    };

    if (isImplicitTls) {
      socket = tls.connect(options.port, options.host, { rejectUnauthorized: false }, onConnect);
    } else {
      socket = net.createConnection(options.port, options.host, onConnect);
    }

    socket.on('error', (err) => {
      clearTimeout(timeout);
      resolve({ ok: false, message: `SMTP socket error: ${err.message}`, latencyMs: Date.now() - startTime });
    });
  });
}

/**
 * Dispatches a real email over SMTP protocol.
 */
export async function sendSmtpEmail(
  options: SmtpServerOptions,
  mail: MailOptions
): Promise<{ ok: boolean; messageId: string; response: string }> {
  return new Promise((resolve, reject) => {
    const isImplicitTls = options.port === 465 || options.secure === true;
    let socket: net.Socket;
    const messageId = `<msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@${options.host}>`;

    const timeout = setTimeout(() => {
      if (socket) socket.destroy();
      reject(new Error('SMTP email transmission timed out after 10000ms'));
    }, options.timeoutMs || 10000);

    const onConnect = () => {
      let buffer = '';
      let step = 0;

      const send = (data: string) => {
        if (socket.writable) {
          socket.write(data + '\r\n');
        }
      };

      const handleResponse = (dataBuf: Buffer) => {
        buffer += dataBuf.toString();
        const lines = buffer.split('\r\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line) continue;
          const code = parseInt(line.slice(0, 3), 10);

          if (step === 0 && code === 220) {
            step = 1;
            send(`EHLO shanutechx.platform`);
          } else if (step === 1 && code === 250) {
            if (options.user && options.pass) {
              step = 2;
              const authPlain = Buffer.from(`\0${options.user}\0${options.pass}`).toString('base64');
              send(`AUTH PLAIN ${authPlain}`);
            } else {
              step = 3;
              send(`MAIL FROM:<${mail.from}>`);
            }
          } else if (step === 2 && (code === 235 || code === 250)) {
            step = 3;
            send(`MAIL FROM:<${mail.from}>`);
          } else if (step === 3 && code === 250) {
            step = 4;
            send(`RCPT TO:<${mail.to}>`);
          } else if (step === 4 && code === 250) {
            step = 5;
            send(`DATA`);
          } else if (step === 5 && code === 354) {
            step = 6;
            const plainText = mail.text || mail.html.replace(/<[^>]+>/g, '').trim();
            const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            
            const rawMessage = [
              `From: ${mail.from}`,
              `To: ${mail.to}`,
              `Subject: ${mail.subject}`,
              `Message-ID: ${messageId}`,
              `Date: ${new Date().toUTCString()}`,
              `MIME-Version: 1.0`,
              `Auto-Submitted: auto-generated`,
              `X-Auto-Response-Suppress: All`,
              `Precedence: bulk`,
              `List-Unsubscribe: <https://${options.host}/settings>`,
              `Content-Type: multipart/alternative; boundary="${boundary}"`,
              ``,
              `--${boundary}`,
              `Content-Type: text/plain; charset=UTF-8`,
              `Content-Transfer-Encoding: 8bit`,
              ``,
              plainText,
              ``,
              `--${boundary}`,
              `Content-Type: text/html; charset=UTF-8`,
              `Content-Transfer-Encoding: 8bit`,
              ``,
              mail.html,
              ``,
              `--${boundary}--`,
              `.`,
            ].join('\r\n');
            send(rawMessage);
          } else if (step === 6 && code === 250) {
            clearTimeout(timeout);
            send('QUIT');
            socket.end();
            resolve({ ok: true, messageId, response: line });
          } else if (code >= 400) {
            clearTimeout(timeout);
            socket.destroy();
            reject(new Error(`SMTP Error [${code}]: ${line}`));
          }
        }
      };

      socket.on('data', handleResponse);
    };

    if (isImplicitTls) {
      socket = tls.connect(options.port, options.host, { rejectUnauthorized: false }, onConnect);
    } else {
      socket = net.createConnection(options.port, options.host, onConnect);
    }

    socket.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`SMTP Transport Error: ${err.message}`));
    });
  });
}
