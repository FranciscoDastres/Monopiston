import type { PaymentSettings, PaymentStatusView } from '@monopiston/contracts';

import { buildApp } from '../src/app.js';
import type { PaymentRoutesOptions } from '../src/modules/payments/presentation/routes.js';
import { SessionService } from '../src/modules/auth/application/session-service.js';
import {
  MemoryAuthRepository,
  testUser,
} from './helpers/memory-auth-repository.js';

const appointmentId = '78c865ca-8224-4e9e-a2e2-a9eddf4fb844';
const settings: PaymentSettings = {
  depositFixed: 10_000,
  depositPercent: 30,
  holdMinutes: 30,
  mode: 'total',
};
const statusView: PaymentStatusView = {
  amount: 24_990,
  appointmentId,
  currency: 'CLP',
  invoiceId: null,
  status: 'pending',
};

describe('payment routes', () => {
  it('rejects payment creation without a trusted origin', async () => {
    const app = await createApp();
    const response = await app.inject({
      headers: { cookie: 'drp_session=test-session' },
      method: 'POST',
      url: `/v1/appointments/${appointmentId}/payment`,
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it('returns the Flow redirect URL for the authenticated owner', async () => {
    const createForAppointment = vi.fn(async () => ({
      redirectUrl: 'https://sandbox.flow.cl/app/web/pay.php?token=abc',
    }));
    const app = await createApp(false, { createForAppointment });
    const response = await app.inject({
      headers: {
        cookie: 'drp_session=test-session',
        origin: 'http://localhost:5173',
      },
      method: 'POST',
      url: `/v1/appointments/${appointmentId}/payment`,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      redirectUrl: 'https://sandbox.flow.cl/app/web/pay.php?token=abc',
    });
    expect(createForAppointment).toHaveBeenCalledWith(
      testUser.id,
      appointmentId,
    );
    await app.close();
  });

  it('processes the Flow webhook from urlencoded form data without an origin', async () => {
    const confirmFromWebhook = vi.fn(async () => undefined);
    const app = await createApp(false, { confirmFromWebhook });
    const response = await app.inject({
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      method: 'POST',
      payload: 'token=flow-token-123',
      url: '/v1/payments/flow/confirm',
    });
    expect(response.statusCode).toBe(200);
    expect(confirmFromWebhook).toHaveBeenCalledWith('flow-token-123');
    await app.close();
  });

  it('lets only administrators read payment settings', async () => {
    const customerApp = await createApp();
    const forbidden = await customerApp.inject({
      headers: { cookie: 'drp_session=test-session' },
      method: 'GET',
      url: '/v1/admin/payment-settings',
    });
    expect(forbidden.statusCode).toBe(403);
    await customerApp.close();

    const adminApp = await createApp(true);
    const accepted = await adminApp.inject({
      headers: { cookie: 'drp_session=test-session' },
      method: 'GET',
      url: '/v1/admin/payment-settings',
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json()).toEqual(settings);
    await adminApp.close();
  });
});

async function createApp(
  admin = false,
  overrides: Partial<PaymentRoutesOptions['payments']> = {},
) {
  const authRepository = new MemoryAuthRepository();
  if (admin) authRepository.user = { ...testUser, role: 'admin' };
  const sessions = new SessionService(authRepository);
  return buildApp({
    appOrigin: 'http://localhost:5173',
    checkDatabase: async () => undefined,
    logger: false,
    payments: {
      appOrigin: 'http://localhost:5173',
      payments: {
        confirmFromWebhook: async () => undefined,
        createForAppointment: async () => ({ redirectUrl: 'https://x/y' }),
        getSettings: async () => settings,
        getStatusView: async () => statusView,
        updateSettings: async () => settings,
        ...overrides,
      },
      returnPagePath: '/app/pago/retorno',
      sessions,
    },
  });
}
