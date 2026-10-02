import type { FastifyInstance } from 'fastify';

import { buildApp } from '../src/app.js';

describe('health routes', () => {
  it('does not accept a spoofed client IP with legacy numeric proxy trust', async () => {
    const app = await buildApp({
      appOrigin: 'http://localhost:5173',
      checkDatabase: async () => undefined,
      logger: false,
      trustProxy: 1,
    });
    const server: FastifyInstance = app.getHttpAdapter().getInstance();
    server.get('/test/client-ip', async (request) => ({ ip: request.ip }));

    try {
      const response = await app.inject({
        headers: { 'x-forwarded-for': '203.0.113.42' },
        method: 'GET',
        remoteAddress: '127.0.0.1',
        url: '/test/client-ip',
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ ip: '127.0.0.1' });
    } finally {
      await app.close();
    }
  });

  it('reports the process as alive', async () => {
    const app = await buildApp({
      appOrigin: 'http://localhost:5173',
      checkDatabase: async () => undefined,
      logger: false,
    });

    const response = await app.inject({ method: 'GET', url: '/health/live' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      service: 'monopiston-api',
      status: 'ok',
    });

    await app.close();
  });

  it('reports database failure as not ready', async () => {
    const app = await buildApp({
      appOrigin: 'http://localhost:5173',
      checkDatabase: async () => {
        throw new Error('database unavailable');
      },
      logger: false,
    });

    const response = await app.inject({ method: 'GET', url: '/health/ready' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      status: 'degraded',
      checks: { database: 'degraded' },
    });

    await app.close();
  });
});
