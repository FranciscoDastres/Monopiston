import {
  CreateScheduleExceptionSchema,
  CreateServiceSchema,
  SaveBusinessHourSchema,
  UpdateServiceSchema,
} from '@monopiston/contracts';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import type { SessionService } from '../../auth/application/session-service.js';
import {
  hasTrustedOrigin,
  requireUser,
} from '../../auth/presentation/routes.js';
import {
  type WorkshopAdminService,
  WorkshopInputError,
  WorkshopResourceNotFoundError,
} from '../application/workshop-admin-service.js';

const idParamsSchema = z.object({ id: z.uuid() });

export interface WorkshopAdminRoutesOptions {
  appOrigin: string;
  sessions: SessionService;
  workshop: Pick<
    WorkshopAdminService,
    | 'createException'
    | 'createService'
    | 'deleteBusinessHour'
    | 'deleteException'
    | 'listBusinessHours'
    | 'listExceptions'
    | 'listServices'
    | 'saveBusinessHour'
    | 'updateService'
  >;
}

export const workshopAdminRoutes: FastifyPluginAsync<
  WorkshopAdminRoutesOptions
> = async (app, options) => {
  app.get('/services', async (request, reply) => {
    if (!(await requireAdmin(request, reply, options.sessions))) return;
    return reply.send(await options.workshop.listServices());
  });

  app.post('/services', async (request, reply) => {
    const admin = await requireMutationAdmin(request, reply, options);
    if (!admin) return;
    const input = CreateServiceSchema.safeParse(request.body);
    if (!input.success)
      return reply.status(400).send({ error: 'validation_error' });
    return reply
      .status(201)
      .send(await options.workshop.createService(input.data));
  });

  app.patch('/services/:id', async (request, reply) => {
    const admin = await requireMutationAdmin(request, reply, options);
    if (!admin) return;
    const params = idParamsSchema.safeParse(request.params);
    const input = UpdateServiceSchema.safeParse(request.body);
    if (!params.success || !input.success) {
      return reply.status(400).send({ error: 'validation_error' });
    }
    try {
      return reply.send(
        await options.workshop.updateService(params.data.id, input.data),
      );
    } catch (error) {
      return handleWorkshopError(error, reply);
    }
  });

  app.get('/hours', async (request, reply) => {
    if (!(await requireAdmin(request, reply, options.sessions))) return;
    return reply.send(await options.workshop.listBusinessHours());
  });

  app.post('/hours', async (request, reply) => {
    const admin = await requireMutationAdmin(request, reply, options);
    if (!admin) return;
    const input = SaveBusinessHourSchema.safeParse(request.body);
    if (!input.success)
      return reply.status(400).send({ error: 'validation_error' });
    try {
      return reply
        .status(201)
        .send(await options.workshop.saveBusinessHour(input.data));
    } catch (error) {
      return handleWorkshopError(error, reply);
    }
  });

  app.delete('/hours/:id', async (request, reply) => {
    const admin = await requireMutationAdmin(request, reply, options);
    if (!admin) return;
    const params = idParamsSchema.safeParse(request.params);
    if (!params.success)
      return reply.status(400).send({ error: 'validation_error' });
    try {
      await options.workshop.deleteBusinessHour(params.data.id);
      return reply.status(204).send();
    } catch (error) {
      return handleWorkshopError(error, reply);
    }
  });

  app.get('/exceptions', async (request, reply) => {
    if (!(await requireAdmin(request, reply, options.sessions))) return;
    return reply.send(await options.workshop.listExceptions());
  });

  app.post('/exceptions', async (request, reply) => {
    const admin = await requireMutationAdmin(request, reply, options);
    if (!admin) return;
    const input = CreateScheduleExceptionSchema.safeParse(request.body);
    if (!input.success)
      return reply.status(400).send({ error: 'validation_error' });
    try {
      return reply
        .status(201)
        .send(await options.workshop.createException(admin.id, input.data));
    } catch (error) {
      return handleWorkshopError(error, reply);
    }
  });

  app.delete('/exceptions/:id', async (request, reply) => {
    const admin = await requireMutationAdmin(request, reply, options);
    if (!admin) return;
    const params = idParamsSchema.safeParse(request.params);
    if (!params.success)
      return reply.status(400).send({ error: 'validation_error' });
    try {
      await options.workshop.deleteException(params.data.id);
      return reply.status(204).send();
    } catch (error) {
      return handleWorkshopError(error, reply);
    }
  });
};

async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
  sessions: SessionService,
) {
  const user = await requireUser(request, reply, sessions);
  if (!user) return null;
  if (user.role !== 'admin') {
    await reply.status(403).send({ error: 'forbidden' });
    return null;
  }
  return user;
}

async function requireMutationAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
  options: WorkshopAdminRoutesOptions,
) {
  if (!hasTrustedOrigin(request, options.appOrigin)) {
    await reply.status(403).send({ error: 'invalid_origin' });
    return null;
  }
  return requireAdmin(request, reply, options.sessions);
}

function handleWorkshopError(error: unknown, reply: FastifyReply) {
  if (error instanceof WorkshopResourceNotFoundError) {
    return reply.status(404).send({ error: 'not_found' });
  }
  if (error instanceof WorkshopInputError) {
    return reply.status(400).send({ error: error.message });
  }
  throw error;
}
