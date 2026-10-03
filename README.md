# Taller Mono Pistón

Base de arquitectura para la plataforma de gestión de citas de un taller
especializado en Honda NAVI.

## Decisiones base

- Monorepo TypeScript con `pnpm`.
- Frontend SPA: React, Vite, TypeScript y Tailwind CSS.
- API: Node.js, NestJS sobre Fastify y TypeScript, organizada por módulos y
  capas limpias.
- Persistencia: PostgreSQL; Prisma se usará como adaptador, no dentro del dominio.
- Autenticación: Google OAuth 2.0/OIDC para clientes y una única cuenta local de
  administrador, con sesión segura administrada por el backend.
- Despliegues independientes para frontend, API y migraciones.

## Documentación

- [Modelo de datos](docs/data-model.md)
- [Arquitectura y estructura](docs/architecture.md)
- [Seguridad y autenticación](docs/security.md)
- [Frontend, marca y limpieza](docs/frontend.md)
- [UI/UX](docs/ui-ux.md)
- [Infraestructura y Docker](docs/infrastructure.md)
- [Desarrollo local](docs/local-development.md)
- [Migración a NestJS](docs/nestjs-migration.md)
- [Roadmap](docs/roadmap.md)
- [Estado actualizado](docs/status-2026-10-01.md)
- [Skills de desarrollo](docs/skills.md)
- [Perfiles de modelos y skills de Codex](docs/codex.md)
- [Deployment](docs/deploy-render.md)

La primera migración propuesta está en
[`database/migrations/001_initial_schema.sql`](database/migrations/001_initial_schema.sql).

## Desarrollo local

Requisitos: Node.js 24.18 LTS, pnpm 10 y Docker con Compose.

```bash
cp .env.example .env
pnpm install
pnpm db:up
pnpm db:migrate
pnpm dev
```

Después de las migraciones, crear el único administrador (el comando falla si ya
existe uno):

```bash
ADMIN_EMAIL=administrador@ejemplo.cl \
ADMIN_PASSWORD='una-clave-segura-de-12-o-mas' \
ADMIN_DISPLAY_NAME='Administrador Taller Mono Pistón' \
pnpm --filter @monopiston/backend admin:create
```

También se puede usar `ADMIN_GENERATE_PASSWORD=true` en lugar de
`ADMIN_PASSWORD`; la contraseña generada se muestra una sola vez. Estas variables
son de ejecución puntual y no deben guardarse en `.env`.

- Frontend: <http://localhost:5180>
- API: <http://localhost:3001/api>
- Liveness: <http://localhost:3001/health/live>
- Readiness: <http://localhost:3001/health/ready>

`pnpm dev` libera automáticamente los puertos `5180`/`3001` antes de arrancar, por
lo que reiniciar el entorno no produce errores `EADDRINUSE`.

Sin credenciales de Google configuradas, el entorno de desarrollo habilita un
**acceso de desarrollo**: el botón «Agendar una cita» inicia sesión de forma
automática y registra una Honda NAVI de prueba. El detalle está en
[Desarrollo local](docs/local-development.md).

Para levantar el stack productivo completo mediante imágenes locales:

```bash
pnpm dev:up
```

Comandos de calidad:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:unused
```

## Configurar Google OAuth

Crear un cliente OAuth 2.0 de tipo **Web application** en Google Cloud y registrar
esta URI de redirección para el entorno local:

```text
http://localhost:3000/v1/auth/google/callback
```

Después configurar en `.env`:

```text
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/v1/auth/google/callback
SESSION_SECRET=<valor-aleatorio-de-al-menos-32-caracteres>
COOKIE_SECURE=false
```

En producción, las URLs deben ser HTTPS y `COOKIE_SECURE=true`. Si se cambian
`API_PORT` o `APP_PORT`, también se deben actualizar las URLs registradas en
Google y las variables `API_ORIGIN`, `APP_ORIGIN` y `GOOGLE_REDIRECT_URI`.

Endpoints principales implementados:

```text
GET    /v1/auth/google
GET    /v1/auth/google/callback
POST   /v1/auth/login
GET    /v1/auth/me
POST   /v1/auth/logout
GET    /v1/services
GET    /v1/motorcycles
POST   /v1/motorcycles
PATCH  /v1/motorcycles/:id
DELETE /v1/motorcycles/:id
GET    /v1/availability
GET    /v1/appointments
POST   /v1/appointments
PATCH  /v1/appointments/:id/cancel
GET    /v1/appointments/:id/timeline
GET    /v1/notifications
GET    /v1/admin/appointments
PATCH  /v1/admin/appointments/:id/status
PATCH  /v1/admin/appointments/:id/service-bay
GET    /v1/admin/service-bays
POST   /v1/admin/appointments/:id/motorcycle-updates
GET    /v1/admin/workshop/services
POST   /v1/admin/workshop/services
GET    /v1/admin/workshop/hours
POST   /v1/admin/workshop/hours
GET    /v1/admin/workshop/exceptions
POST   /v1/admin/workshop/exceptions
```
