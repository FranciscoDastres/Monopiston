import {
  CompleteAppointmentWorkSchema,
  CreateReportPresetSchema,
  ReportPresetQuerySchema,
} from '@monopiston/contracts';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import type { SessionService } from '../../auth/application/session-service.js';
import {
  hasTrustedOrigin,
  requireUser,
} from '../../auth/presentation/routes.js';
import {
  CustomerResourceError,
  type CustomerService,
} from '../application/customer-service.js';

const idParamsSchema = z.object({ id: z.uuid() });

export interface CustomerRoutesOptions {
  appOrigin: string;
  customer: Pick<
    CustomerService,
    | 'completeAppointmentWork'
    | 'createReportPreset'
    | 'getDashboard'
    | 'listHistory'
    | 'listInvoices'
    | 'listReportPresets'
    | 'renderInvoicePdf'
  >;
  sessions: SessionService;
}

export const customerRoutes: FastifyPluginAsync<CustomerRoutesOptions> = async (
  app,
  options,
) => {
  app.get('/customer/dashboard', async (request, reply) => {
    const user = await requireUser(request, reply, options.sessions);
    if (!user) return;
    return reply.send(await options.customer.getDashboard(user.id));
  });

  app.get('/customer/history', async (request, reply) => {
    const user = await requireUser(request, reply, options.sessions);
    if (!user) return;
    return reply.send(await options.customer.listHistory(user.id));
  });

  app.get('/invoices', async (request, reply) => {
    const user = await requireUser(request, reply, options.sessions);
    if (!user) return;
    return reply.send(await options.customer.listInvoices(user.id));
  });

  app.get('/invoices/:id/pdf', async (request, reply) => {
    const user = await requireUser(request, reply, options.sessions);
    if (!user) return;
    const params = idParamsSchema.safeParse(request.params);
    if (!params.success)
      return reply.status(400).send({ error: 'validation_error' });
    try {
      const pdf = await options.customer.renderInvoicePdf(
        user.id,
        params.data.id,
      );
      return reply
        .header('Content-Disposition', `attachment; filename="${pdf.filename}"`)
        .header('Content-Type', 'application/pdf')
        .send(pdf.buffer);
    } catch (error) {
      return handleCustomerError(error, reply);
    }
  });

  app.post('/admin/appointments/:id/complete-work', async (request, reply) => {
    const admin = await requireMutationAdmin(request, reply, options);
    if (!admin) return;
    const params = idParamsSchema.safeParse(request.params);
    const input = CompleteAppointmentWorkSchema.safeParse(request.body);
    if (!params.success || !input.success) {
      return reply.status(400).send({ error: 'validation_error' });
    }
    try {
      return reply
        .status(201)
        .send(
          await options.customer.completeAppointmentWork(
            admin.id,
            params.data.id,
            input.data,
          ),
        );
    } catch (error) {
      return handleCustomerError(error, reply);
    }
  });

  app.get('/admin/report-presets', async (request, reply) => {
    const user = await requireUser(request, reply, options.sessions);
    if (!user) return;
    if (user.role !== 'admin') {
      return reply.status(403).send({ error: 'forbidden' });
    }
    const query = ReportPresetQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.status(400).send({ error: 'validation_error' });
    }
    return reply.send(
      await options.customer.listReportPresets(query.data.kind),
    );
  });

  app.post('/admin/report-presets', async (request, reply) => {
    const admin = await requireMutationAdmin(request, reply, options);
    if (!admin) return;
    const input = CreateReportPresetSchema.safeParse(request.body);
    if (!input.success) {
      return reply.status(400).send({ error: 'validation_error' });
    }
    try {
      return reply
        .status(201)
        .send(await options.customer.createReportPreset(admin.id, input.data));
    } catch (error) {
      return handleCustomerError(error, reply);
    }
  });
};

async function requireMutationAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
  options: CustomerRoutesOptions,
) {
  if (!hasTrustedOrigin(request, options.appOrigin)) {
    await reply.status(403).send({ error: 'invalid_origin' });
    return null;
  }
  const user = await requireUser(request, reply, options.sessions);
  if (!user) return null;
  if (user.role !== 'admin') {
    await reply.status(403).send({ error: 'forbidden' });
    return null;
  }
  return user;
}

function handleCustomerError(error: unknown, reply: FastifyReply) {
  if (error instanceof CustomerResourceError) {
    const status = error.message.endsWith('not_found') ? 404 : 409;
    return reply.status(status).send({ error: error.message });
  }
  throw error;
}
