import type {
  AdminAppointment,
  Appointment,
  AvailabilitySlot,
  CustomerMotorcycleUpdate,
  ServiceBay,
} from '@monopiston/contracts';

import { buildApp } from '../src/app.js';
import type { AppointmentRoutesOptions } from '../src/modules/appointments/presentation/routes.js';
import { SessionService } from '../src/modules/auth/application/session-service.js';
import {
  MemoryAuthRepository,
  testUser,
} from './helpers/memory-auth-repository.js';

const serviceId = '984a5c7b-2163-47d7-964d-e882388e1a2c';
const motorcycleId = '0ed4fc0c-ea93-4dc7-9af0-cba493e67491';
const slot: AvailabilitySlot = {
  endsAt: '2027-01-15T14:00:00.000Z',
  startsAt: '2027-01-15T13:00:00.000Z',
};
const appointment: Appointment = {
  ...slot,
  id: '78c865ca-8224-4e9e-a2e2-a9eddf4fb844',
  motorcycle: { id: motorcycleId, label: 'La Roja' },
  services: [
    {
      currency: 'CLP',
      id: serviceId,
      name: 'Mantención básica',
      unitPrice: 24990,
    },
  ],
  status: 'requested',
  total: 24990,
  whatsappPhone: '+56912345678',
};
const cancelledAppointment: Appointment = {
  ...appointment,
  status: 'cancelled',
};
const serviceBay: ServiceBay = {
  description: 'Bahía principal',
  id: '439afc20-8e91-4196-9043-10a3eaf9f3b2',
  name: 'Bahía 1',
};
const secondaryServiceBay: ServiceBay = {
  description: 'Bahía secundaria',
  id: '8cb0a35b-819b-488d-84ec-98f0536cb9ec',
  name: 'Bahía 2',
};
const adminAppointment: AdminAppointment = {
  ...appointment,
  customer: {
    displayName: testUser.displayName,
    email: testUser.email,
    id: testUser.id,
    phone: '+56912345678',
  },
  serviceBay,
};
const motorcycleUpdate: CustomerMotorcycleUpdate = {
  appointmentId: appointment.id,
  createdAt: '2027-01-15T13:15:00.000Z',
  id: 'b05fc748-08f8-42cb-ba2a-ac4a09c6386b',
  message: 'Diagnóstico iniciado',
  motorcycleLabel: appointment.motorcycle.label,
  progressStatus: 'diagnosing',
};

