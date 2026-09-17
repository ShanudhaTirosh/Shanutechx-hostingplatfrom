import net from 'net';
import tls from 'tls';
import crypto from 'crypto';
import { logger } from './logger';

export interface SmtpServerOptions {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure?: boolean; // true for 465, false for 587/25
  timeoutMs?: number;
  /**
   * Set to true ONLY when connecting to a provisioned server that uses a
   * self-signed certificate (e.g. internal Mailu instances). When false
   * (the default), TLS certificate validation is enforced and connections
   * to servers with invalid/untrusted certs will be rejected, preventing
   * man-in-the-middle attacks on credential transmission.
   */
  allowSelfSigned?: boolean;
}

export interface MailAttachment {
  filename: string;
  content?: string;
  url?: string;
  contentType?: string;
}

export interface MailOptions {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: MailAttachment[];
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
      // rejectUnauthorized defaults to true (enforce TLS cert validation).
      // Only disable if caller explicitly opts in for known self-signed servers.
      socket = tls.connect(
        options.port,
        options.host,
        { rejectUnauthorized: !options.allowSelfSigned },
        onConnect
      );
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
    const messageId = `<msg_${Date.now()}_${crypto.randomBytes(6).toString('hex')}@${options.host}>`;

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
            const hasAttachments = Array.isArray(mail.attachments) && mail.attachments.length > 0;
            const mixedBoundary = `----=_Mixed_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
            const altBoundary = `----=_Alt_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;

            let rawLines: string[] = [
              `From: ${mail.from}`,
              `To: ${mail.to}`,
              `Subject: ${mail.subject}`,
              `Message-ID: ${messageId}`,
              `Date: ${new Date().toUTCString()}`,
              `MIME-Version: 1.0`,
              `Auto-Submitted: auto-generated`,
            ];

            if (hasAttachments) {
              rawLines.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`, ``);
              rawLines.push(`--${mixedBoundary}`);
              rawLines.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`, ``);
            } else {
              rawLines.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`, ``);
            }

            rawLines.push(
              `--${altBoundary}`,
              `Content-Type: text/plain; charset=UTF-8`,
              `Content-Transfer-Encoding: 8bit`,
              ``,
              plainText,
              ``,
              `--${altBoundary}`,
              `Content-Type: text/html; charset=UTF-8`,
              `Content-Transfer-Encoding: 8bit`,
              ``,
              mail.html,
              ``,
              `--${altBoundary}--`
            );

            if (hasAttachments && mail.attachments) {
              for (const att of mail.attachments) {
                const mimeType = att.contentType || 'application/octet-stream';
                const base64Data = att.content ? att.content.replace(/^data:[^;]+;base64,/, '') : '';
                rawLines.push(
                  ``,
                  `--${mixedBoundary}`,
                  `Content-Type: ${mimeType}; name="${att.filename}"`,
                  `Content-Disposition: attachment; filename="${att.filename}"`,
                  `Content-Transfer-Encoding: base64`,
                  ``,
                  base64Data
                );
              }
              rawLines.push(``, `--${mixedBoundary}--`);
            }

            rawLines.push(`.`);
            send(rawLines.join('\r\n'));
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
      // rejectUnauthorized defaults to true (enforce TLS cert validation).
      // Only disable if caller explicitly opts in for known self-signed servers.
      socket = tls.connect(
        options.port,
        options.host,
        { rejectUnauthorized: !options.allowSelfSigned },
        onConnect
      );
    } else {
      socket = net.createConnection(options.port, options.host, onConnect);
    }

    socket.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`SMTP Transport Error: ${err.message}`));
    });
  });
}
