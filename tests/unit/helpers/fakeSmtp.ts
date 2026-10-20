import net from 'node:net';

/**
 * A minimal fake SMTP server (plain TCP, exactly the conversation sendSmtpEmail speaks) that records the
 * DATA section, so we can check what an attachment looks like on the wire.
 */
export function fakeSmtp(): Promise<{ port: number; data: () => string; close: () => void }> {
  return new Promise((resolve) => {
    let captured = '';
    const server = net.createServer((sock) => {
      let inData = false;
      let buf = '';
      sock.write('220 fake ESMTP\r\n');
      sock.on('data', (chunk) => {
        buf += chunk.toString('latin1');
        let idx: number;
        while ((idx = buf.indexOf('\r\n')) >= 0) {
          const line = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          if (inData) {
            if (line === '.') { inData = false; sock.write('250 queued\r\n'); } else captured += line + '\r\n';
            continue;
          }
          if (/^EHLO/i.test(line)) sock.write('250 hello\r\n');
          else if (/^AUTH/i.test(line)) sock.write('235 ok\r\n');
          else if (/^MAIL FROM/i.test(line) || /^RCPT TO/i.test(line)) sock.write('250 ok\r\n');
          else if (/^DATA/i.test(line)) { inData = true; sock.write('354 go\r\n'); }
          else if (/^QUIT/i.test(line)) { sock.write('221 bye\r\n'); sock.end(); }
        }
      });
    });
    server.listen(0, '127.0.0.1', () => resolve({ port: (server.address() as net.AddressInfo).port, data: () => captured, close: () => server.close() }));
  });
}
