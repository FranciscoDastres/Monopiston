import type { DatabaseClient } from '@monopiston/database';

import {
  PaymentService,
  type PaymentServiceConfig,
} from '../src/modules/payments/application/payment-service.js';
import type {
  FlowClient,
  FlowStatusResult,
} from '../src/modules/payments/infrastructure/flow-client.js';

const config: PaymentServiceConfig = {
  currency: 'CLP',
  subjectPrefix: 'Reserva cita Monopiston',
  urlConfirmation: 'https://api.example.cl/v1/payments/flow/confirm',
  urlReturn: 'https://api.example.cl/v1/payments/flow/return',
};

const appointmentId = '78c865ca-8224-4e9e-a2e2-a9eddf4fb844';

const basePayment = {
  amount_cents: 24_990,
  appointment_id: appointmentId,
  currency: 'CLP',
  flow_commerce_order: 'APPT-78C865CA-XYZ',
  flow_order: '1000',
  id: 'pay-1',
  status: 'pending' as const,
};

function paidStatus(
  overrides: Partial<FlowStatusResult> = {},
): FlowStatusResult {
  return {
    amount: 24_990,
    commerceOrder: basePayment.flow_commerce_order,
    flowOrder: '1000',
    status: 2,
    ...overrides,
  };
}

describe('PaymentService.confirmFromWebhook amount verification', () => {
  it('does NOT confirm when Flow reports a paid amount different from the order', async () => {
    const update = vi.fn(async () => undefined);
    const auditCreate = vi.fn(async () => undefined);
    const transaction = vi.fn(async () => undefined);
    const database = {
      audit_logs: { create: auditCreate },
      payments: {
        findUnique: vi.fn(async () => basePayment),
        update,
      },
      $transaction: transaction,
    } as unknown as DatabaseClient;

    // Flow says paid (status 2) but for a tampered/wrong amount.
    const flow = {
      getStatus: vi.fn(async () => paidStatus({ amount: 100 })),
    } as unknown as FlowClient;

    const service = new PaymentService(database, flow, config);
    await service.confirmFromWebhook('flow-token-123');

    // The appointment must never be confirmed on an amount mismatch.
    expect(transaction).not.toHaveBeenCalled();
    // The payment is flagged failed for manual review, not left as a retryable pending.
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed' }),
        where: { id: 'pay-1' },
      }),
    );
    // The anomaly is auditable.
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'payment.amount_mismatch',
          entity_id: 'pay-1',
          entity_type: 'payment',
        }),
      }),
    );
  });

  it('does NOT confirm when Flow reports a different commerceOrder', async () => {
    const update = vi.fn(async () => undefined);
    const auditCreate = vi.fn(async () => undefined);
    const transaction = vi.fn(async () => undefined);
    const database = {
      audit_logs: { create: auditCreate },
      payments: {
        findUnique: vi.fn(async () => basePayment),
        update,
      },
      $transaction: transaction,
    } as unknown as DatabaseClient;

    // Paid, correct amount, but the order identity does not match ours.
    const flow = {
      getStatus: vi.fn(async () =>
        paidStatus({ commerceOrder: 'APPT-OTHER-ORDER-ZZZ' }),
      ),
    } as unknown as FlowClient;

    const service = new PaymentService(database, flow, config);
    await service.confirmFromWebhook('flow-token-123');

    expect(transaction).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed' }),
        where: { id: 'pay-1' },
      }),
    );
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'payment.commerce_order_mismatch',
          entity_id: 'pay-1',
          entity_type: 'payment',
        }),
      }),
    );
  });

  it('confirms when Flow reports the exact order amount', async () => {
    const appointment = {
      id: appointmentId,
      status: 'pending_payment' as const,
      version: 1,
      whatsapp_phone: null,
    };
    const innerTransaction = {
      appointments: {
        findUnique: vi.fn(async () => appointment),
        update: vi.fn(async () => undefined),
      },
      appointment_status_history: { create: vi.fn(async () => undefined) },
      audit_logs: { create: vi.fn(async () => undefined) },
      invoices: { upsert: vi.fn(async () => ({ id: 'inv-1' })) },
      payments: { update: vi.fn(async () => undefined) },
    };
    const database = {
      payments: {
        findUnique: vi.fn(async () => basePayment),
        update: vi.fn(async () => undefined),
      },
      $transaction: vi.fn(
        async (callback: (tx: typeof innerTransaction) => Promise<unknown>) =>
          callback(innerTransaction),
      ),
    } as unknown as DatabaseClient;

    const flow = {
      getStatus: vi.fn(async () => paidStatus()),
    } as unknown as FlowClient;

    const service = new PaymentService(database, flow, config);
    await service.confirmFromWebhook('flow-token-123');

    expect(innerTransaction.appointments.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'confirmed' }),
      }),
    );
  });
});

