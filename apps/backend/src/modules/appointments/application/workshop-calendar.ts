import { TZDate } from '@date-fns/tz';

import { AppointmentInputError } from './appointment-errors.js';

const WORKSHOP_TIME_ZONE = 'America/Santiago';

export function getWorkshopDay(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) throw new AppointmentInputError('invalid_date');
  const dayStart = new TZDate(
    year,
    month - 1,
    day,
    0,
    0,
    0,
    WORKSHOP_TIME_ZONE,
  );
  const dayEnd = new TZDate(
    year,
    month - 1,
    day + 1,
    0,
    0,
    0,
    WORKSHOP_TIME_ZONE,
  );
  return { dayEnd, dayStart, weekday: dayStart.getDay() };
}

export function workshopDateAtTime(date: string, time: Date): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new TZDate(
    year!,
    month! - 1,
    day!,
    time.getUTCHours(),
    time.getUTCMinutes(),
    0,
    WORKSHOP_TIME_ZONE,
  );
}

export function formatWorkshopDate(instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: WORKSHOP_TIME_ZONE,
    year: 'numeric',
  }).format(instant);
}

export function overlaps(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date,
): boolean {
  return startA < endB && endA > startB;
}

export function isClosedByException(
  startsAt: Date,
  endsAt: Date,
  exceptions: Array<{ ends_at: Date; kind: string; starts_at: Date }>,
): boolean {
  return exceptions.some(
    (exception) =>
      exception.kind === 'closed' &&
      overlaps(startsAt, endsAt, exception.starts_at, exception.ends_at),
  );
}

export function getCapacityOverride(
  startsAt: Date,
  endsAt: Date,
  exceptions: Array<{
    capacity_override: number | null;
    ends_at: Date;
    kind: string;
    starts_at: Date;
  }>,
): number | undefined {
  return (
    exceptions.find(
      (exception) =>
        exception.kind === 'availability_override' &&
        overlaps(startsAt, endsAt, exception.starts_at, exception.ends_at),
    )?.capacity_override ?? undefined
  );
}
