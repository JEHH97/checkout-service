import { createServer } from 'node:http';
import { Writable } from 'node:stream';
import pino from 'pino';
import pinoHttp from 'pino-http';
import request from 'supertest';
import { pinoHttpOptions } from '../../src/common/logger.config';

describe('HTTP log redaction', () => {
  it('omits authorization, cookie, set-cookie, password, and token values from request logs', async () => {
    const chunks: string[] = [];
    const stream = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        chunks.push(chunk.toString());
        callback();
      },
    });
    const logger = pino(pinoHttpOptions, stream);
    const middleware = pinoHttp({ logger });
    const server = createServer((req, res) => {
      middleware(req, res, () => {
        res.setHeader('Set-Cookie', 'session=response-cookie-secret');
        res.end('ok');
      });
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Expected TCP server address');
      await request(`http://127.0.0.1:${address.port}`)
        .get('/')
        .set('Authorization', 'Bearer request-jwt-secret')
        .set('Cookie', 'session=request-cookie-secret')
        .expect(200);
      logger.info({ password: 'password-secret', token: 'body-token-secret' }, 'test auth log');

      const output = chunks.join('');
      expect(output).toContain('[REDACTED]');
      for (const secret of [
        'request-jwt-secret',
        'request-cookie-secret',
        'response-cookie-secret',
        'password-secret',
        'body-token-secret',
      ]) {
        expect(output).not.toContain(secret);
      }
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
