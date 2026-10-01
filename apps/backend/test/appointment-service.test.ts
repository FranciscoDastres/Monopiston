import type { DatabaseClient } from '@monopiston/database';

import {
  AppointmentConflictError,
  AppointmentInputError,
  AppointmentService,
  AppointmentTransitionError,
} from '../src/modules/appointments/application/appointment-service.js';

const customerUserId = '9d8ce4e1-1e2b-4a98-beb6-c96e8d5e63f2';
const appointmentId = '78c865ca-8224-4e9e-a2e2-a9eddf4fb844';
const primaryServiceBay = {
  description: 'Bahía principal',
  id: '439afc20-8e91-4196-9043-10a3eaf9f3b2',
  name: 'Bahía 1',
};
const secondaryServiceBay = {
  description: 'Bahía secundaria',
  id: '8cb0a35b-819b-488d-84ec-98f0536cb9ec',
  name: 'Bahía 2',
};
const rawAppointment = {
  appointment_services: [
    {
      service_id: '984a5c7b-2163-47d7-964d-e882388e1a2c',
      service_name_snapshot: 'Mantención básica',
    },
  ],
  customer_user_id: customerUserId,
  ends_at: new Date('2099-01-15T14:00:00.000Z'),
  id: appointmentId,
  motorcycles: {
    id: '0ed4fc0c-ea93-4dc7-9af0-cba493e67491',
    make: 'Honda',
    model: 'NAVI',
    nickname: 'La Roja',
  },
  service_bay_id: primaryServiceBay.id,
  starts_at: new Date('2099-01-15T13:00:00.000Z'),
  status: 'requested' as const,
  version: 1,
};

describe('AppointmentService.cancel', () => {
  it('cancels a future customer appointment and records its history', async () => {
    const { service, transaction } = createService(rawAppointment);

    const result = await service.cancel(customerUserId, appointmentId, {
      reason: 'Cambio de planes',
    });

    expect(result.status).toBe('cancelled');
    expect(transaction.appointments.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cancellation_reason: 'Cambio de planes',
          status: 'cancelled',
          version: { increment: 1 },
        }),
        where: { id: appointmentId, version: 1 },
      }),
    );
    expect(transaction.appointment_status_history.create).toHaveBeenCalledWith({
      data: {
        appointment_id: appointmentId,
        changed_by_user_id: customerUserId,
        from_status: 'requested',
        reason: 'Cambio de planes',
        to_status: 'cancelled',
      },
    });
  });

  it('does not reveal appointments owned by another customer', async () => {
    const { service, transaction } = createService(null);

    await expect(
      service.cancel(customerUserId, appointmentId, {}),
    ).rejects.toBeInstanceOf(AppointmentInputError);
    expect(transaction.appointments.update).not.toHaveBeenCalled();
  });

  it('rejects cancellation once the motorcycle was received', async () => {
    const { service, transaction } = createService({
      ...rawAppointment,
      status: 'checked_in' as const,
    });

    await expect(
      service.cancel(customerUserId, appointmentId, {}),
    ).rejects.toBeInstanceOf(AppointmentTransitionError);
    expect(transaction.appointments.update).not.toHaveBeenCalled();
  });
});

describe('AppointmentService.listAdmin', () => {
  it('queries the requested workshop date range and statuses', async () => {
    const findMany = vi.fn(async () => [
      {
        ...rawAppointment,
        users: {
          display_name: 'Cliente NAVI',
          email: 'cliente@example.com',
          id: customerUserId,
        },
        service_bays: primaryServiceBay,
      },
    ]);
    const database = {
      appointments: { findMany },
    } as unknown as DatabaseClient;
    const service = new AppointmentService(database);

    const result = await service.listAdmin({
      from: '2027-01-15',
      statuses: ['confirmed'],
      to: '2027-01-16',
    });

    expect(result).toHaveLength(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          starts_at: {
            gte: new Date('2027-01-15T03:00:00.000Z'),
            lt: new Date('2027-01-16T03:00:00.000Z'),
          },
          status: { in: ['confirmed'] },
        },
      }),
    );
  });
});

describe('AppointmentService.reassignServiceBay', () => {
  it('moves an active appointment and records an audit event', async () => {
    const { service, transaction } = createReassignmentService(false);

    const result = await service.reassignServiceBay(
      customerUserId,
      appointmentId,
      { serviceBayId: secondaryServiceBay.id },
    );

    expect(result.serviceBay).toEqual(secondaryServiceBay);
    expect(transaction.appointments.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          service_bay_id: secondaryServiceBay.id,
          version: { increment: 1 },
        },
        where: { id: appointmentId, version: 1 },
      }),
    );
    expect(transaction.audit_logs.create).toHaveBeenCalledWith({
      data: {
        action: 'appointment.service_bay_reassigned',
        actor_user_id: customerUserId,
        entity_id: appointmentId,
        entity_type: 'appointment',
        metadata: {
          fromServiceBayId: primaryServiceBay.id,
          toServiceBayId: secondaryServiceBay.id,
        },
      },
    });
  });

  it('rejects a target bay occupied by another active appointment', async () => {
    const { service, transaction } = createReassignmentService(true);

    await expect(
      service.reassignServiceBay(customerUserId, appointmentId, {
        serviceBayId: secondaryServiceBay.id,
      }),
    ).rejects.toBeInstanceOf(AppointmentConflictError);
    expect(transaction.appointments.update).not.toHaveBeenCalled();
    expect(transaction.audit_logs.create).not.toHaveBeenCalled();
  });
});

function createService(current: typeof rawAppointment | null | CheckedIn) {
  const transaction = {
    appointments: {
      findFirst: vi.fn(async () => current),
      update: vi.fn(async () => ({
        ...rawAppointment,
        status: 'cancelled' as const,
      })),
    },
    appointment_status_history: {
      create: vi.fn(async () => undefined),
    },
  };
  const database = {
    $transaction: async (
      callback: (value: typeof transaction) => Promise<unknown>,
    ) => callback(transaction),
  } as unknown as DatabaseClient;

  return { service: new AppointmentService(database), transaction };
}

type CheckedIn = Omit<typeof rawAppointment, 'status'> & {
  status: 'checked_in';
};

function createReassignmentService(hasConflict: boolean) {
  const adminAppointment = {
    ...rawAppointment,
    service_bays: primaryServiceBay,
    users: {
      display_name: 'Cliente NAVI',
      email: 'cliente@example.com',
      id: customerUserId,
    },
  };
  const transaction = {
    $executeRaw: vi.fn(async () => undefined),
    appointments: {
      findFirst: vi.fn(async () =>
        hasConflict ? { id: 'occupied-appointment' } : null,
      ),
      findUnique: vi.fn(async () => adminAppointment),
      update: vi.fn(async () => ({
        ...adminAppointment,
        service_bay_id: secondaryServiceBay.id,
        service_bays: secondaryServiceBay,
      })),
    },
    audit_logs: {
      create: vi.fn(async () => undefined),
    },
    service_bays: {
      findFirst: vi.fn(async () => secondaryServiceBay),
    },
  };
  const database = {
    $transaction: async (
      callback: (value: typeof transaction) => Promise<unknown>,
    ) => callback(transaction),
  } as unknown as DatabaseClient;

  return { service: new AppointmentService(database), transaction };
}
