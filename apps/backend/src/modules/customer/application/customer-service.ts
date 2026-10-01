import type {
  Appointment,
  CompleteAppointmentWorkInput,
  CreateReportPresetInput,
  CustomerDashboard,
  Invoice,
  ReportPreset,
  ReportPresetKind,
  ServiceHistoryRecord,
} from '@monopiston/contracts';
import type { DatabaseClient } from '@monopiston/database';
import PDFDocument from 'pdfkit';

const ACTIVE_WORKSHOP_STATUSES = ['checked_in', 'in_service', 'ready'] as const;
const UPCOMING_STATUSES = ['requested', 'confirmed'] as const;

export class CustomerResourceError extends Error {}

export class CustomerService {
  constructor(private readonly database: DatabaseClient) {}

  async getDashboard(customerUserId: string): Promise<CustomerDashboard> {
    const now = new Date();
    const [active, next, unpaidInvoices] = await Promise.all([
      this.database.appointments.findFirst({
        include: customerAppointmentInclude,
        orderBy: { starts_at: 'desc' },
        where: {
          customer_user_id: customerUserId,
          status: { in: [...ACTIVE_WORKSHOP_STATUSES] },
        },
      }),
      this.database.appointments.findFirst({
        include: customerAppointmentInclude,
        orderBy: { starts_at: 'asc' },
        where: {
          customer_user_id: customerUserId,
          starts_at: { gte: now },
          status: { in: [...UPCOMING_STATUSES] },
        },
      }),
      this.database.invoices.count({
        where: {
          appointments: { customer_user_id: customerUserId },
          payment_status: 'pending',
        },
      }),
    ]);

    const [latestProgress, nextMaintenance] = await Promise.all([
      active
        ? this.database.motorcycle_status_updates.findFirst({
            orderBy: { created_at: 'desc' },
            where: {
              appointment_id: active.id,
              customer_visible: true,
            },
          })
        : null,
      this.database.service_report_items.findFirst({
        include: { service_reports: { include: { appointments: true } } },
        orderBy: [{ due_at: 'asc' }, { created_at: 'desc' }],
        where: {
          kind: 'recommendation',
          service_reports: {
            appointments: { customer_user_id: customerUserId },
          },
        },
      }),
    ]);

    return {
      activeAppointment: active ? mapAppointment(active) : null,
      latestProgress: latestProgress
        ? {
            appointmentId: latestProgress.appointment_id,
            createdAt: latestProgress.created_at.toISOString(),
            id: latestProgress.id,
            message: latestProgress.message,
            motorcycleLabel: active
              ? motorcycleLabel(active.motorcycles)
              : 'Honda NAVI',
            progressStatus: latestProgress.progress_status,
          }
        : null,
      nextAppointment: next ? mapAppointment(next) : null,
      nextMaintenance: nextMaintenance
        ? {
            description: nextMaintenance.description,
            dueAt: nextMaintenance.due_at?.toISOString() ?? null,
            dueOdometerKm: nextMaintenance.due_odometer_km,
            id: nextMaintenance.id,
            severity: nextMaintenance.severity ?? 'info',
            title: nextMaintenance.title,
          }
        : null,
      unpaidInvoices,
    };
  }

  async listHistory(customerUserId: string): Promise<ServiceHistoryRecord[]> {
    const reports = await this.database.service_reports.findMany({
      include: {
        appointments: {
          include: {
            appointment_services: true,
            motorcycle_status_updates: {
              orderBy: { created_at: 'asc' },
              where: { customer_visible: true },
            },
            motorcycles: true,
          },
        },
        service_report_items: {
          orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
        },
      },
      orderBy: { completed_at: 'desc' },
      where: { appointments: { customer_user_id: customerUserId } },
    });

    return reports.map((report) => {
      const performed = report.service_report_items.filter(
        (item) => item.kind === 'performed',
      );
      const pending = report.service_report_items.filter(
        (item) => item.kind === 'pending',
      );
      const recommendations = report.service_report_items.filter(
        (item) => item.kind === 'recommendation',
      );
      const appointment = report.appointments;
      return {
        appointmentId: appointment.id,
        completedAt: report.completed_at.toISOString(),
        motorcycleLabel: motorcycleLabel(appointment.motorcycles),
        progress: appointment.motorcycle_status_updates.map((update) => ({
          appointmentId: appointment.id,
          createdAt: update.created_at.toISOString(),
          id: update.id,
          message: update.message,
          motorcycleLabel: motorcycleLabel(appointment.motorcycles),
          progressStatus: update.progress_status,
        })),
        recommendations: recommendations.map((item) => ({
          description: item.description,
          dueAt: item.due_at?.toISOString() ?? null,
          dueOdometerKm: item.due_odometer_km,
          id: item.id,
          severity: item.severity ?? 'info',
          title: item.title,
        })),
        services: appointment.appointment_services.map(
          (service) => service.service_name_snapshot,
        ),
        technicalSummary: report.technical_summary,
        total: appointmentTotal(appointment.appointment_services),
        workPending: pending.map(mapWorkItem),
        workPerformed: performed.map(mapWorkItem),
      };
    });
  }

