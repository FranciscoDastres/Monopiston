import type { DatabaseClient } from '@monopiston/database';

import type { AuthUser } from '../domain/auth.js';
import { hashPassword } from '../infrastructure/password.js';

export class AdminProvisioningError extends Error {}

export interface AdminProvisioningInput {
  displayName: string;
  email: string;
  password: string;
}

export async function provisionAdmin(
  database: DatabaseClient,
  input: AdminProvisioningInput,
): Promise<AuthUser> {
  const passwordHash = await hashPassword(input.password);

  const user = await database.$transaction(async (transaction) => {
    const existingAdmin = await transaction.users.findFirst({
      select: { id: true },
      where: { role: 'admin' },
    });
    if (existingAdmin) throw new AdminProvisioningError('admin_already_exists');

    const email = input.email.trim().toLowerCase();
    const existingUser = await transaction.users.findUnique({
      where: { email },
    });

    if (existingUser) {
      await transaction.oauth_accounts.deleteMany({
        where: { user_id: existingUser.id },
      });
      await transaction.auth_sessions.deleteMany({
        where: { user_id: existingUser.id },
      });
      return transaction.users.update({
        data: {
          display_name: input.displayName.trim(),
          is_active: true,
          password_hash: passwordHash,
          role: 'admin',
        },
        where: { id: existingUser.id },
      });
    }

    return transaction.users.create({
      data: {
        display_name: input.displayName.trim(),
        email,
        password_hash: passwordHash,
        role: 'admin',
      },
    });
  });

  return {
    avatarUrl: user.avatar_url,
    displayName: user.display_name,
    email: user.email,
    id: user.id,
    phone: user.phone,
    role: user.role,
  };
}
