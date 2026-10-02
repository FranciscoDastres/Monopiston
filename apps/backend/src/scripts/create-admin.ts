import { randomBytes } from 'node:crypto';

import { createDatabaseClient } from '@monopiston/database';
import { z } from 'zod';

import {
  AdminProvisioningError,
  provisionAdmin,
} from '../modules/auth/application/admin-provisioning.js';

const inputSchema = z
  .object({
    databaseUrl: z.url(),
    displayName: z.string().trim().min(1).max(120),
    email: z.email().trim().toLowerCase(),
    generatePassword: z.boolean(),
    password: z.string().min(12).max(128).optional(),
  })
  .refine((input) => input.generatePassword !== Boolean(input.password), {
    message: 'Set ADMIN_PASSWORD or ADMIN_GENERATE_PASSWORD=true, but not both',
  });

const input = inputSchema.parse({
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgresql://dracing:dracing@localhost:55432/dracing',
  displayName:
    process.env.ADMIN_DISPLAY_NAME ?? 'Administrador Taller Mono Pistón',
  email: process.env.ADMIN_EMAIL,
  generatePassword: process.env.ADMIN_GENERATE_PASSWORD === 'true',
  password: process.env.ADMIN_PASSWORD,
});
const generatedPassword = input.generatePassword
  ? randomBytes(24).toString('base64url')
  : undefined;
const password = input.password ?? generatedPassword;
if (!password) throw new Error('admin_password_required');

const database = createDatabaseClient(input.databaseUrl);

try {
  const admin = await provisionAdmin(database, {
    displayName: input.displayName,
    email: input.email,
    password,
  });
  console.log(`Administrator created: ${admin.email}`);
  if (generatedPassword)
    console.log(`Generated password: ${generatedPassword}`);
} catch (error) {
  if (error instanceof AdminProvisioningError) {
    if (process.env.ADMIN_SKIP_IF_EXISTS === 'true') {
      console.log('Administrator already exists; skipping provisioning.');
    } else {
      console.error('Administrator was not created: one already exists.');
      process.exitCode = 1;
    }
  } else {
    throw error;
  }
} finally {
  await database.$disconnect();
}
