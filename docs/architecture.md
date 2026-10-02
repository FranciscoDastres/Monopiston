# Arquitectura

## Forma del sistema

Se propone un monorepo. Frontend y API conservan ciclos de build y despliegue
independientes, mientras comparten contratos y configuración. Para este tamaño de
producto, repositorios separados duplicarían CI, tipos y gestión de versiones sin
dar aislamiento útil.

```text
Monopiston/
├── apps/
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── app/                  # router, providers, layout, guards
│   │   │   ├── features/
│   │   │   │   ├── auth/
│   │   │   │   ├── motorcycles/
│   │   │   │   ├── appointments/
│   │   │   │   ├── services/
│   │   │   │   └── admin/
│   │   │   ├── components/           # UI reutilizable, sin reglas de negocio
│   │   │   ├── lib/                  # cliente HTTP, fechas, telemetría
│   │   │   ├── styles/
│   │   │   └── test/
│   │   ├── public/
│   │   ├── Dockerfile
│   │   └── package.json
│   └── backend/
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── users/
│       │   │   ├── motorcycles/
│       │   │   ├── services/
│       │   │   ├── appointments/
│       │   │   └── availability/
│       │   ├── shared/
│       │   │   ├── domain/           # Entity, Result, errores
│       │   │   ├── application/      # puertos compartidos
│       │   │   ├── infrastructure/   # DB, OAuth, correo, observabilidad
│       │   │   └── http/             # servidor, plugins, error handler
│       │   ├── nest/                 # módulo raíz y controladores Nest migrados
│       │   ├── config/
│       │   └── server.ts
│       ├── test/
│       │   ├── integration/
│       │   └── contract/
│       ├── Dockerfile
│       └── package.json
├── packages/
│   ├── contracts/                    # esquemas Zod y tipos HTTP compartidos
│   ├── database/                     # Prisma schema, client y migraciones
│   ├── ui/                           # tokens y componentes comunes opcionales
│   ├── eslint-config/
│   └── tsconfig/
├── database/
│   └── migrations/                   # SQL de referencia y bootstrap
├── infra/
│   ├── docker/
│   └── nginx/
├── docs/
├── compose.yaml
├── pnpm-workspace.yaml
└── package.json
```

El backend corre sobre NestJS con `@nestjs/platform-fastify`. Fastify se conserva
como adaptador HTTP para mantener compatibilidad con plugins y tests existentes,
mientras las rutas se migran gradualmente a controladores Nest. La estrategia
está documentada en [Migración del backend a NestJS](nestjs-migration.md).

Dentro de cada módulo del backend:

```text
appointments/
├── domain/            # entidades, value objects, reglas, interfaces repository
├── application/       # create/cancel/reschedule/list, DTO y puertos
├── infrastructure/    # repositorio Prisma y adaptadores externos
└── presentation/      # rutas Fastify, schemas y mappers HTTP
```

La dirección de dependencias es `presentation/infrastructure -> application ->
domain`. Prisma, Fastify y Google no entran al dominio.

## Componentes del frontend

- React Router para rutas y layouts de cliente/administración.
- TanStack Query para estado remoto y caché; no duplicar respuestas de la API en
  un store global.
- React Hook Form + Zod para formularios y contratos compartidos.
- Tailwind CSS con tokens semánticos, no colores literales en cada componente.
- Componentes accesibles headless para diálogos, menús y selección de fechas.
- Vitest + Testing Library; Playwright para los flujos críticos.

## API inicial

```text
GET    /v1/auth/google
GET    /v1/auth/google/callback
POST   /v1/auth/logout
GET    /v1/auth/me
GET    /v1/services
GET    /v1/availability?serviceIds=&from=&to=
GET    /v1/motorcycles
POST   /v1/motorcycles
GET    /v1/appointments
POST   /v1/appointments
PATCH  /v1/appointments/:id/cancel
GET    /v1/admin/appointments?from=&to=&statuses=
PATCH  /v1/admin/appointments/:id/status
PATCH  /v1/admin/appointments/:id/service-bay
GET    /v1/admin/service-bays
POST   /v1/admin/appointments/:id/motorcycle-updates
```

Los endpoints de administración requieren rol `admin`; la propiedad de motos y
citas se comprueba en cada caso de uso, nunca solo ocultando UI.
