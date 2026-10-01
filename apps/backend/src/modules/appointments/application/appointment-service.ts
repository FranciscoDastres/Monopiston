import type {
  AdminAppointment,
  AdminAppointmentFilters,
  Appointment,
  AppointmentTimeline,
  AvailabilitySlot,
  CancelAppointmentInput,
  CreateMotorcycleStatusUpdateInput,
  CreateAppointmentInput,
  CustomerMotorcycleUpdate,
  ReassignAppointmentInput,
  RescheduleAppointmentInput,
  ServiceBay,
  UpdateAppointmentStatusInput,
} from '@monopiston/contracts';
import type { DatabaseClient } from '@monopiston/database';

import {
  AppointmentConflictError,
  AppointmentInputError,
  AppointmentTransitionError,
} from './appointment-errors.js';
import {
  adminAppointmentInclude,
  appointmentInclude,
  mapAdminAppointment,
  mapAppointment,
  mapCustomerUpdate,
  mapServiceBay,
} from './appointment-mappers.js';
import {
  ACTIVE_STATUSES,
  ALLOWED_STATUS_TRANSITIONS,
  CUSTOMER_CANCELLABLE_STATUSES,
} from './appointment-rules.js';
import { computeAvailability } from './availability.js';
import { formatWorkshopDate, getWorkshopDay } from './workshop-calendar.js';

export {
  AppointmentConflictError,
  AppointmentInputError,
  AppointmentTransitionError,
} from './appointment-errors.js';

export class AppointmentService {
  constructor(private readonly database: DatabaseClient) {}

  async getAvailability(
    serviceIds: string[],
    date: string,
  ): Promise<AvailabilitySlot[]> {
    return computeAvailability(this.database, serviceIds, date);
  }