describe('appointment routes', () => {
  it('returns availability for a valid service and date', async () => {
    const app = await createApp();
    const response = await app.inject({
      method: 'GET',
      url: `/v1/availability?date=2027-01-15&serviceIds=${serviceId}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([slot]);
    await app.close();
  });

  it('creates an appointment for the authenticated owner', async () => {
    const app = await createApp();
    const response = await app.inject({
      headers: {
        cookie: 'drp_session=test-session',
        origin: 'http://localhost:5173',
      },
      method: 'POST',
      payload: {
        motorcycleId,
        serviceIds: [serviceId],
        startsAt: slot.startsAt,
        whatsappPhone: '+56912345678',
      },
      url: '/v1/appointments',
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(appointment);
    await app.close();
  });

  it('cancels an eligible appointment for its authenticated owner', async () => {
    const cancel = vi.fn(async () => cancelledAppointment);
    const app = await createApp(false, { cancel });

    const rejected = await app.inject({
      headers: { cookie: 'drp_session=test-session' },
      method: 'PATCH',
      payload: { reason: 'Cambio de planes' },
      url: `/v1/appointments/${appointment.id}/cancel`,
    });
    expect(rejected.statusCode).toBe(403);

    const accepted = await app.inject({
      headers: {
        cookie: 'drp_session=test-session',
        origin: 'http://localhost:5173',
      },
      method: 'PATCH',
      payload: { reason: 'Cambio de planes' },
      url: `/v1/appointments/${appointment.id}/cancel`,
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json()).toEqual(cancelledAppointment);
    expect(cancel).toHaveBeenCalledWith(testUser.id, appointment.id, {
      reason: 'Cambio de planes',
    });
    await app.close();
  });

  it('reprograms an eligible appointment to a validated slot', async () => {
    const reschedule = vi.fn(async () => appointment);
    const app = await createApp(false, { reschedule });
    const response = await app.inject({
      headers: {
        cookie: 'drp_session=test-session',
        origin: 'http://localhost:5173',
      },
      method: 'PATCH',
      payload: { startsAt: slot.startsAt },
      url: `/v1/appointments/${appointment.id}/reschedule`,
    });
    expect(response.statusCode).toBe(200);
    expect(reschedule).toHaveBeenCalledWith(testUser.id, appointment.id, {
      startsAt: slot.startsAt,
    });
    await app.close();
  });

  it('allows only administrators to read the workshop agenda', async () => {
    const customerApp = await createApp();
    const forbidden = await customerApp.inject({
      headers: { cookie: 'drp_session=test-session' },
      method: 'GET',
      url: '/v1/admin/appointments',
    });
    expect(forbidden.statusCode).toBe(403);
    await customerApp.close();

    const adminApp = await createApp(true);
    const accepted = await adminApp.inject({
      headers: { cookie: 'drp_session=test-session' },
      method: 'GET',
      url: '/v1/admin/appointments',
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json()).toEqual([adminAppointment]);
    await adminApp.close();
  });

  it('passes validated date and status filters to the admin agenda', async () => {
    const listAdmin = vi.fn(async () => [adminAppointment]);
    const app = await createApp(true, { listAdmin });
    const response = await app.inject({
      headers: { cookie: 'drp_session=test-session' },
      method: 'GET',
      url: '/v1/admin/appointments?from=2027-01-12&to=2027-01-19&statuses=requested,confirmed',
    });

    expect(response.statusCode).toBe(200);
    expect(listAdmin).toHaveBeenCalledWith({
      from: '2027-01-12',
      statuses: ['requested', 'confirmed'],
      to: '2027-01-19',
    });
    await app.close();
  });

  it('lists service bays and reassigns an appointment as administrator', async () => {
    const reassigned = {
      ...adminAppointment,
      serviceBay: secondaryServiceBay,
    };
    const reassignServiceBay = vi.fn(async () => reassigned);
    const app = await createApp(true, {
      listServiceBays: async () => [serviceBay, secondaryServiceBay],
      reassignServiceBay,
    });

    const bays = await app.inject({
      headers: { cookie: 'drp_session=test-session' },
      method: 'GET',
      url: '/v1/admin/service-bays',
    });
    expect(bays.statusCode).toBe(200);
    expect(bays.json()).toEqual([serviceBay, secondaryServiceBay]);

    const response = await app.inject({
      headers: {
        cookie: 'drp_session=test-session',
        origin: 'http://localhost:5173',
      },
      method: 'PATCH',
      payload: { serviceBayId: secondaryServiceBay.id },
      url: `/v1/admin/appointments/${appointment.id}/service-bay`,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(reassigned);
    expect(reassignServiceBay).toHaveBeenCalledWith(
      testUser.id,
      appointment.id,
      { serviceBayId: secondaryServiceBay.id },
    );
    await app.close();
  });

  it('returns customer-visible motorcycle updates', async () => {
    const app = await createApp();
    const response = await app.inject({
      headers: { cookie: 'drp_session=test-session' },
      method: 'GET',
      url: '/v1/notifications',
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([motorcycleUpdate]);
    await app.close();
  });
});

async function createApp(
  admin = false,
  overrides: Partial<AppointmentRoutesOptions['appointments']> = {},
) {
  const authRepository = new MemoryAuthRepository();
  if (admin) authRepository.user = { ...testUser, role: 'admin' };
  const sessions = new SessionService(authRepository);
  return buildApp({
    appOrigin: 'http://localhost:5173',
    appointments: {
      appOrigin: 'http://localhost:5173',
      appointments: {
        addMotorcycleUpdate: async () => ({ id: 'update-id' }),
        cancel: async () => cancelledAppointment,
        create: async () => appointment,
        getAvailability: async () => [slot],
        getTimeline: async () => ({
          appointment,
          updates: [motorcycleUpdate],
        }),
        list: async () => [],
        listAdmin: async () => [adminAppointment],
        listCustomerUpdates: async () => [motorcycleUpdate],
        listServiceBays: async () => [serviceBay, secondaryServiceBay],
        reassignServiceBay: async () => adminAppointment,
        reschedule: async () => appointment,
        updateStatus: async () => appointment,
        ...overrides,
      },
      sessions,
    },
    checkDatabase: async () => undefined,
    logger: false,
  });
}
