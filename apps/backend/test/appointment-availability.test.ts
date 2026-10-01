import { TZDate } from '@date-fns/tz';
import type { DatabaseClient } from '@monopiston/database';

import {
  AppointmentConflictError,
  AppointmentService,
} from '../src/modules/appointments/application/appointment-service.js';

const workshopTimeZone = 'America/Santiago';
const date = '2099-01-05';
const serviceId = '984a5c7b-2163-47d7-964d-e882388e1a2c';
const motorcycleId = '0ed4fc0c-ea93-4dc7-9af0-cba493e67491';

describe('AppointmentService availability', () => {
  it('offers 45-minute starts from 09:30 to 18:00 and skips lunch', async () => {
    const service = createAvailabilityService([]);

    const slots = await service.getAvailability([serviceId], date);
    const starts = slots.map((slot) => workshopTime(slot.startsAt));

    expect(starts).toEqual([
      '09:30',
      '10:15',
      '11:00',
      '11:45',
      '12:30',
      '13:15',
      '15:00',
      '15:45',
      '16:30',
      '17:15',
    ]);
    expect(starts).not.toContain('14:00');
  });

  it('removes a time occupied by another customer across all service bays', async () => {
    const busyStart = workshopDateAt(10, 15);
    const service = createAvailabilityService([
      {
        ends_at: new Date(busyStart.getTime() + 45 * 60_000),
        starts_at: busyStart,
      },
    ]);

    const slots = await service.getAvailability([serviceId], date);
    const starts = slots.map((slot) => workshopTime(slot.startsAt));

    expect(starts).toContain('09:30');
    expect(starts).not.toContain('10:15');
    expect(starts).toContain('11:00');
  });

  it('rechecks overlapping appointments under a transaction lock', async () => {
    const requestedStart = workshopDateAt(9, 30);
    const transaction = {
      $executeRaw: vi.fn(async () => undefined),
      appointments: {
        create: vi.fn(),
        findFirst: vi.fn(async () => ({ id: 'busy-appointment' })),
      },
      motorcycles: {
        findFirst: vi.fn(async () => ({ id: motorcycleId })),
      },
      service_bays: { findFirst: vi.fn() },
      services: {
        findMany: vi.fn(async () => [
          {
            currency: 'CLP',
            duration_minutes: 45,
            id: serviceId,
            name: 'Diagnóstico general',
            price_cents: 15000,
          },
        ]),
      },
    };
    const database = {
      $transaction: async (
        callback: (value: typeof transaction) => Promise<unknown>,
      ) => callback(transaction),
    } as unknown as DatabaseClient;
    const service = new AppointmentService(database);
    vi.spyOn(service, 'getAvailability').mockResolvedValue([
      {
        endsAt: new Date(requestedStart.getTime() + 45 * 60_000).toISOString(),
        startsAt: new Date(requestedStart).toISOString(),
      },
    ]);

    await expect(
      service.create('9d8ce4e1-1e2b-4a98-beb6-c96e8d5e63f2', {
        motorcycleId,
        serviceIds: [serviceId],
        startsAt: new Date(requestedStart).toISOString(),
        whatsappPhone: '+56912345678',
      }),
    ).rejects.toBeInstanceOf(AppointmentConflictError);

    expect(transaction.$executeRaw).toHaveBeenCalledOnce();
    expect(transaction.appointments.create).not.toHaveBeenCalled();
  });
});

function createAvailabilityService(
  appointments: Array<{ ends_at: Date; starts_at: Date }>,
) {
  const database = {
    appointments: { findMany: vi.fn(async () => appointments) },
    business_hours: {
      findMany: vi.fn(async () => [
        {
          closes_at: new Date('1970-01-01T14:00:00.000Z'),
          opens_at: new Date('1970-01-01T09:30:00.000Z'),
          slot_minutes: 45,
        },
        {
          closes_at: new Date('1970-01-01T18:00:00.000Z'),
          opens_at: new Date('1970-01-01T15:00:00.000Z'),
          slot_minutes: 45,
        },
      ]),
    },
    schedule_exceptions: { findMany: vi.fn(async () => []) },
    service_bays: {
      findMany: vi.fn(async () => [{ id: 'primary-bay' }, { id: 'other-bay' }]),
    },
    services: {
      findMany: vi.fn(async () => [{ duration_minutes: 45, id: serviceId }]),
    },
  } as unknown as DatabaseClient;
  return new AppointmentService(database);
}

function workshopDateAt(hour: number, minute: number): Date {
  return new TZDate(2099, 0, 5, hour, minute, 0, workshopTimeZone);
}

function workshopTime(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    timeZone: workshopTimeZone,
  }).format(new Date(value));
}
