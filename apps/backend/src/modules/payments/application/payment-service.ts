import type {
  PaymentSettings,
  PaymentStatusView,
  UpdatePaymentSettingsInput,
} from '@monopiston/contracts';
import type { DatabaseClient } from '@monopiston/database';

import {
  NoopWhatsAppNotifier,
  type WhatsAppNotifier,
} from '../../notifications/whatsapp-notifier.js';
import {
  type FlowClient,
  type FlowStatusResult,
  isPaidFlowStatus,
} from '../infrastructure/flow-client.js';
import { computeChargeAmount, computeTaxBreakdown } from './payment-math.js';

export class PaymentError extends Error {}

export interface PaymentServiceConfig {
  currency: string;
  subjectPrefix: string;
  urlConfirmation: string;
  urlReturn: string;
}

const DEFAULT_SETTINGS: PaymentSettings = {
  depositFixed: 0,
  depositPercent: 30,
  holdMinutes: 30,
  mode: 'total',
};

export class PaymentService {
  constructor(
    private readonly database: DatabaseClient,
    private readonly flow: FlowClient,
    private readonly config: PaymentServiceConfig,
    // Optional so existing wiring/tests keep their 3-arg construction. Defaults
    // to a no-op until a WhatsApp provider is configured.
    private readonly whatsapp: WhatsAppNotifier = new NoopWhatsAppNotifier(),
  ) {}

  async getSettings(): Promise<PaymentSettings> {
    const row = await this.database.payment_settings.findFirst();
    if (!row) return DEFAULT_SETTINGS;
    return {
      depositFixed: row.deposit_fixed_cents,
      depositPercent: row.deposit_percent,
      holdMinutes: row.hold_minutes,
      mode: row.mode,
    };
  }

  async updateSettings(
    input: UpdatePaymentSettingsInput,
  ): Promise<PaymentSettings> {
    await this.database.payment_settings.update({
      data: {
        ...(input.mode !== undefined && { mode: input.mode }),
        ...(input.depositFixed !== undefined && {
          deposit_fixed_cents: input.depositFixed,
        }),
        ...(input.depositPercent !== undefined && {
          deposit_percent: input.depositPercent,
        }),
        ...(input.holdMinutes !== undefined && {
          hold_minutes: input.holdMinutes,
        }),
        updated_at: new Date(),
      },
      where: { id: true },
    });
    return this.getSettings();
  }

