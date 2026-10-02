import type { AvailabilitySlot } from '@monopiston/contracts';
import type { DatabaseClient } from '@monopiston/database';

import { ACTIVE_STATUSES } from './appointment-rules.js';
import {
  getCapacityOverride,
  getWorkshopDay,
  isClosedByException,
  overlaps,
  workshopDateAtTime,
} from './workshop-calendar.js';

export async function computeAvailability(
  database: DatabaseClient,
  serviceIds: string[],
  date: string,
): Promise<AvailabilitySlot[]> {
  const services = await database.services.findMany({
    where: { id: { in: serviceIds }, is_active: true },
  });
  if (services.length !== new Set(serviceIds).size) return [];

  const durationMinutes = services.reduce(
    (total, service) => total + service.duration_minutes,
    0,
  );
  const { dayEnd, dayStart, weekday } = getWorkshopDay(date);
  const databaseDate = new Date(`${date}T00:00:00.000Z`);
  const [hours, bays, appointments, exceptions] = await Promise.all([
    database.business_hours.findMany({
      orderBy: { opens_at: 'asc' },
      where: {
        valid_from: { lte: databaseDate },
        OR: [{ valid_until: null }, { valid_until: { gte: databaseDate } }],
        weekday,
      },
    }),
    database.service_bays.findMany({ where: { is_active: true } }),
    database.appointments.findMany({
      select: { ends_at: true, starts_at: true },
      where: {
        ends_at: { gt: dayStart },
        starts_at: { lt: dayEnd },
        status: { in: [...ACTIVE_STATUSES] },
      },
    }),
    database.schedule_exceptions.findMany({
      where: { ends_at: { gt: dayStart }, starts_at: { lt: dayEnd } },
    }),
  ]);

  const slots: AvailabilitySlot[] = [];
  for (const interval of hours) {
    const intervalStart = workshopDateAtTime(date, interval.opens_at);
    const intervalEnd = workshopDateAtTime(date, interval.closes_at);
    for (
      let startsAt = intervalStart;
      startsAt.getTime() + durationMinutes * 60_000 <= intervalEnd.getTime();
      startsAt = new Date(startsAt.getTime() + interval.slot_minutes * 60_000)
    ) {
      const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
      if (startsAt.getTime() <= Date.now()) continue;
      if (isClosedByException(startsAt, endsAt, exceptions)) continue;

      const capacityOverride = getCapacityOverride(
        startsAt,
        endsAt,
        exceptions,
      );
      const hasConflictingAppointment = appointments.some((appointment) =>
        overlaps(startsAt, endsAt, appointment.starts_at, appointment.ends_at),
      );
      const capacity = capacityOverride ?? bays.length;
      if (!hasConflictingAppointment && bays.length > 0 && capacity > 0) {
        slots.push({
          endsAt: endsAt.toISOString(),
          startsAt: new Date(startsAt).toISOString(),
        });
      }
    }
  }
  return slots;
}
