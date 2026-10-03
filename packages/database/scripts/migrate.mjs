// Aplica database/migrations/*.sql contra DATABASE_URL usando node-postgres,
// con la misma semántica que infra/docker/run-migrations.sh (tabla
// schema_migrations, idempotente por nombre de archivo). Pensado para entornos
// sin psql; el contenedor de Render lo ejecuta antes de iniciar la API.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir =
  process.env.MIGRATIONS_DIR ??
  path.resolve(scriptDir, '../../../database/migrations');

const client = new pg.Client({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 15_000,
});
let lockAcquired = false;

try {
  await client.connect();
  // Supabase via Supavisor session mode keeps this session-level advisory lock
  // for the lifetime of the connection. It prevents two Render instances from
  // applying the same migration during a zero-downtime deploy.
  await client.query(
    "SELECT pg_advisory_lock(hashtext('dracing_schema_migrations')::bigint)",
  );
  lockAcquired = true;

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const filename of files) {
    const { rowCount } = await client.query(
      'SELECT 1 FROM schema_migrations WHERE filename = $1',
      [filename],
    );
    if (rowCount > 0) {
      console.log(`Skipping ${filename} (already applied)`);
      continue;
    }

    console.log(`Applying ${filename}`);
    const sql = await readFile(path.join(migrationsDir, filename), 'utf8');
    // Cada archivo trae su propio BEGIN/COMMIT, así que se envía tal cual.
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [
      filename,
    ]);
  }
} catch (error) {
  if (/tenant(?:\/| or )user.*not found/i.test(error.message ?? '')) {
    console.error(
      'Supabase rechazó DATABASE_URL: el host y el usuario no corresponden a un proyecto del pooler. ' +
        'Copia la cadena completa desde Supabase > Connect > Session pooler (puerto 5432) ' +
        'y actualiza DATABASE_URL en Render. Conserva el host exacto y el usuario con su referencia de proyecto; ' +
        'no deduzcas el host a partir de la región. Las migraciones no se ejecutaron.',
    );
    process.exitCode = 1;
  } else {
    throw error;
  }
} finally {
  if (lockAcquired) {
    await client
      .query(
        "SELECT pg_advisory_unlock(hashtext('dracing_schema_migrations')::bigint)",
      )
      .catch(() => undefined);
  }
  await client.end();
}
