import { UpdatePaymentSettingsSchema } from '@monopiston/contracts';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import type { SessionService } from '../../auth/application/session-service.js';
import {
  hasTrustedOrigin,
  requireUser,
} from '../../auth/presentation/routes.js';
import {
  PaymentError,
  type PaymentService,
} from '../application/payment-service.js';

const appointmentParamsSchema = z.object({ id: z.uuid() });
const statusParamsSchema = z.object({ appointmentId: z.uuid() });
const webhookBodySchema = z.object({ token: z.string().min(1).max(120) });

export interface PaymentRoutesOptions {
  appOrigin: string;
  payments: Pick<
    PaymentService,
    | 'confirmFromWebhook'
    | 'createForAppointment'
    | 'getSettings'
    | 'getStatusView'
    | 'updateSettings'
  >;
  returnPagePath: string;
  sessions: SessionService;
}

export const paymentRoutes: FastifyPluginAsync<PaymentRoutesOptions> = async (
  app,
  options,
) => {
  // Flow posts the webhook and the return redirect as urlencoded form data.
  app.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_request, body, done) => {
      try {
        done(null, Object.fromEntries(new URLSearchParams(body as string)));
      } catch (error) {
        done(error as Error);
      }
    },
  );

  // Create the Flow order for a held appointment and return the redirect URL.
  app.post(
    '/appointments/:id/payment',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      if (!hasTrustedOrigin(request, options.appOrigin)) {
        return reply.status(403).send({ error: 'invalid_origin' });
      }
      const user = await requireUser(request, reply, options.sessions);
      if (!user) return;
      const params = appointmentParamsSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(400).send({ error: 'validation_error' });
      }
      try {
        return reply.send(
          await options.payments.createForAppointment(user.id, params.data.id),
        );
      } catch (error) {
        return handlePaymentError(error, reply);
      }
    },
  );

  // Read model for the return page to reconstruct the receipt.
  app.get('/payments/:appointmentId/status', async (request, reply) => {
    const user = await requireUser(request, reply, options.sessions);
    if (!user) return;
    const params = statusParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: 'validation_error' });
    }
    try {
      return reply.send(
        await options.payments.getStatusView(
          user.id,
          params.data.appointmentId,
        ),
      );
    } catch (error) {
      return handlePaymentError(error, reply);
    }
  });

  // Flow webhook (urlConfirmation). Authenticated by re-querying Flow's API,
  // never by trusting this request. No Origin/CSRF check: it is server-to-server.
  app.post(
    '/payments/flow/confirm',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = webhookBodySchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: 'validation_error' });
      }
      try {
        await options.payments.confirmFromWebhook(body.data.token);
        return reply.status(200).send({ received: true });
      } catch (error) {
        if (error instanceof PaymentError) {
          return reply.status(404).send({ error: error.message });
        }
        throw error;
      }
    },
  );

  // Flow return (urlReturn): bounce the browser back to the SPA receipt page.
  // The SPA remembers the appointment id locally and polls the authenticated
  // status endpoint, so no trust is placed on this redirect.
  app.post('/payments/flow/return', async (_request, reply) =>
    redirectToReturnPage(reply, options),
  );
  app.get('/payments/flow/return', async (_request, reply) =>
    redirectToReturnPage(reply, options),
  );

  app.get('/admin/payment-settings', async (request, reply) => {
    const admin = await requireAdmin(request, reply, options);
    if (!admin) return;
    return reply.send(await options.payments.getSettings());
  });

  app.patch('/admin/payment-settings', async (request, reply) => {
    if (!hasTrustedOrigin(request, options.appOrigin)) {
      return reply.status(403).send({ error: 'invalid_origin' });
    }
    const admin = await requireAdmin(request, reply, options);
    if (!admin) return;
    const input = UpdatePaymentSettingsSchema.safeParse(request.body);
    if (!input.success) {
      return reply.status(400).send({ error: 'validation_error' });
    }
    return reply.send(await options.payments.updateSettings(input.data));
  });
};

function redirectToReturnPage(
  reply: FastifyReply,
  options: PaymentRoutesOptions,
) {
  const url = new URL(options.returnPagePath, options.appOrigin);
  return reply.redirect(url.href);
}

async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
  options: PaymentRoutesOptions,
) {
  const user = await requireUser(request, reply, options.sessions);
  if (!user) return null;
  if (user.role !== 'admin') {
    await reply.status(403).send({ error: 'forbidden' });
    return null;
  }
  return user;
}

function handlePaymentError(error: unknown, reply: FastifyReply) {
  if (error instanceof PaymentError) {
    const status = error.message.endsWith('not_found') ? 404 : 409;
    return reply.status(status).send({ error: error.message });
  }
  throw error;
}
