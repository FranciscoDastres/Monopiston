import type { AdminService, BusinessHour } from '@monopiston/contracts';

import { buildApp } from '../src/app.js';
import { SessionService } from '../src/modules/auth/application/session-service.js';
import {
  MemoryAuthRepository,
  testUser,
} from './helpers/memory-auth-repository.js';

const service: AdminService = {
  code: 'DIAGNOSTICO',
  currency: 'CLP',
  description: 'Diagnóstico general',
  durationMinutes: 45,
  id: '984a5c7b-2163-47d7-964d-e882388e1a2c',
  isActive: true,
  name: 'Diagnóstico',
  price: 15000,
};
const hour: BusinessHour = {
  closesAt: '18:00',
  id: '3f8ccf80-bec1-4411-b9d7-2c44c19e05e4',
  opensAt: '09:00',
  slotMinutes: 30,
  validFrom: '2026-01-01',
  validUntil: null,
  weekday: 1,
};

describe('workshop administration routes', () => {
  it('rejects customers and returns configuration to administrators', async () => {
    const customerApp = await createApp(false);
    const forbidden = await customerApp.inject({
      headers: { cookie: 'drp_session=test-session' },
      method: 'GET',
      url: '/v1/admin/workshop/services',
    });
    expect(forbidden.statusCode).toBe(403);
    await customerApp.close();

    const adminApp = await createApp(true);
    const accepted = await adminApp.inject({
      headers: { cookie: 'drp_session=test-session' },
      method: 'GET',
      url: '/v1/admin/workshop/services',
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json()).toEqual([service]);
    await adminApp.close();
  });
});

async function createApp(admin: boolean) {
  const authRepository = new MemoryAuthRepository();
  if (admin) authRepository.user = { ...testUser, role: 'admin' };
  return buildApp({
    appOrigin: 'http://localhost:5173',
    checkDatabase: async () => undefined,
    logger: false,
    workshopAdmin: {
      appOrigin: 'http://localhost:5173',
      sessions: new SessionService(authRepository),
      workshop: {
        createException: async () => ({
          capacityOverride: null,
          endsAt: '2027-01-01T23:59:00.000Z',
          id: '884a5c7b-2163-47d7-964d-e882388e1a2c',
          kind: 'closed',
          reason: null,
          startsAt: '2027-01-01T00:00:00.000Z',
        }),
        createService: async () => service,
        deleteBusinessHour: async () => undefined,
        deleteException: async () => undefined,
        listBusinessHours: async () => [hour],
        listExceptions: async () => [],
        listServices: async () => [service],
        saveBusinessHour: async () => hour,
        updateService: async () => service,
      },
    },
  });
}
