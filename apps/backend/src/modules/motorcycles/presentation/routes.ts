import {
  CreateMotorcycleSchema,
  UpdateMotorcycleSchema,
} from '@monopiston/contracts';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import type { SessionService } from '../../auth/application/session-service.js';
import {
  hasTrustedOrigin,
  requireUser,
} from '../../auth/presentation/routes.js';
import type { MotorcycleRepository } from '../domain/motorcycle-repository.js';

const motorcycleParamsSchema = z.object({ id: z.uuid() });

export interface MotorcycleRoutesOptions {
  appOrigin: string;
  repository: MotorcycleRepository;
  sessions: SessionService;
}

export const motorcycleRoutes: FastifyPluginAsync<
  MotorcycleRoutesOptions
> = async (app, options) => {
  app.get('/', async (request, reply) => {
    const user = await requireUser(request, reply, options.sessions);
    if (!user) return;
    return reply.send(await options.repository.listByOwner(user.id));
  });

  app.post('/', async (request, reply) => {
    if (!hasTrustedOrigin(request, options.appOrigin)) {
      return reply.status(403).send({ error: 'invalid_origin' });
    }
    const user = await requireUser(request, reply, options.sessions);
    if (!user) return;

    const input = CreateMotorcycleSchema.safeParse(request.body);
    if (!input.success) {
      return reply.status(400).send({
        error: 'validation_error',
        issues: input.error.issues,
      });
    }

    return reply
      .status(201)
      .send(await options.repository.create(user.id, input.data));
  });

  app.patch('/:id', async (request, reply) => {
    if (!hasTrustedOrigin(request, options.appOrigin)) {
      return reply.status(403).send({ error: 'invalid_origin' });
    }
    const user = await requireUser(request, reply, options.sessions);
    if (!user) return;

    const params = motorcycleParamsSchema.safeParse(request.params);
    const input = UpdateMotorcycleSchema.safeParse(request.body);
    if (!params.success || !input.success) {
      return reply.status(400).send({ error: 'validation_error' });
    }

    const motorcycle = await options.repository.update(
      user.id,
      params.data.id,
      input.data,
    );
    if (!motorcycle) return reply.status(404).send({ error: 'not_found' });
    return reply.send(motorcycle);
  });

  app.delete('/:id', async (request, reply) => {
    if (!hasTrustedOrigin(request, options.appOrigin)) {
      return reply.status(403).send({ error: 'invalid_origin' });
    }
    const user = await requireUser(request, reply, options.sessions);
    if (!user) return;

    const params = motorcycleParamsSchema.safeParse(request.params);
    if (!params.success)
      return reply.status(400).send({ error: 'validation_error' });

    const deleted = await options.repository.deactivate(
      user.id,
      params.data.id,
    );
    if (!deleted) return reply.status(404).send({ error: 'not_found' });
    return reply.status(204).send();
  });
};
