import {
  AdminMetricsFiltersSchema,
  CreateAdminUserSchema,
  UpdateUserSchema,
} from '@monopiston/contracts';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import type { AdminService } from '../application/admin-service.js';
import { AdminUserError } from '../application/admin-service.js';
import type { SessionService } from '../../auth/application/session-service.js';
import {
  hasTrustedOrigin,
  requireUser,
} from '../../auth/presentation/routes.js';

const idParamsSchema = z.object({ id: z.uuid() });
const metricsQuerySchema = z.object({
  from: z.string(),
  to: z.string(),
});

export interface AdminRoutesOptions {
  admin: Pick<
    AdminService,
    'createUser' | 'deleteUser' | 'getMetrics' | 'listUsers' | 'updateUser'
  >;
  appOrigin: string;
  sessions: SessionService;
}

export const adminRoutes: FastifyPluginAsync<AdminRoutesOptions> = async (
  app,
  options,
) => {
  app.get('/users', async (request, reply) => {
    if (!(await requireAdmin(request, reply, options.sessions))) return;
    return reply.send(await options.admin.listUsers());
  });

  app.post('/users', async (request, reply) => {
    const admin = await requireMutationAdmin(request, reply, options);
    if (!admin) return;
    const input = CreateAdminUserSchema.safeParse(request.body);
    if (!input.success) {
      return reply.status(400).send({ error: 'validation_error' });
    }
    try {
      return reply.status(201).send(await options.admin.createUser(input.data));
    } catch (error) {
      return handleAdminUserError(error, reply);
    }
  });

  app.patch('/users/:id', async (request, reply) => {
    const admin = await requireMutationAdmin(request, reply, options);
    if (!admin) return;
    const params = idParamsSchema.safeParse(request.params);
    const input = UpdateUserSchema.safeParse(request.body);
    if (!params.success || !input.success) {
      return reply.status(400).send({ error: 'validation_error' });
    }
    try {
      return reply.send(
        await options.admin.updateUser(admin.id, params.data.id, input.data),
      );
    } catch (error) {
      return handleAdminUserError(error, reply);
    }
  });

  app.delete('/users/:id', async (request, reply) => {
    const admin = await requireMutationAdmin(request, reply, options);
    if (!admin) return;
    const params = idParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: 'validation_error' });
    }
    try {
      await options.admin.deleteUser(admin.id, params.data.id);
      return reply.status(204).send();
    } catch (error) {
      return handleAdminUserError(error, reply);
    }
  });

  app.get('/metrics', async (request, reply) => {
    if (!(await requireAdmin(request, reply, options.sessions))) return;
    const query = metricsQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.status(400).send({ error: 'validation_error' });
    }
    const filters = AdminMetricsFiltersSchema.safeParse(query.data);
    if (!filters.success) {
      return reply.status(400).send({ error: 'validation_error' });
    }
    return reply.send(await options.admin.getMetrics(filters.data));
  });
};

function handleAdminUserError(error: unknown, reply: FastifyReply) {
  if (error instanceof AdminUserError) {
    const status = error.message === 'user_not_found' ? 404 : 409;
    return reply.status(status).send({ error: error.message });
  }
  throw error;
}

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
  options: AdminRoutesOptions,
) {
  if (!hasTrustedOrigin(request, options.appOrigin)) {
    await reply.status(403).send({ error: 'invalid_origin' });
    return null;
  }
  return requireAdmin(request, reply, options.sessions);
}
