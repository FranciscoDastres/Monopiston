# Migración del backend a NestJS

Esta guía explica la migración inicial del backend de Monopiston desde
Fastify directo hacia NestJS usando `@nestjs/platform-fastify`. El objetivo no es
reescribir todo de una vez, sino cambiar el runtime de forma verificable y luego
migrar cada módulo HTTP con bajo riesgo.

## Estado actual

El backend ahora arranca como una aplicación Nest:

- `apps/backend/src/app.ts` usa `NestFactory.create()` con
  `FastifyAdapter`.
- `apps/backend/src/nest/app.module.ts` define el módulo raíz de Nest.
- `apps/backend/src/nest/api.controller.ts` expone `GET /api`.
- `apps/backend/src/nest/health.controller.ts` expone
  `GET /health/live` y `GET /health/ready`.
- Las rutas de negocio existentes (`auth`, `appointments`, `payments`,
  `admin`, etc.) siguen registradas como plugins Fastify legacy sobre el mismo
  adaptador.

Esto deja el backend funcionando sobre NestJS sin cambiar todavía el contrato de
la API consumida por el frontend.

## Por qué se migró así

El backend tiene endpoints sensibles: sesiones con cookie firmada, login local
de administrador único, Google OIDC, pagos Flow, agenda y mutaciones admin con
validación de origen. Reescribir todos esos endpoints a controladores Nest en un
solo cambio aumentaría mucho el riesgo.

La estrategia usada es una migración por capas:

1. Nest toma el bootstrap y ciclo de vida de la API.
2. Fastify se conserva como adaptador HTTP para mantener compatibilidad con los
   plugins ya usados: `@fastify/cookie`, `@fastify/cors`,
   `@fastify/helmet` y `@fastify/rate-limit`.
3. Los endpoints simples pasan primero a controladores Nest.
4. Los módulos complejos se portan uno por uno cuando haya tests que cubran su
   comportamiento.

En entrevista puedes describirlo como una migración incremental tipo
`strangler pattern`: el sistema nuevo envuelve al anterior y va reemplazando
piezas gradualmente, manteniendo pruebas verdes.

## Mapeo mental: Fastify actual vs NestJS

Antes:

```ts
await app.register(authRoutes, { prefix: '/v1/auth', sessions });
```

La ruta era un plugin que recibía dependencias por objeto:

```ts
export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (
  app,
  options,
) => {
  app.get('/me', async (request, reply) => {
    const user = await options.sessions.authenticate(...);
    return reply.send(user);
  });
};
```

En Nest, esa misma responsabilidad termina separada así:

```ts
@Controller('v1/auth')
export class AuthController {
  constructor(private readonly sessions: SessionService) {}

  @Get('me')
  me() {
    return this.sessions.authenticate(...);
  }
}
```

La diferencia central es que Nest crea las clases por inyección de dependencias.
El controller no recibe `options`; Nest resuelve providers desde un módulo.

## Conceptos clave para aprender

### Module

Un módulo agrupa controllers y providers. En este repo,
`AppModule.register()` recibe `checkDatabase` y lo publica como provider:

```ts
{
  provide: HEALTH_CHECK_DATABASE,
  useValue: options.checkDatabase,
}
```

Eso permite inyectar una función sin depender de variables globales.

### Controller

Un controller traduce HTTP hacia aplicación. `HealthController` no sabe cómo se
consulta PostgreSQL; solo llama a `HealthService` y decide si la respuesta debe
salir con HTTP `503`.

### Provider

Un provider es una clase o valor que Nest puede inyectar. `HealthService` es un
provider. Más adelante, `SessionService`, `AppointmentService`,
`PaymentService`, repositorios Prisma y clientes externos deberían registrarse
como providers.

### Adapter

Nest puede correr sobre Express o Fastify. Aquí usamos Fastify porque el backend
ya dependía de plugins Fastify y porque los tests usan `inject()`. La app Nest
se crea con:

```ts
new FastifyAdapter({
  logger: resolveLoggerOptions(logger),
  trustProxy,
});
```

### Pipes, Guards, Filters e Interceptors

Todavía no se migraron todos, pero este será el destino natural:

- Validación Zod actual -> `Pipe` reutilizable.
- `requireUser()` -> `AuthGuard`.
- chequeo de rol `admin` -> `AdminGuard`.
- `hasTrustedOrigin()` -> guard de mutaciones.
- traducción de errores de dominio a HTTP -> `ExceptionFilter`.
- logging/telemetría común -> `Interceptor`.

## Cómo seguir migrando los módulos

Orden recomendado:

1. `services`: es lectura simple y tiene poco estado.
2. `motorcycles`: CRUD pequeño con autenticación.
3. `auth`: convertir `requireUser` en guard y cookie/session en providers.
4. `admin`: usar `AdminGuard` y filtros de errores.
5. `appointments`: migrarlo cuando existan tests robustos para disponibilidad,
   estados y reasignación.
6. `payments`: dejarlo para el final porque toca Flow, webhooks, retornos y
   efectos secundarios.

Cada módulo debería terminar con esta forma:

```text
modules/auth/
├── auth.module.ts
├── auth.controller.ts
├── auth.guard.ts
├── current-user.decorator.ts
├── application/
├── infrastructure/
└── domain/
```

La lógica de negocio no debería moverse al controller. Los controllers deben ser
delgados: leer HTTP, validar entrada, llamar servicios y devolver respuesta.

## Cómo explicarlo en entrevista

Una respuesta razonable:

> En un proyecto real migré un backend modular de Fastify directo a NestJS sin
> hacer una reescritura riesgosa. Primero cambié el runtime a Nest con
> `FastifyAdapter`, porque ya existían cookies, CORS, helmet, rate limit y tests
> basados en Fastify. Después migré endpoints simples como `/health` y `/api` a
> controllers Nest, manteniendo los módulos críticos como rutas legacy. La idea
> fue preservar contratos, correr tests y luego portar cada módulo a controllers,
> guards, pipes y filters.

Si te preguntan por Nest:

- `Module`: organiza controllers/providers y define el grafo de dependencias.
- `Controller`: recibe HTTP y delega.
- `Provider`: servicio inyectable con lógica de aplicación o infraestructura.
- `Guard`: decide si una request puede continuar.
- `Pipe`: valida o transforma inputs.
- `ExceptionFilter`: traduce errores a respuestas HTTP consistentes.
- `Adapter`: capa que permite que Nest use Fastify o Express por debajo.

Si te preguntan por la decisión técnica:

> No cambié Fastify por Express porque el proyecto ya tenía plugins Fastify
> probados y no había valor en cambiar dos cosas a la vez. Nest no obliga a usar
> Express; en este caso Nest aporta estructura, DI y patrones de aplicación, y
> Fastify sigue siendo el motor HTTP.

## Comandos de validación

```bash
pnpm --filter @monopiston/backend typecheck
pnpm --filter @monopiston/backend test
pnpm --filter @monopiston/backend build
```

Para validar el stack completo:

```bash
pnpm typecheck
pnpm test
pnpm build
```