  async createForAppointment(
    customerUserId: string,
    appointmentId: string,
  ): Promise<{ redirectUrl: string }> {
    const appointment = await this.database.appointments.findFirst({
      include: { appointment_services: true, users: true },
      where: { customer_user_id: customerUserId, id: appointmentId },
    });
    if (!appointment) throw new PaymentError('appointment_not_found');
    if (appointment.status !== 'pending_payment') {
      throw new PaymentError('appointment_not_payable');
    }

    // Reuse a still-valid pending order so a double click never charges twice.
    const existing = await this.database.payments.findFirst({
      orderBy: { created_at: 'desc' },
      where: {
        appointment_id: appointmentId,
        expires_at: { gt: new Date() },
        status: { in: ['created', 'pending'] },
      },
    });
    if (existing) {
      const redirectUrl = (existing.raw_response as { redirectUrl?: string })
        ?.redirectUrl;
      if (redirectUrl) return { redirectUrl };
    }

    const settings = await this.getSettings();
    // The amount is always derived server-side from the frozen service prices;
    // the client never supplies it.
    const total = appointment.appointment_services.reduce(
      (sum, service) => sum + service.unit_price_cents * service.quantity,
      0,
    );
    const amount = computeChargeAmount(total, settings);
    const commerceOrder = `APPT-${appointmentId.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    const result = await this.flow.createPayment({
      amount,
      commerceOrder,
      currency: this.config.currency,
      email: appointment.users.email,
      subject: `${this.config.subjectPrefix} ${appointment.id.slice(0, 8).toUpperCase()}`,
      urlConfirmation: this.config.urlConfirmation,
      urlReturn: this.config.urlReturn,
    });

    await this.database.payments.create({
      data: {
        amount_cents: amount,
        appointment_id: appointmentId,
        currency: this.config.currency,
        expires_at: appointment.payment_hold_expires_at,
        flow_commerce_order: commerceOrder,
        flow_order: result.flowOrder,
        flow_token: result.token,
        mode: settings.mode,
        raw_response: { redirectUrl: result.redirectUrl },
        status: 'pending',
      },
    });

    return { redirectUrl: result.redirectUrl };
  }

  // Called by the Flow webhook (urlConfirmation). The POSTed token is NEVER
  // trusted on its own: we re-query Flow's getStatus with our secret key and
  // only mark the appointment confirmed when Flow reports a paid status.
  async confirmFromWebhook(token: string): Promise<void> {
    const payment = await this.database.payments.findUnique({
      where: { flow_token: token },
    });
    if (!payment) throw new PaymentError('payment_not_found');
    if (payment.status === 'paid') return; // idempotent replay

    const status = await this.flow.getStatus(token);
    if (!isPaidFlowStatus(status.status)) {
      await this.database.payments.update({
        data: { raw_response: { ...status }, status: 'pending' },
        where: { id: payment.id },
      });
      return;
    }

    // Defense in depth: Flow reports paid, but both the amount AND the order
    // identity must match what we created server-side. Flow does not sign its
    // JSON responses (integrity rests on TLS + our re-query), so we re-validate
    // here. Any mismatch (tampering, wrong order, Flow anomaly) must NEVER
    // confirm the appointment or emit an invoice: we flag the payment 'failed'
    // (so reconciliation won't retry it) and record an audit event for manual
    // review. Amounts are whole CLP pesos on both sides.
    if (status.amount !== payment.amount_cents) {
      await this.failMismatchedPayment(
        payment,
        status,
        'payment.amount_mismatch',
      );
      return;
    }
    if (
      status.commerceOrder &&
      status.commerceOrder !== payment.flow_commerce_order
    ) {
      await this.failMismatchedPayment(
        payment,
        status,
        'payment.commerce_order_mismatch',
      );
      return;
    }

    const breakdown = computeTaxBreakdown(payment.amount_cents);
    const paidAt = new Date();
    let confirmedPhone: string | null = null;

    await this.database.$transaction(async (transaction) => {
      const appointment = await transaction.appointments.findUnique({
        where: { id: payment.appointment_id },
      });
      if (!appointment) throw new PaymentError('appointment_not_found');

      const invoice = await transaction.invoices.upsert({
        create: {
          amount_cents: payment.amount_cents,
          appointment_id: payment.appointment_id,
          currency: payment.currency,
          document_number: `DRP-${paidAt.getFullYear()}-${payment.appointment_id.slice(0, 8).toUpperCase()}`,
          iva_cents: breakdown.iva,
          net_cents: breakdown.net,
          paid_at: paidAt,
          payment_id: payment.id,
          payment_status: 'paid',
          total_cents: payment.amount_cents,
        },
        update: {
          iva_cents: breakdown.iva,
          net_cents: breakdown.net,
          paid_at: paidAt,
          payment_id: payment.id,
          payment_status: 'paid',
          total_cents: payment.amount_cents,
        },
        where: { appointment_id: payment.appointment_id },
      });

      await transaction.payments.update({
        data: {
          flow_order: status.flowOrder || payment.flow_order,
          paid_at: paidAt,
          raw_response: { ...status },
          status: 'paid',
        },
        where: { id: payment.id },
      });

      if (appointment.status === 'pending_payment') {
        await transaction.appointments.update({
          data: { status: 'confirmed', version: { increment: 1 } },
          where: { id: appointment.id },
        });
        await transaction.appointment_status_history.create({
          data: {
            appointment_id: appointment.id,
            from_status: appointment.status,
            reason: 'Pago confirmado por Flow',
            to_status: 'confirmed',
          },
        });
        confirmedPhone = appointment.whatsapp_phone;
      }

      await transaction.audit_logs.create({
        data: {
          action: 'payment.confirmed',
          entity_id: payment.id,
          entity_type: 'payment',
          metadata: {
            amount: payment.amount_cents,
            appointmentId: payment.appointment_id,
            flowOrder: status.flowOrder,
            invoiceId: invoice.id,
          },
        },
      });
    });

    // Fire-and-forget: notify the customer their booking is confirmed. The
    // notifier is a no-op until a WhatsApp provider is configured. A delivery
    // failure must never undo the already-committed payment confirmation.
    if (confirmedPhone) {
      try {
        await this.whatsapp.send({
          body: 'Tu pago fue confirmado y tu cita en Taller Mono Pistón está reservada. ¡Te esperamos!',
          kind: 'payment_confirmed',
          to: confirmedPhone,
        });
      } catch {
        // swallow: notification is best-effort
      }
    }
  }

  async getStatusView(
    customerUserId: string,
    appointmentId: string,
  ): Promise<PaymentStatusView> {
    const appointment = await this.database.appointments.findFirst({
      where: { customer_user_id: customerUserId, id: appointmentId },
    });
    if (!appointment) throw new PaymentError('appointment_not_found');

    const payment = await this.database.payments.findFirst({
      orderBy: { created_at: 'desc' },
      where: { appointment_id: appointmentId },
    });
    const invoice = await this.database.invoices.findUnique({
      select: { id: true },
      where: { appointment_id: appointmentId },
    });

    return {
      amount: payment?.amount_cents ?? 0,
      appointmentId,
      currency: payment?.currency ?? this.config.currency,
      invoiceId: invoice?.id ?? null,
      status: payment?.status ?? 'created',
    };
  }

  // Flags a paid-but-inconsistent Flow payment as failed and records an audit
  // event. Shared by the amount and commerceOrder mismatch guards so neither
  // ever confirms the appointment.
  private async failMismatchedPayment(
    payment: {
      amount_cents: number;
      appointment_id: string;
      flow_commerce_order: string;
      id: string;
    },
    status: FlowStatusResult,
    action: 'payment.amount_mismatch' | 'payment.commerce_order_mismatch',
  ): Promise<void> {
    await this.database.payments.update({
      data: { raw_response: { ...status }, status: 'failed' },
      where: { id: payment.id },
    });
    await this.database.audit_logs.create({
      data: {
        action,
        entity_id: payment.id,
        entity_type: 'payment',
        metadata: {
          appointmentId: payment.appointment_id,
          expectedAmount: payment.amount_cents,
          expectedCommerceOrder: payment.flow_commerce_order,
          flowCommerceOrder: status.commerceOrder,
          flowOrder: status.flowOrder,
          reportedAmount: status.amount,
        },
      },
    });
  }

  // Defense in depth against a lost webhook: re-query Flow for any still-open
  // payment created in the recent window and confirm the ones Flow now reports as
  // paid. Delegates to confirmFromWebhook, which is idempotent and re-validates
  // the amount, so a replay or an already-confirmed payment is a no-op. Returns
  // how many payments flipped to paid (for observability).
  async reconcilePendingPayments(
    maxAgeMs = 48 * 60 * 60 * 1000,
  ): Promise<number> {
    const since = new Date(Date.now() - maxAgeMs);
    const open = await this.database.payments.findMany({
      orderBy: { created_at: 'asc' },
      select: { flow_token: true, id: true },
      where: {
        created_at: { gte: since },
        flow_token: { not: null },
        status: { in: ['created', 'pending'] },
      },
    });

    let confirmed = 0;
    for (const { flow_token: token, id } of open) {
      if (!token) continue;
      try {
        await this.confirmFromWebhook(token);
        const fresh = await this.database.payments.findUnique({
          select: { status: true },
          where: { id },
        });
        if (fresh?.status === 'paid') confirmed += 1;
      } catch {
        // Best-effort per payment: a single failure must not stop the sweep.
      }
    }
    return confirmed;
  }

  // Reconciles every open payment of a single appointment. Used right before
  // releasing an expired hold so a paid-but-unwebhooked booking is confirmed
  // instead of cancelled.
  private async reconcileAppointmentPayments(
    appointmentId: string,
  ): Promise<void> {
    const open = await this.database.payments.findMany({
      select: { flow_token: true },
      where: {
        appointment_id: appointmentId,
        flow_token: { not: null },
        status: { in: ['created', 'pending'] },
      },
    });
    for (const { flow_token: token } of open) {
      if (!token) continue;
      try {
        await this.confirmFromWebhook(token);
      } catch {
        // Best-effort: fall through to the normal expiry handling.
      }
    }
  }

  // Releases slots whose payment hold elapsed without a confirmed payment.
  async expireStaleHolds(): Promise<number> {
    const now = new Date();
    const stale = await this.database.appointments.findMany({
      select: { id: true, status: true, version: true },
      where: {
        payment_hold_expires_at: { lt: now },
        status: 'pending_payment',
      },
    });

    let released = 0;
    for (const appointment of stale) {
      // A lost webhook could mean this "expired" hold was actually paid. Reconcile
      // with Flow first; if it was paid, confirmFromWebhook already moved it to
      // 'confirmed' and the re-read below keeps us from cancelling a paid slot.
      await this.reconcileAppointmentPayments(appointment.id);

      await this.database.$transaction(async (transaction) => {
        const fresh = await transaction.appointments.findUnique({
          select: { status: true, version: true },
          where: { id: appointment.id },
        });
        if (!fresh || fresh.status !== 'pending_payment') return;

        const updated = await transaction.appointments.updateMany({
          data: {
            cancellation_reason: 'payment_expired',
            cancelled_at: now,
            status: 'cancelled',
            version: { increment: 1 },
          },
          where: {
            id: appointment.id,
            status: 'pending_payment',
            version: fresh.version,
          },
        });
        if (updated.count === 0) return;

        await transaction.appointment_status_history.create({
          data: {
            appointment_id: appointment.id,
            from_status: 'pending_payment',
            reason: 'payment_expired',
            to_status: 'cancelled',
          },
        });
        await transaction.payments.updateMany({
          data: { status: 'expired' },
          where: {
            appointment_id: appointment.id,
            status: { in: ['created', 'pending'] },
          },
        });
        released += 1;
      });
    }
    return released;
  }
}
