import type {
  AdminAppointment,
  Appointment,
  CustomerMotorcycleUpdate,
  ServiceBay,
} from '@monopiston/contracts';

export const appointmentInclude = {
  appointment_services: true,
  motorcycles: true,
} as const;

export const adminAppointmentInclude = {
  ...appointmentInclude,
  service_bays: true,
  users: true,
} as const;

export function mapAppointment(appointment: {
  appointment_services: Array<{
    currency: string;
    quantity: number;
    service_id: string;
    service_name_snapshot: string;
    unit_price_cents: number;
  }>;
  ends_at: Date;
  id: string;
  motorcycles: {
    id: string;
    make: string;
    model: string;
    nickname: string | null;
  };
  starts_at: Date;
  status: Appointment['status'];
  whatsapp_phone: string | null;
}): Appointment {
  return {
    endsAt: appointment.ends_at.toISOString(),
    id: appointment.id,
    motorcycle: {
      id: appointment.motorcycles.id,
      label:
        appointment.motorcycles.nickname ??
        `${appointment.motorcycles.make} ${appointment.motorcycles.model}`,
    },
    services: appointment.appointment_services.map((service) => ({
      currency: service.currency,
      id: service.service_id,
      name: service.service_name_snapshot,
      unitPrice: service.unit_price_cents,
    })),
    startsAt: appointment.starts_at.toISOString(),
    status: appointment.status,
    total: appointment.appointment_services.reduce(
      (sum, service) => sum + service.unit_price_cents * service.quantity,
      0,
    ),
    whatsappPhone: appointment.whatsapp_phone,
  };
}

export function mapAdminAppointment(
  appointment: Parameters<typeof mapAppointment>[0] & {
    service_bays: {
      description: string | null;
      id: string;
      name: string;
    };
    users: {
      display_name: string;
      email: string;
      id: string;
      phone: string | null;
    };
  },
): AdminAppointment {
  return {
    ...mapAppointment(appointment),
    customer: {
      displayName: appointment.users.display_name,
      email: appointment.users.email,
      id: appointment.users.id,
      phone: appointment.users.phone,
    },
    serviceBay: mapServiceBay(appointment.service_bays),
  };
}

export function mapServiceBay(serviceBay: {
  description: string | null;
  id: string;
  name: string;
}): ServiceBay {
  return {
    description: serviceBay.description,
    id: serviceBay.id,
    name: serviceBay.name,
  };
}

export function mapCustomerUpdate(
  update: {
    appointment_id: string;
    created_at: Date;
    id: string;
    message: string | null;
    progress_status:
      | 'received'
      | 'diagnosing'
      | 'waiting_approval'
      | 'repairing'
      | 'quality_check'
      | 'ready_for_pickup'
      | 'delivered';
  },
  motorcycleLabel: string,
): CustomerMotorcycleUpdate {
  return {
    appointmentId: update.appointment_id,
    createdAt: update.created_at.toISOString(),
    id: update.id,
    message: update.message,
    motorcycleLabel,
    progressStatus: update.progress_status,
  };
}
