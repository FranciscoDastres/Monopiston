import type { DatabaseClient } from '@monopiston/database';

import { PrismaAuthRepository } from '../src/modules/auth/infrastructure/prisma-auth-repository.js';

const userId = '9d8ce4e1-1e2b-4a98-beb6-c96e8d5e63f2';

function buildTransactionMock() {
  return {
    appointments: { updateMany: vi.fn(async () => ({ count: 0 })) },
    audit_logs: { create: vi.fn(async () => undefined) },
    auth_sessions: { updateMany: vi.fn(async () => ({ count: 0 })) },
    invoices: { updateMany: vi.fn(async () => ({ count: 0 })) },
    motorcycles: { updateMany: vi.fn(async () => ({ count: 0 })) },
    oauth_accounts: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    users: { update: vi.fn(async () => undefined) },
  };
}

describe('PrismaAuthRepository.anonymizeUserAccount', () => {
  it('scrubs personal data, drops the identity link and revokes sessions', async () => {
    const tx = buildTransactionMock();
    const database = {
      $transaction: vi.fn(
        async (callback: (t: typeof tx) => Promise<unknown>) => callback(tx),
      ),
    } as unknown as DatabaseClient;

    const repository = new PrismaAuthRepository(database);
    await repository.anonymizeUserAccount(userId);

    // The user's direct PII is replaced with a unique tombstone and the row is
    // marked deleted/inactive.
    expect(tx.users.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          avatar_url: null,
          deleted_at: expect.any(Date),
          display_name: expect.any(String),
          email: expect.stringContaining(userId),
          is_active: false,
          password_hash: null,
          phone: null,
        }),
        where: { id: userId },
      }),
    );

    // The Google identity link (provider_subject is PII and allows re-login) is
    // removed entirely.
    expect(tx.oauth_accounts.deleteMany).toHaveBeenCalledWith({
      where: { user_id: userId },
    });

    // Every session is revoked and its UA/IP scrubbed.
    expect(tx.auth_sessions.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ip_address: null, user_agent: null }),
        where: { user_id: userId },
      }),
    );

    // Vehicle identifiers tied to the person are cleared.
    expect(tx.motorcycles.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ license_plate: null, vin: null }),
        where: { owner_user_id: userId },
      }),
    );

    // PII captured on appointments (WhatsApp number) is cleared.
    expect(tx.appointments.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ whatsapp_phone: null }),
        where: { customer_user_id: userId },
      }),
    );

    // The erasure is auditable.
    expect(tx.audit_logs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'user.account_anonymized',
          entity_id: userId,
          entity_type: 'user',
        }),
      }),
    );

    // Financial records (invoices) are RETAINED for tax compliance.
    expect(tx.invoices.updateMany).not.toHaveBeenCalled();
  });
});