  async listInvoices(customerUserId: string): Promise<Invoice[]> {
    const invoices = await this.database.invoices.findMany({
      include: { appointments: { include: { appointment_services: true } } },
      orderBy: { issued_at: 'desc' },
      where: { appointments: { customer_user_id: customerUserId } },
    });
    return invoices.map(mapInvoice);
  }

  async completeAppointmentWork(
    adminUserId: string,
    appointmentId: string,
    input: CompleteAppointmentWorkInput,
  ): Promise<{ invoiceId: string; reportId: string }> {
    return this.database.$transaction(async (transaction) => {
      const appointment = await transaction.appointments.findUnique({
        include: { appointment_services: true, service_reports: true },
        where: { id: appointmentId },
      });
      if (!appointment)
        throw new CustomerResourceError('appointment_not_found');
      if (
        appointment.service_reports ||
        ['cancelled', 'completed', 'no_show'].includes(appointment.status)
      ) {
        throw new CustomerResourceError('appointment_already_closed');
      }

      const report = await transaction.service_reports.create({
        data: {
          appointment_id: appointmentId,
          created_by_user_id: adminUserId,
          service_report_items: {
            create: [
              ...input.performed.map((item, index) => ({
                ...item,
                kind: 'performed' as const,
                sort_order: index,
              })),
              ...input.pending.map((item, index) => ({
                ...item,
                kind: 'pending' as const,
                sort_order: index,
              })),
              ...input.recommendations.map((item, index) => ({
                description: item.description,
                due_at: item.dueAt ? new Date(item.dueAt) : null,
                due_odometer_km: item.dueOdometerKm ?? null,
                kind: 'recommendation' as const,
                severity: item.severity,
                sort_order: index,
                title: item.title,
              })),
            ],
          },
          technical_summary: input.technicalSummary,
        },
      });

      const issuedAt = new Date();
      const amountCents = appointmentTotal(appointment.appointment_services);
      // A booking deposit may have already created the invoice, so upsert to
      // avoid colliding with the unique appointment_id constraint.
      const invoice = await transaction.invoices.upsert({
        create: {
          amount_cents: amountCents,
          appointment_id: appointmentId,
          currency: appointment.appointment_services[0]?.currency ?? 'CLP',
          document_number: `DRP-${issuedAt.getFullYear()}-${appointmentId.slice(0, 8).toUpperCase()}`,
          paid_at: input.paymentStatus === 'paid' ? issuedAt : null,
          payment_status: input.paymentStatus,
        },
        update: {
          amount_cents: amountCents,
          paid_at: input.paymentStatus === 'paid' ? issuedAt : null,
          payment_status: input.paymentStatus,
          updated_at: issuedAt,
        },
        where: { appointment_id: appointmentId },
      });

      await transaction.appointments.update({
        data: { status: 'completed', version: { increment: 1 } },
        where: { id: appointmentId, version: appointment.version },
      });
      await transaction.appointment_status_history.create({
        data: {
          appointment_id: appointmentId,
          changed_by_user_id: adminUserId,
          from_status: appointment.status,
          reason: 'Atención finalizada con informe técnico',
          to_status: 'completed',
        },
      });
      await transaction.audit_logs.create({
        data: {
          action: 'appointment.work_completed',
          actor_user_id: adminUserId,
          entity_id: appointmentId,
          entity_type: 'appointment',
          metadata: { invoiceId: invoice.id, reportId: report.id },
        },
      });
      return { invoiceId: invoice.id, reportId: report.id };
    });
  }

  /** Active technical-report presets, most used first, optionally by kind. */
  async listReportPresets(kind?: ReportPresetKind): Promise<ReportPreset[]> {
    const presets = await this.database.service_report_presets.findMany({
      orderBy: [{ usage_count: 'desc' }, { title: 'asc' }],
      where: { is_active: true, ...(kind ? { kind } : {}) },
    });
    return presets.map(mapReportPreset);
  }

  /**
   * Save a particular case as a reusable preset. Dedupes by (kind, title): if
   * it already exists we refresh the text, reactivate it and bump usage_count
   * so popular answers float to the top of the selector.
   */
  async createReportPreset(
    adminUserId: string,
    input: CreateReportPresetInput,
  ): Promise<ReportPreset> {
    const severity =
      input.kind === 'recommendation' ? (input.severity ?? 'info') : null;
    const preset = await this.database.service_report_presets.upsert({
      create: {
        created_by_user_id: adminUserId,
        description: input.description,
        kind: input.kind,
        severity,
        title: input.title,
      },
      update: {
        description: input.description,
        is_active: true,
        severity,
        updated_at: new Date(),
        usage_count: { increment: 1 },
      },
      where: { kind_title: { kind: input.kind, title: input.title } },
    });
    return mapReportPreset(preset);
  }

