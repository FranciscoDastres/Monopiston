import type { AdminMetrics, AdminUser } from '@monopiston/contracts';

import { buildApp } from '../src/app.js';
import { SessionService } from '../src/modules/auth/application/session-service.js';
import {
  MemoryAuthRepository,
  testUser,
} from './helpers/memory-auth-repository.js';

const customer: AdminUser = {
  appointmentCount: 0,
  createdAt: '2026-06-23T12:00:00.000Z',
  displayName: 'Cliente Nuevo',
  email: 'cliente@example.com',
  id: '78c865ca-8224-4e9e-a2e2-a9eddf4fb844',
  isActive: true,
  isPrimaryAdmin: false,
  phone: '+56912345678',
  role: 'customer',
  totalSpent: 0,
};
const metrics: AdminMetrics = {
  appointmentsByStatus: {},
  averageTicket: 0,
  completedCount: 0,
  newUsersByDay: [],
  newUsersCount: 0,
  pendingRequests: 0,
  revenueByDay: [],
  revenueByService: [],
  totalRevenue: 0,
};

describe('admin user routes', () => {
  it('creates and deletes customers with trusted-origin protection', async () => {
    const createUser = vi.fn(async () => customer);
    const deleteUser = vi.fn(async () => undefined);
    const repository = new MemoryAuthRepository();
    repository.user = { ...testUser, role: 'admin' };
    const app = await buildApp({
      admin: {
        admin: {
          createUser,
          deleteUser,
          getMetrics: async () => metrics,
          listUsers: async () => [customer],
          updateUser: async () => customer,
        },
        appOrigin: 'http://localhost:5173',
        sessions: new SessionService(repository),
      },
      appOrigin: 'http://localhost:5173',
      checkDatabase: async () => undefined,
      logger: false,
    });

    const created = await app.inject({
      headers: {
        cookie: 'drp_session=test-session',
        origin: 'http://localhost:5173',
      },
      method: 'POST',
      payload: {
        displayName: customer.displayName,
        email: customer.email,
        phone: customer.phone,
      },
      url: '/v1/admin/users',
    });
    expect(created.statusCode).toBe(201);
    expect(createUser).toHaveBeenCalledWith({
      displayName: customer.displayName,
      email: customer.email,
      phone: customer.phone,
    });

    const deleted = await app.inject({
      headers: {
        cookie: 'drp_session=test-session',
        origin: 'http://localhost:5173',
      },
      method: 'DELETE',
      url: `/v1/admin/users/${customer.id}`,
    });
    expect(deleted.statusCode).toBe(204);
    expect(deleteUser).toHaveBeenCalledWith(testUser.id, customer.id);
    await app.close();
  });
});
