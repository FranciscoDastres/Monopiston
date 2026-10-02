import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

import { expect, it } from 'vitest';

it.each([
  '(ENOTFOUND) tenant/user postgres.example not found',
  'Tenant or user not found',
])('reports a pooler rejection safely: %s', async (message) => {
  // Exercise the actual pg parser and migration process with a PostgreSQL
  // ErrorResponse, rather than mocking the string-matching implementation.
  const server = createServer((socket) => {
    socket.once('data', () => {
      const fields = Buffer.from(`SFATAL\0CXX000\0M${message}\0\0`);
      const header = Buffer.alloc(5);
      header.write('E');
      header.writeInt32BE(fields.length + 4, 1);
      socket.end(Buffer.concat([header, fields]));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing port');

  try {
    const script = fileURLToPath(
      new URL('../scripts/migrate.mjs', import.meta.url),
    );
    const child = spawn(process.execPath, [script], {
      env: {
        ...process.env,
        DATABASE_URL: `postgresql://postgres.example:secret-do-not-log@127.0.0.1:${address.port}/postgres?sslmode=disable`,
      },
    });
    let output = '';
    child.stdout.on('data', (data) => {
      output += data.toString();
    });
    child.stderr.on('data', (data) => {
      output += data.toString();
    });
    const code = await new Promise<number | null>((resolve, reject) => {
      child.once('error', reject);
      child.once('close', resolve);
    });

    expect(code).toBe(1);
    expect(output).toContain('Supabase rechazó DATABASE_URL');
    expect(output).toContain('Session pooler (puerto 5432)');
    expect(output).not.toContain('secret-do-not-log');
    expect(output).not.toContain('postgres.example');
    expect(output).not.toContain('parser.js');
    expect(output).not.toContain('Applying');
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
