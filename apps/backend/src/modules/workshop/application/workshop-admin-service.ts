import type {
  AdminService,
  BusinessHour,
  CreateScheduleExceptionInput,
  CreateServiceInput,
  SaveBusinessHourInput,
  ScheduleException,
  UpdateServiceInput,
} from '@monopiston/contracts';
import type { DatabaseClient } from '@monopiston/database';

export class WorkshopAdminService {
  constructor(private readonly database: DatabaseClient) {}

  async listServices(): Promise<AdminService[]> {
    const services = await this.database.services.findMany({
      orderBy: { name: 'asc' },
    });
    return services.map(mapService);
  }

  async createService(input: CreateServiceInput): Promise<AdminService> {
    const service = await this.database.services.create({
      data: {
        code: input.code.toUpperCase(),
        currency: input.currency.toUpperCase(),
        description: input.description ?? null,
        duration_minutes: input.durationMinutes,
        name: input.name,
        price_cents: input.price,
      },
    });
    return mapService(service);
  }

  async updateService(
    id: string,
    input: UpdateServiceInput,
  ): Promise<AdminService> {
    const existing = await this.database.services.findUnique({ where: { id } });
    if (!existing) throw new WorkshopResourceNotFoundError();

    const service = await this.database.services.update({
      data: {
        ...(input.code !== undefined && { code: input.code.toUpperCase() }),
        ...(input.currency !== undefined && {
          currency: input.currency.toUpperCase(),
        }),
        ...(input.description !== undefined && {
          description: input.description,
        }),
        ...(input.durationMinutes !== undefined && {
          duration_minutes: input.durationMinutes,
        }),
        ...(input.isActive !== undefined && { is_active: input.isActive }),
        ...(input.name !== undefined && { name: input.name }),
        ...(input.price !== undefined && { price_cents: input.price }),
      },
      where: { id },
    });
    return mapService(service);
  }

  async listBusinessHours(): Promise<BusinessHour[]> {
    const hours = await this.database.business_hours.findMany({
      orderBy: [{ weekday: 'asc' }, { opens_at: 'asc' }],
      where: {
        OR: [
          { valid_until: null },
          { valid_until: { gte: startOfTodayUtc() } },
        ],
      },
    });
    return hours.map(mapBusinessHour);
  }

  async saveBusinessHour(input: SaveBusinessHourInput): Promise<BusinessHour> {
    if (input.opensAt >= input.closesAt)
      throw new WorkshopInputError('invalid_interval');
    const hour = await this.database.business_hours.upsert({
      create: {
        closes_at: parseTime(input.closesAt),
        opens_at: parseTime(input.opensAt),
        slot_minutes: input.slotMinutes,
        valid_from: parseDate(input.validFrom),
        valid_until: input.validUntil ? parseDate(input.validUntil) : null,
        weekday: input.weekday,
      },
      update: {
        closes_at: parseTime(input.closesAt),
        slot_minutes: input.slotMinutes,
        valid_until: input.validUntil ? parseDate(input.validUntil) : null,
      },
      where: {
        weekday_opens_at_valid_from: {
          opens_at: parseTime(input.opensAt),
          valid_from: parseDate(input.validFrom),
          weekday: input.weekday,
        },
      },
    });
    return mapBusinessHour(hour);
  }

  async deleteBusinessHour(id: string): Promise<void> {
    const result = await this.database.business_hours.deleteMany({
      where: { id },
    });
    if (result.count === 0) throw new WorkshopResourceNotFoundError();
  }

  async listExceptions(): Promise<ScheduleException[]> {
    const exceptions = await this.database.schedule_exceptions.findMany({
      orderBy: { starts_at: 'asc' },
      where: { ends_at: { gte: new Date() } },
    });
    return exceptions.map(mapException);
  }

  async createException(
    adminUserId: string,
    input: CreateScheduleExceptionInput,
  ): Promise<ScheduleException> {
    if (input.kind === 'availability_override' && !input.capacityOverride) {
      throw new WorkshopInputError('capacity_required');
    }
    const exception = await this.database.schedule_exceptions.create({
      data: {
        capacity_override:
          input.kind === 'availability_override'
            ? (input.capacityOverride ?? null)
            : null,
        created_by_user_id: adminUserId,
        ends_at: new Date(input.endsAt),
        kind: input.kind,
        reason: input.reason ?? null,
        starts_at: new Date(input.startsAt),
      },
    });
    return mapException(exception);
  }

  async deleteException(id: string): Promise<void> {
    const result = await this.database.schedule_exceptions.deleteMany({
      where: { id },
    });
    if (result.count === 0) throw new WorkshopResourceNotFoundError();
  }
}

export class WorkshopInputError extends Error {}
export class WorkshopResourceNotFoundError extends Error {}

function mapService(service: {
  code: string;
  currency: string;
  description: string | null;
  duration_minutes: number;
  id: string;
  is_active: boolean;
  name: string;
  price_cents: number;
}): AdminService {
  return {
    code: service.code,
    currency: service.currency,
    description: service.description,
    durationMinutes: service.duration_minutes,
    id: service.id,
    isActive: service.is_active,
    name: service.name,
    price: service.price_cents,
  };
}

function mapBusinessHour(hour: {
  closes_at: Date;
  id: string;
  opens_at: Date;
  slot_minutes: number;
  valid_from: Date;
  valid_until: Date | null;
  weekday: number;
}): BusinessHour {
  return {
    closesAt: formatTime(hour.closes_at),
    id: hour.id,
    opensAt: formatTime(hour.opens_at),
    slotMinutes: hour.slot_minutes,
    validFrom: formatDate(hour.valid_from),
    validUntil: hour.valid_until ? formatDate(hour.valid_until) : null,
    weekday: hour.weekday,
  };
}

function mapException(exception: {
  capacity_override: number | null;
  ends_at: Date;
  id: string;
  kind: 'availability_override' | 'closed';
  reason: string | null;
  starts_at: Date;
}): ScheduleException {
  return {
    capacityOverride: exception.capacity_override,
    endsAt: exception.ends_at.toISOString(),
    id: exception.id,
    kind: exception.kind,
    reason: exception.reason,
    startsAt: exception.starts_at.toISOString(),
  };
}

function parseTime(value: string): Date {
  return new Date(`1970-01-01T${value}:00.000Z`);
}

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function formatTime(value: Date): string {
  return `${value.getUTCHours().toString().padStart(2, '0')}:${value
    .getUTCMinutes()
    .toString()
    .padStart(2, '0')}`;
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}