  async renderInvoicePdf(
    customerUserId: string,
    invoiceId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const invoice = await this.database.invoices.findFirst({
      include: {
        appointments: {
          include: {
            appointment_services: true,
            motorcycles: true,
            users: true,
          },
        },
      },
      where: {
        id: invoiceId,
        appointments: { customer_user_id: customerUserId },
      },
    });
    if (!invoice) throw new CustomerResourceError('invoice_not_found');

    const document = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks: Buffer[] = [];
    document.on('data', (chunk: Buffer) => chunks.push(chunk));
    const completed = new Promise<Buffer>((resolve, reject) => {
      document.on('end', () => resolve(Buffer.concat(chunks)));
      document.on('error', reject);
    });

    const appointment = invoice.appointments;
    document.fontSize(20).fillColor('#111111').text('MONOPISTON');
    document.moveDown(0.25).fontSize(10).fillColor('#555555');
    document.text('Comprobante de servicio no tributario');
    document.moveDown(1.5).fontSize(12).fillColor('#111111');
    document.text(`Documento: ${invoice.document_number}`);
    document.text(`Fecha: ${invoice.issued_at.toLocaleDateString('es-CL')}`);
    document.text(`Cliente: ${appointment.users.display_name}`);
    document.text(`Moto: ${motorcycleLabel(appointment.motorcycles)}`);
    document.moveDown();
    document.fontSize(13).text('Servicios');
    document.moveDown(0.5);
    for (const service of appointment.appointment_services) {
      document
        .fontSize(11)
        .text(
          `${service.service_name_snapshot}  ${formatClp(service.unit_price_cents * service.quantity)}`,
        );
    }
    document.moveDown();
    document.fontSize(14).text(`Total: ${formatClp(invoice.amount_cents)}`);
    document
      .moveDown(0.5)
      .fontSize(11)
      .text(
        `Estado: ${invoice.payment_status === 'paid' ? 'Pagado' : 'Pendiente'}`,
      );
    document
      .moveDown(2)
      .fontSize(9)
      .fillColor('#666666')
      .text(
        'Este documento resume la atención realizada y no reemplaza una boleta tributaria electrónica emitida por un proveedor autorizado.',
      );
    document.end();

    return {
      buffer: await completed,
      filename: `comprobante-${invoice.document_number}.pdf`,
    };
  }
}

const customerAppointmentInclude = {
  appointment_services: true,
  motorcycles: true,
} as const;

function mapAppointment(appointment: {
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
      label: motorcycleLabel(appointment.motorcycles),
    },
    services: appointment.appointment_services.map((service) => ({
      currency: service.currency,
      id: service.service_id,
      name: service.service_name_snapshot,
      unitPrice: service.unit_price_cents,
    })),
    startsAt: appointment.starts_at.toISOString(),
    status: appointment.status,
    total: appointmentTotal(appointment.appointment_services),
    whatsappPhone: appointment.whatsapp_phone,
  };
}

function mapReportPreset(preset: {
  description: string;
  id: string;
  kind: ReportPreset['kind'];
  severity: ReportPreset['severity'];
  title: string;
  usage_count: number;
}): ReportPreset {
  return {
    description: preset.description,
    id: preset.id,
    kind: preset.kind,
    severity: preset.severity,
    title: preset.title,
    usageCount: preset.usage_count,
  };
}

function appointmentTotal(
  services: Array<{ quantity: number; unit_price_cents: number }>,
): number {
  return services.reduce(
    (total, service) => total + service.quantity * service.unit_price_cents,
    0,
  );
}

function motorcycleLabel(motorcycle: {
  make: string;
  model: string;
  nickname: string | null;
}): string {
  return motorcycle.nickname ?? `${motorcycle.make} ${motorcycle.model}`;
}

function mapWorkItem(item: { description: string; id: string; title: string }) {
  return { description: item.description, id: item.id, title: item.title };
}

function mapInvoice(invoice: {
  amount_cents: number;
  appointment_id: string;
  currency: string;
  document_number: string;
  id: string;
  issued_at: Date;
  paid_at: Date | null;
  payment_status: 'pending' | 'paid';
  net_cents: number | null;
  iva_cents: number | null;
  document_kind: string;
  sii_status: string;
  sii_folio: string | null;
  appointments: {
    appointment_services: Array<{ service_name_snapshot: string }>;
  };
}): Invoice {
  return {
    amount: invoice.amount_cents,
    appointmentId: invoice.appointment_id,
    currency: invoice.currency,
    documentKind: invoice.document_kind,
    documentNumber: invoice.document_number,
    id: invoice.id,
    issuedAt: invoice.issued_at.toISOString(),
    ivaAmount: invoice.iva_cents,
    netAmount: invoice.net_cents,
    paidAt: invoice.paid_at?.toISOString() ?? null,
    paymentStatus: invoice.payment_status,
    services: invoice.appointments.appointment_services.map(
      (service) => service.service_name_snapshot,
    ),
    siiFolio: invoice.sii_folio,
    siiStatus: invoice.sii_status,
  };
}

function formatClp(value: number): string {
  return new Intl.NumberFormat('es-CL', {
    currency: 'CLP',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}
