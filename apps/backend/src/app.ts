import 'reflect-metadata';

import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import type { FastifyServerOptions } from 'fastify';

import {
  adminRoutes,
  type AdminRoutesOptions,
} from './modules/admin/presentation/routes.js';
import {
  appointmentRoutes,
  type AppointmentRoutesOptions,
} from './modules/appointments/presentation/routes.js';
import {
  authRoutes,
  type AuthRoutesOptions,
} from './modules/auth/presentation/routes.js';
import {
  customerRoutes,
  type CustomerRoutesOptions,
} from './modules/customer/presentation/routes.js';
import {
  motorcycleRoutes,
  type MotorcycleRoutesOptions,
} from './modules/motorcycles/presentation/routes.js';
import {
  paymentRoutes,
  type PaymentRoutesOptions,
} from './modules/payments/presentation/routes.js';
import {
  serviceRoutes,
  type ServiceRoutesOptions,
} from './modules/services/presentation/routes.js';
import {
  type WorkshopAdminRoutesOptions,
  workshopAdminRoutes,
} from './modules/workshop/presentation/routes.js';
import { AppModule } from './nest/app.module.js';

export interface BuildAppOptions {
  admin?: AdminRoutesOptions;
  appOrigin: string;
  appointments?: AppointmentRoutesOptions;
  auth?: AuthRoutesOptions;
  checkDatabase: () => Promise<void>;
  cookieSecret?: string;
  customer?: CustomerRoutesOptions;
  logger?: FastifyServerOptions['logger'];
  motorcycles?: MotorcycleRoutesOptions;
  payments?: PaymentRoutesOptions;
  services?: ServiceRoutesOptions;
  // Value for Fastify's `trustProxy`. Defaults to `false` (use the socket IP) so
  // forged `X-Forwarded-For` headers cannot poison `request.ip`.
  trustProxy?: boolean | number | string;
  workshopAdmin?: WorkshopAdminRoutesOptions;
}

// Header keys whose values are secrets (session cookie, bearer token). pino
// strips them from any logged object so they never reach the log sink, even if
// a custom log call or a changed serializer includes raw headers.
const REDACTED_LOG_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'res.headers["set-cookie"]',
  'headers.cookie',
  'headers.authorization',
  'headers["set-cookie"]',
];

// Apply the redaction config whenever logging is enabled, preserving any extra
// pino options (e.g. a custom `stream` in tests).
export function resolveLoggerOptions(
  logger: FastifyServerOptions['logger'],
): NonNullable<FastifyServerOptions['logger']> {
  if (logger === false) return false;
  const redact = { paths: REDACTED_LOG_PATHS, remove: true };
  if (logger === undefined || logger === true) {
    return { redact };
  }
  return { redact, ...(logger as Record<string, unknown>) };
}

export async function buildApp({
  admin,
  appOrigin,
  appointments,
  auth,
  checkDatabase,
  cookieSecret = 'test-cookie-secret-must-have-32-characters',
  customer,
  logger = true,
  motorcycles,
  payments,
  services,
  trustProxy = false,
  workshopAdmin,
}: BuildAppOptions): Promise<NestFastifyApplication> {
  const adapter = new FastifyAdapter({
    disableRequestLogging: false,
    logger: resolveLoggerOptions(logger),
    // Fastify 5.12 fails closed for numeric hop counts; use an IP/CIDR allowlist.
    trustProxy: typeof trustProxy === 'number' ? false : trustProxy,
  });
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.register({ checkDatabase }),
    adapter,
    { logger: false },
  );

  // Security headers (X-Content-Type-Options, X-Frame-Options, HSTS, etc.).
  // CORP is relaxed to cross-origin so the separate frontend can consume the API.
  await app.register(helmet, {
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
  // Per-IP throttling to mitigate brute force and abuse.
  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
  });

  await app.register(cors, {
    credentials: true,
    origin: appOrigin,
  });
  await app.register(cookie, { secret: cookieSecret });

  if (auth) await app.register(authRoutes, { ...auth, prefix: '/v1/auth' });
  if (customer) {
    await app.register(customerRoutes, { ...customer, prefix: '/v1' });
  }
  if (appointments) {
    await app.register(appointmentRoutes, { ...appointments, prefix: '/v1' });
  }
  if (payments) {
    await app.register(paymentRoutes, { ...payments, prefix: '/v1' });
  }
  if (motorcycles) {
    await app.register(motorcycleRoutes, {
      ...motorcycles,
      prefix: '/v1/motorcycles',
    });
  }
  if (services) {
    await app.register(serviceRoutes, { ...services, prefix: '/v1/services' });
  }
  if (workshopAdmin) {
    await app.register(workshopAdminRoutes, {
      ...workshopAdmin,
      prefix: '/v1/admin/workshop',
    });
  }
  if (admin) {
    await app.register(adminRoutes, { ...admin, prefix: '/v1/admin' });
  }

  await app.init();

  return app;
}
