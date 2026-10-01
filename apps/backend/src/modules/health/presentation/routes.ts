import type { HealthResponse } from '@monopiston/contracts';
import type { FastifyPluginAsync } from 'fastify';

export interface HealthRoutesOptions {
  checkDatabase: () => Promise<void>;
}

export const healthRoutes: FastifyPluginAsync<HealthRoutesOptions> = async (
  app,
  options,
) => {
  app.get('/live', async (_request, reply) => {
    const response: HealthResponse = {
      service: 'monopiston-api',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };

    return reply.send(response);
  });

  app.get('/ready', async (_request, reply) => {
    try {
      await options.checkDatabase();

      const response: HealthResponse = {
        service: 'monopiston-api',
        status: 'ok',
        timestamp: new Date().toISOString(),
        checks: { database: 'ok' },
      };

      return reply.send(response);
    } catch (error) {
      app.log.error({ err: error }, 'Database readiness check failed');

      const response: HealthResponse = {
        service: 'monopiston-api',
        status: 'degraded',
        timestamp: new Date().toISOString(),
        checks: { database: 'degraded' },
      };

      return reply.status(503).send(response);
    }
  });
};