describe('PaymentService.reconcilePendingPayments', () => {
  it('confirms an open payment that Flow now reports as paid', async () => {
    const appointment = {
      id: appointmentId,
      status: 'pending_payment' as const,
      version: 1,
      whatsapp_phone: null,
    };
    const innerTransaction = {
      appointments: {
        findUnique: vi.fn(async () => appointment),
        update: vi.fn(async () => undefined),
      },
      appointment_status_history: { create: vi.fn(async () => undefined) },
      audit_logs: { create: vi.fn(async () => undefined) },
      invoices: { upsert: vi.fn(async () => ({ id: 'inv-1' })) },
      payments: { update: vi.fn(async () => undefined) },
    };
    // findUnique is called twice per token: once inside confirmFromWebhook (still
    // pending) and once by reconcile to read the post-confirm status (paid).
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce(basePayment)
      .mockResolvedValueOnce({ status: 'paid' });
    const database = {
      payments: {
        findMany: vi.fn(async () => [{ flow_token: 'tok-1', id: 'pay-1' }]),
        findUnique,
      },
      $transaction: vi.fn(
        async (callback: (tx: typeof innerTransaction) => Promise<unknown>) =>
          callback(innerTransaction),
      ),
    } as unknown as DatabaseClient;
    const flow = {
      getStatus: vi.fn(async () => paidStatus()),
    } as unknown as FlowClient;

    const service = new PaymentService(database, flow, config);
    const confirmed = await service.reconcilePendingPayments();

    expect(confirmed).toBe(1);
    expect(innerTransaction.appointments.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'confirmed' }),
      }),
    );
  });
});

describe('PaymentService.expireStaleHolds', () => {
  it('does NOT cancel a hold that reconciliation confirmed as paid', async () => {
    const innerTransaction = {
      appointments: {
        // Reconciliation already moved it to 'confirmed'; the re-read sees that.
        findUnique: vi.fn(async () => ({ status: 'confirmed', version: 2 })),
        updateMany: vi.fn(async () => ({ count: 0 })),
      },
      appointment_status_history: { create: vi.fn(async () => undefined) },
      payments: { updateMany: vi.fn(async () => ({ count: 0 })) },
    };
    const database = {
      appointments: {
        findMany: vi.fn(async () => [
          { id: appointmentId, status: 'pending_payment', version: 1 },
        ]),
      },
      // reconcileAppointmentPayments finds no open payment here (already paid).
      payments: { findMany: vi.fn(async () => []) },
      $transaction: vi.fn(
        async (callback: (tx: typeof innerTransaction) => Promise<unknown>) =>
          callback(innerTransaction),
      ),
    } as unknown as DatabaseClient;
    const flow = {} as unknown as FlowClient;

    const service = new PaymentService(database, flow, config);
    const released = await service.expireStaleHolds();

    expect(released).toBe(0);
    expect(innerTransaction.appointments.updateMany).not.toHaveBeenCalled();
  });

  it('cancels a hold still pending_payment after reconciliation', async () => {
    const innerTransaction = {
      appointments: {
        findUnique: vi.fn(async () => ({
          status: 'pending_payment',
          version: 1,
        })),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      appointment_status_history: { create: vi.fn(async () => undefined) },
      payments: { updateMany: vi.fn(async () => ({ count: 1 })) },
    };
    const database = {
      appointments: {
        findMany: vi.fn(async () => [
          { id: appointmentId, status: 'pending_payment', version: 1 },
        ]),
      },
      payments: { findMany: vi.fn(async () => []) },
      $transaction: vi.fn(
        async (callback: (tx: typeof innerTransaction) => Promise<unknown>) =>
          callback(innerTransaction),
      ),
    } as unknown as DatabaseClient;
    const flow = {} as unknown as FlowClient;

    const service = new PaymentService(database, flow, config);
    const released = await service.expireStaleHolds();

    expect(released).toBe(1);
    expect(innerTransaction.appointments.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'cancelled' }),
        where: expect.objectContaining({ status: 'pending_payment' }),
      }),
    );
  });
});