  async create(
    customerUserId: string,
    input: CreateAppointmentInput,
  ): Promise<Appointment> {
    const requestedStart = new Date(input.startsAt);
    const workshopDate = formatWorkshopDate(requestedStart);
    const slots = await this.getAvailability(input.serviceIds, workshopDate);
    if (!slots.some((slot) => slot.startsAt === requestedStart.toISOString())) {
      throw new AppointmentConflictError();
    }

    return this.database.$transaction(
      async (transaction) => {
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('workshop_appointments'))`;
        const motorcycle = await transaction.motorcycles.findFirst({
          where: {
            id: input.motorcycleId,
            is_active: true,
            owner_user_id: customerUserId,
          },
        });
        if (!motorcycle)
          throw new AppointmentInputError('motorcycle_not_found');

        const services = await transaction.services.findMany({
          where: { id: { in: input.serviceIds }, is_active: true },
        });
        if (services.length !== new Set(input.serviceIds).size) {
          throw new AppointmentInputError('service_not_found');
        }

        const durationMinutes = services.reduce(
          (total, service) => total + service.duration_minutes,
          0,
        );
        const endsAt = new Date(
          requestedStart.getTime() + durationMinutes * 60_000,
        );
        const conflictingAppointment = await transaction.appointments.findFirst(
          {
            select: { id: true },
            where: {
              ends_at: { gt: requestedStart },
              starts_at: { lt: endsAt },
              status: { in: [...ACTIVE_STATUSES] },
            },
          },
        );
        if (conflictingAppointment) throw new AppointmentConflictError();

        const bay = await transaction.service_bays.findFirst({
          orderBy: { name: 'asc' },
          where: { is_active: true },
        });
        if (!bay) throw new AppointmentConflictError();

        // The booking holds the slot as `pending_payment`; the customer is then
        // redirected to Flow. If the payment is not completed before the hold
        // expires, the expiry job releases the slot (see PaymentService).
        const settings = await transaction.payment_settings.findFirst();
        const holdMinutes = settings?.hold_minutes ?? 30;
        const appointment = await transaction.appointments.create({
          data: {
            appointment_services: {
              create: services.map((service) => ({
                currency: service.currency,
                duration_minutes: service.duration_minutes,
                quantity: 1,
                service_id: service.id,
                service_name_snapshot: service.name,
                unit_price_cents: service.price_cents,
              })),
            },
            appointment_status_history: {
              create: { to_status: 'pending_payment' },
            },
            customer_user_id: customerUserId,
            ends_at: endsAt,
            motorcycle_id: motorcycle.id,
            payment_hold_expires_at: new Date(
              Date.now() + holdMinutes * 60_000,
            ),
            service_bay_id: bay.id,
            starts_at: requestedStart,
            status: 'pending_payment',
            whatsapp_phone: input.whatsappPhone,
          },
          include: appointmentInclude,
        });
        return mapAppointment(appointment);
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async cancel(
    customerUserId: string,
    appointmentId: string,
    input: CancelAppointmentInput,
  ): Promise<Appointment> {
    return this.database.$transaction(async (transaction) => {
      const current = await transaction.appointments.findFirst({
        where: { customer_user_id: customerUserId, id: appointmentId },
      });
      if (!current) throw new AppointmentInputError('appointment_not_found');
      if (
        current.starts_at <= new Date() ||
        !CUSTOMER_CANCELLABLE_STATUSES.includes(current.status)
      ) {
        throw new AppointmentTransitionError();
      }

      const reason = input.reason ?? 'Cancelada por cliente';
      const updated = await transaction.appointments.update({
        data: {
          cancellation_reason: reason,
          cancelled_at: new Date(),
          status: 'cancelled',
          version: { increment: 1 },
        },
        include: appointmentInclude,
        where: { id: appointmentId, version: current.version },
      });
      await transaction.appointment_status_history.create({
        data: {
          appointment_id: appointmentId,
          changed_by_user_id: customerUserId,
          from_status: current.status,
          reason,
          to_status: 'cancelled',
        },
      });
      return mapAppointment(updated);
    });
  }

  async reschedule(
    customerUserId: string,
    appointmentId: string,
    input: RescheduleAppointmentInput,
  ): Promise<Appointment> {
    const current = await this.database.appointments.findFirst({
      include: appointmentInclude,
      where: { customer_user_id: customerUserId, id: appointmentId },
    });
    if (!current) throw new AppointmentInputError('appointment_not_found');
    if (
      current.starts_at <= new Date() ||
      !CUSTOMER_CANCELLABLE_STATUSES.includes(current.status)
    ) {
      throw new AppointmentTransitionError();
    }

    const requestedStart = new Date(input.startsAt);
    if (requestedStart <= new Date()) throw new AppointmentTransitionError();
    if (requestedStart.getTime() === current.starts_at.getTime()) {
      return mapAppointment(current);
    }

    const serviceIds = current.appointment_services.map(
      (service) => service.service_id,
    );
    const workshopDate = formatWorkshopDate(requestedStart);
    const slots = await this.getAvailability(serviceIds, workshopDate);
    const slot = slots.find(
      (candidate) => candidate.startsAt === requestedStart.toISOString(),
    );
    if (!slot) throw new AppointmentConflictError();

    return this.database.$transaction(
      async (transaction) => {
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('workshop_appointments'))`;
        const fresh = await transaction.appointments.findUnique({
          where: { id: appointmentId },
        });
        if (!fresh || fresh.version !== current.version) {
          throw new AppointmentConflictError();
        }

        const endsAt = new Date(slot.endsAt);
        const conflict = await transaction.appointments.findFirst({
          select: { id: true },
          where: {
            ends_at: { gt: requestedStart },
            id: { not: appointmentId },
            starts_at: { lt: endsAt },
            status: { in: [...ACTIVE_STATUSES] },
          },
        });
        if (conflict) throw new AppointmentConflictError();

        const bay = await transaction.service_bays.findFirst({
          orderBy: { name: 'asc' },
          where: { is_active: true },
        });
        if (!bay) throw new AppointmentConflictError();

        const updated = await transaction.appointments.update({
          data: {
            ends_at: endsAt,
            service_bay_id: bay.id,
            starts_at: requestedStart,
            status: 'requested',
            version: { increment: 1 },
          },
          include: appointmentInclude,
          where: { id: appointmentId, version: current.version },
        });
        await transaction.appointment_status_history.create({
          data: {
            appointment_id: appointmentId,
            changed_by_user_id: customerUserId,
            from_status: current.status,
            reason: 'Reprogramada por cliente',
            to_status: 'requested',
          },
        });
        return mapAppointment(updated);
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async list(customerUserId: string): Promise<Appointment[]> {
    const appointments = await this.database.appointments.findMany({
      include: appointmentInclude,
      orderBy: { starts_at: 'desc' },
      where: { customer_user_id: customerUserId },
    });
    return appointments.map(mapAppointment);
  }

  async listServiceBays(): Promise<ServiceBay[]> {
    const serviceBays = await this.database.service_bays.findMany({
      orderBy: { name: 'asc' },
      where: { is_active: true },
    });
    return serviceBays.map(mapServiceBay);
  }

  async listAdmin(
    filters?: AdminAppointmentFilters,
  ): Promise<AdminAppointment[]> {
    const statusFilter =
      filters?.statuses ?? (!filters ? [...ACTIVE_STATUSES] : undefined);
    const appointments = await this.database.appointments.findMany({
      include: adminAppointmentInclude,
      orderBy: { starts_at: 'asc' },
      where: {
        ...(statusFilter && { status: { in: statusFilter } }),
        starts_at: filters
          ? {
              gte: getWorkshopDay(filters.from).dayStart,
              lt: getWorkshopDay(filters.to).dayStart,
            }
          : { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    return appointments.map(mapAdminAppointment);
  }

  async reassignServiceBay(
    adminUserId: string,
    appointmentId: string,
    input: ReassignAppointmentInput,
  ): Promise<AdminAppointment> {
    return this.database.$transaction(async (transaction) => {
      const current = await transaction.appointments.findUnique({
        include: adminAppointmentInclude,
        where: { id: appointmentId },
      });
      if (!current) throw new AppointmentInputError('appointment_not_found');
      if (!ACTIVE_STATUSES.some((status) => status === current.status)) {
        throw new AppointmentTransitionError();
      }

      const targetBay = await transaction.service_bays.findFirst({
        where: { id: input.serviceBayId, is_active: true },
      });
      if (!targetBay) throw new AppointmentInputError('service_bay_not_found');
      if (current.service_bay_id === targetBay.id) {
        return mapAdminAppointment(current);
      }

      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${targetBay.id}))`;
      const conflict = await transaction.appointments.findFirst({
        select: { id: true },
        where: {
          ends_at: { gt: current.starts_at },
          id: { not: current.id },
          service_bay_id: targetBay.id,
          starts_at: { lt: current.ends_at },
          status: { in: [...ACTIVE_STATUSES] },
        },
      });
      if (conflict) throw new AppointmentConflictError();

      const updated = await transaction.appointments.update({
        data: {
          service_bay_id: targetBay.id,
          version: { increment: 1 },
        },
        include: adminAppointmentInclude,
        where: { id: appointmentId, version: current.version },
      });
      await transaction.audit_logs.create({
        data: {
          action: 'appointment.service_bay_reassigned',
          actor_user_id: adminUserId,
          entity_id: appointmentId,
          entity_type: 'appointment',
          metadata: {
            fromServiceBayId: current.service_bay_id,
            toServiceBayId: targetBay.id,
          },
        },
      });
      return mapAdminAppointment(updated);
    });
  }

  async updateStatus(
    adminUserId: string,
    appointmentId: string,
    input: UpdateAppointmentStatusInput,
  ): Promise<Appointment> {
    return this.database.$transaction(async (transaction) => {
      const current = await transaction.appointments.findUnique({
        where: { id: appointmentId },
      });
      if (!current) throw new AppointmentInputError('appointment_not_found');
      if (
        !ALLOWED_STATUS_TRANSITIONS[current.status].some(
          (status: Appointment['status']) => status === input.status,
        )
      ) {
        throw new AppointmentTransitionError();
      }

      const updated = await transaction.appointments.update({
        data: {
          ...(input.status === 'cancelled' && { cancelled_at: new Date() }),
          ...(input.status === 'cancelled' && {
            cancellation_reason: input.reason ?? 'Cancelada por administración',
          }),
          status: input.status,
          version: { increment: 1 },
        },
        include: appointmentInclude,
        where: { id: appointmentId, version: current.version },
      });
      await transaction.appointment_status_history.create({
        data: {
          appointment_id: appointmentId,
          changed_by_user_id: adminUserId,
          from_status: current.status,
          reason: input.reason ?? null,
          to_status: input.status,
        },
      });
      if (input.status === 'in_service' || input.status === 'ready') {
        await transaction.motorcycle_status_updates.create({
          data: {
            appointment_id: appointmentId,
            created_by_user_id: adminUserId,
            customer_visible: true,
            message:
              input.status === 'in_service'
                ? 'El trabajo técnico en tu NAVI ya comenzó.'
                : 'Tu NAVI está lista para retiro.',
            progress_status:
              input.status === 'in_service' ? 'repairing' : 'ready_for_pickup',
          },
        });
      }
      return mapAppointment(updated);
    });
  }

  async addMotorcycleUpdate(
    adminUserId: string,
    appointmentId: string,
    input: CreateMotorcycleStatusUpdateInput,
  ): Promise<{ id: string }> {
    const appointment = await this.database.appointments.findUnique({
      select: { id: true },
      where: { id: appointmentId },
    });
    if (!appointment) throw new AppointmentInputError('appointment_not_found');

    return this.database.motorcycle_status_updates.create({
      data: {
        appointment_id: appointmentId,
        created_by_user_id: adminUserId,
        customer_visible: input.customerVisible,
        message: input.message ?? null,
        odometer_km: input.odometerKm ?? null,
        progress_status: input.progressStatus,
      },
      select: { id: true },
    });
  }

  async getTimeline(
    customerUserId: string,
    appointmentId: string,
  ): Promise<AppointmentTimeline> {
    const appointment = await this.database.appointments.findFirst({
      include: {
        ...appointmentInclude,
        motorcycle_status_updates: {
          orderBy: { created_at: 'asc' },
          where: { customer_visible: true },
        },
      },
      where: { customer_user_id: customerUserId, id: appointmentId },
    });
    if (!appointment) throw new AppointmentInputError('appointment_not_found');

    const mappedAppointment = mapAppointment(appointment);
    return {
      appointment: mappedAppointment,
      updates: appointment.motorcycle_status_updates.map((update) =>
        mapCustomerUpdate(update, mappedAppointment.motorcycle.label),
      ),
    };
  }

  async listCustomerUpdates(
    customerUserId: string,
  ): Promise<CustomerMotorcycleUpdate[]> {
    const updates = await this.database.motorcycle_status_updates.findMany({
      include: { appointments: { include: { motorcycles: true } } },
      orderBy: { created_at: 'desc' },
      take: 20,
      where: {
        appointments: { customer_user_id: customerUserId },
        customer_visible: true,
      },
    });

    return updates.map((update) =>
      mapCustomerUpdate(
        update,
        update.appointments.motorcycles.nickname ??
          `${update.appointments.motorcycles.make} ${update.appointments.motorcycles.model}`,
      ),
    );
  }
}
