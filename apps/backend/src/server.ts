import { createDatabaseClient } from '@monopiston/database';

import { buildApp } from './app.js';
import { parseEnvironment, resolveTrustProxy } from './config/env.js';
import { AdminService } from './modules/admin/application/admin-service.js';
import { AppointmentService } from './modules/appointments/application/appointment-service.js';
import { SessionService } from './modules/auth/application/session-service.js';
import { CustomerService } from './modules/customer/application/customer-service.js';
import { GoogleOidcClient } from './modules/auth/infrastructure/google-oidc.js';
import { PrismaAuthRepository } from './modules/auth/infrastructure/prisma-auth-repository.js';
import { createWhatsAppNotifier } from './modules/notifications/whatsapp-notifier.js';
import { PaymentService } from './modules/payments/application/payment-service.js';
import { FlowClient } from './modules/payments/infrastructure/flow-client.js';
import { PrismaMotorcycleRepository } from './modules/motorcycles/infrastructure/prisma-motorcycle-repository.js';
import { PrismaServiceRepository } from './modules/services/infrastructure/prisma-service-repository.js';
import { WorkshopAdminService } from './modules/workshop/application/workshop-admin-service.js';

const environment = parseEnvironment();
const database = createDatabaseClient(environment.DATABASE_URL);
const sessions = new SessionService(new PrismaAuthRepository(database));
const google = createGoogleClient();
const appointmentService = new AppointmentService(database);
const customerService = new CustomerService(database);
const motorcycleRepository = new PrismaMotorcycleRepository(database);
const flowClient = new FlowClient({
  apiBase: environment.FLOW_API_BASE,
  apiKey: environment.FLOW_API_KEY ?? '',
  secretKey: environment.FLOW_SECRET_KEY ?? '',
});
const paymentService = new PaymentService(
  database,
  flowClient,
  {
    currency: 'CLP',
    subjectPrefix: 'Reserva cita Monopiston',
    urlConfirmation:
      environment.FLOW_CONFIRM_URL ??
      `${environment.API_ORIGIN}/v1/payments/flow/confirm`,
    urlReturn:
      environment.FLOW_RETURN_URL ??
      `${environment.API_ORIGIN}/v1/payments/flow/return`,
  },
  createWhatsAppNotifier(environment.WHATSAPP_PROVIDER),
);
const app = await buildApp({
  admin: {
    admin: new AdminService(database),
    appOrigin: environment.APP_ORIGIN,
    sessions,
  },
  appointments: {
    appOrigin: environment.APP_ORIGIN,
    appointments: appointmentService,
    sessions,
  },
  auth: {
    allowDevLogin: environment.NODE_ENV !== 'production',
    apiOrigin: environment.API_ORIGIN,
    appOrigin: environment.APP_ORIGIN,
    ...(google && { google }),
    secureCookies: environment.COOKIE_SECURE,
    sessions,
  },
  appOrigin: environment.APP_ORIGIN,
  checkDatabase: async () => {
    await database.$queryRaw`SELECT 1`;
  },
  cookieSecret: environment.SESSION_SECRET,
  customer: {
    appOrigin: environment.APP_ORIGIN,
    customer: customerService,
    sessions,
  },
  motorcycles: {
    appOrigin: environment.APP_ORIGIN,
    repository: motorcycleRepository,
    sessions,
  },
  payments: {
    appOrigin: environment.APP_ORIGIN,
    payments: paymentService,
    returnPagePath: '/app/pago/retorno',
    sessions,
  },
  services: {
    repository: new PrismaServiceRepository(database),
  },
  trustProxy: resolveTrustProxy(environment),
  workshopAdmin: {
    appOrigin: environment.APP_ORIGIN,
    sessions,
    workshop: new WorkshopAdminService(database),
  },
});
const fastify = app.getHttpAdapter().getInstance();

async function reconcilePayments(): Promise<void> {
  try {
    const confirmed = await paymentService.reconcilePendingPayments();
    if (confirmed > 0) {
      fastify.log.info({ confirmed }, 'Reconciled paid payments from Flow');
    }
  } catch (error: unknown) {
    fastify.log.error({ err: error }, 'Failed to reconcile pending payments');
  }
}

async function expirePaymentHolds(): Promise<void> {
  try {
    const released = await paymentService.expireStaleHolds();
    if (released > 0) {
      fastify.log.info({ released }, 'Released expired payment holds');
    }
  } catch (error: unknown) {
    fastify.log.error({ err: error }, 'Failed to expire payment holds');
  }
}

async function catchUpPaymentMaintenance(): Promise<void> {
  // Render Free can suspend the process while idle. Run both maintenance
  // passes immediately after every cold start so payment and slot state catches
  // up without waiting for the first recurring interval.
  await reconcilePayments();
  await expirePaymentHolds();
}

// Periodically reconcile open payments against Flow so a lost webhook still
// confirms a paid booking (defense in depth). Runs before expiry on its own
// cadence so customers see confirmation even while the hold is still valid.
const RECONCILE_INTERVAL_MS = 3 * 60_000;
const reconcileTimer = setInterval(() => {
  void reconcilePayments();
}, RECONCILE_INTERVAL_MS);
reconcileTimer.unref();

// Periodically release slots whose payment hold elapsed without confirmation.
const EXPIRY_INTERVAL_MS = 5 * 60_000;
const expiryTimer = setInterval(() => {
  void expirePaymentHolds();
}, EXPIRY_INTERVAL_MS);
expiryTimer.unref();

fastify.addHook('onClose', async () => {
  clearInterval(reconcileTimer);
  clearInterval(expiryTimer);
  await database.$disconnect();
});

function createGoogleClient(): GoogleOidcClient | undefined {
  if (
    !environment.GOOGLE_CLIENT_ID ||
    !environment.GOOGLE_CLIENT_SECRET ||
    !environment.GOOGLE_REDIRECT_URI
  ) {
    return undefined;
  }

  return new GoogleOidcClient({
    clientId: environment.GOOGLE_CLIENT_ID,
    clientSecret: environment.GOOGLE_CLIENT_SECRET,
    redirectUri: environment.GOOGLE_REDIRECT_URI,
  });
}

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  fastify.log.info({ signal }, 'Shutting down');
  await app.close();
  process.exit(0);
};

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ host: environment.HOST, port: environment.PORT });
  void catchUpPaymentMaintenance();
} catch (error) {
  fastify.log.error(error);
  await app.close();
  process.exit(1);
}
