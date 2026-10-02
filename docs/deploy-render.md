# Despliegue: Vercel + Render + Supabase + Cloudinary

## Arquitectura

```text
navegador ──► Vercel (frontend estático + rewrites)
                 ├── /v1/*     ──► Render (dracing-backend)
                 ├── /health/* ──► Render (dracing-backend)
                 └── /*        ──► index.html (SPA)
Render backend ──► Supabase PostgreSQL (Supavisor Session pooler)
Render backend ──► Cloudinary API (imágenes y archivos; configuración preparada)
```

El frontend llama a la API con rutas relativas y la sesión usa cookies
`SameSite=Lax`, así que el navegador no habla directamente con
`onrender.com`: todo pasa por los rewrites de Vercel
(`apps/frontend/vercel.json`). Esto mantiene la cookie en el dominio de Vercel
(first-party) y evita CORS.

`APP_ORIGIN` y `API_ORIGIN` apuntan al dominio estable de Vercel. La URL
`*.onrender.com` solo se usa dentro de `vercel.json`.

## Pasos

1. **Crear el proyecto de Supabase** y copiar desde Connect la cadena del
   **Session pooler** (IPv4, puerto `5432`). Agregar al final
   `?sslmode=require&uselibpqcompat=true`: sin `uselibpqcompat`, node-postgres
   moderno trata `require` como `verify-full` y rechaza la CA propia de
   Supabase con `SELF_SIGNED_CERT_IN_CHAIN`.
2. **Crear el entorno de Cloudinary** y obtener Cloud Name, API Key y API
   Secret desde Console Settings → API Keys.
3. **Crear el backend en Render** con el Blueprint (`render.yaml` en la raíz):
   New → Blueprint → seleccionar este repositorio. El Blueprint crea
   `dracing-backend` como servicio web Docker.
4. **Completar las variables `sync: false`** en Render, incluida
   `DATABASE_URL` con la URL de Supabase.
5. **Desplegar el Blueprint**. El contenedor aplica las migraciones antes de
   abrir el puerto y crea el administrador inicial si todavía no existe.
6. **Confirmar la URL de Render**. La URL asignada al servicio es
   `https://dracingpro.onrender.com`; si cambia, actualizar
   `apps/frontend/vercel.json` y redesplegar Vercel.
7. **Google OAuth**: agregar
   `https://d-racing-pro-frontend.vercel.app/v1/auth/google/callback` como URI
   autorizada en Google Cloud Console.
8. **Verificar** health checks, login de administrador, login de Google y una
   reserva completa.

## Variables del backend

| Variable                | Valor                                                                   | Origen    |
| ----------------------- | ----------------------------------------------------------------------- | --------- |
| `NODE_ENV`              | `production`                                                            | blueprint |
| `COOKIE_SECURE`         | `true`                                                                  | blueprint |
| `TZ`                    | `America/Santiago`                                                      | blueprint |
| `SESSION_SECRET`        | generada por Render                                                     | blueprint |
| `DATABASE_URL`          | Supabase Session pooler `:5432` + `sslmode=require&uselibpqcompat=true` | manual    |
| `APP_ORIGIN`            | `https://d-racing-pro-frontend.vercel.app`                              | blueprint |
| `API_ORIGIN`            | `https://d-racing-pro-frontend.vercel.app`                              | blueprint |
| `GOOGLE_CLIENT_ID`      | credencial de Google Cloud                                              | manual    |
| `GOOGLE_CLIENT_SECRET`  | credencial de Google Cloud                                              | manual    |
| `GOOGLE_REDIRECT_URI`   | `https://d-racing-pro-frontend.vercel.app/v1/auth/google/callback`      | blueprint |
| `ADMIN_EMAIL`           | correo del único administrador                                          | manual    |
| `ADMIN_PASSWORD`        | secreto de 12–128 caracteres                                            | manual    |
| `FLOW_API_BASE`         | `https://sandbox.flow.cl/api`                                           | blueprint |
| `FLOW_API_KEY`          | credencial Flow                                                         | manual    |
| `FLOW_SECRET_KEY`       | credencial Flow                                                         | manual    |
| `CLOUDINARY_CLOUD_NAME` | identificador del entorno Cloudinary                                    | manual    |
| `CLOUDINARY_API_KEY`    | API key del entorno Cloudinary                                          | manual    |
| `CLOUDINARY_API_SECRET` | secreto exclusivo del backend                                           | manual    |
| `CLOUDINARY_FOLDER`     | `dracing-pro`                                                           | blueprint |

Render inyecta `PORT`; el backend escucha en `0.0.0.0:$PORT`. En Vercel,
`VITE_API_URL` debe quedar vacía o sin definir para usar el proxy relativo.

## Migraciones y administrador inicial

Las migraciones SQL de `database/migrations/` se aplican con
`packages/database/scripts/migrate.mjs`. El `docker-entrypoint.sh` las ejecuta
antes del servidor y toma un advisory lock de PostgreSQL para impedir carreras
entre despliegues.

Por ese lock y por tratarse de un backend persistente, Render debe usar el
**Session pooler** de Supabase en puerto `5432`. No usar el Transaction pooler
en `6543`.

Después de migrar, el entrypoint crea el administrador cuando existen
`ADMIN_EMAIL` y `ADMIN_PASSWORD`. En arranques posteriores detecta la cuenta y
no reemplaza el hash ni crea una segunda.

Cloudinary queda como configuración preparada para medios: el backend valida
que sus tres credenciales existan juntas, pero todavía no hay ninguna
funcionalidad del producto que suba archivos (no hay SDK ni ruta de upload).
Las variables son opcionales hasta que esa funcionalidad exista. Supabase
almacena usuarios, sesiones, motos, citas, pagos y reportes.
`CLOUDINARY_API_SECRET` nunca se expone en variables `VITE_*`, código cliente
ni respuestas HTTP.

## Verificación post-deploy

Si el arranque falla con `tenant/user ... not found` (`XX000`), el pooler no
reconoce la combinación de host y usuario de `DATABASE_URL`. Copiar de nuevo
la cadena completa de **Supabase → Connect → Session pooler** y reemplazarla
en **Render → Environment → DATABASE_URL**. Conservar el host exacto (incluido
`aws-0`, `aws-1`, etc.), el usuario `postgres.<project-ref>` y el puerto `5432`;
no reconstruir el host a partir de la región. Reemplazar solo el marcador de
contraseña, codificando los caracteres especiales para una URL, y conservar
los parámetros SSL descritos arriba. Guardar y redesplegar el servicio existente.
Cambiar `.env` local no cambia las variables de Render.

Referencia: [Supabase: Tenant or user not found](https://supabase.com/docs/guides/troubleshooting/tenant-or-user-not-found).

```bash
curl https://dracingpro.onrender.com/health/live
curl https://dracingpro.onrender.com/health/ready
curl https://d-racing-pro-frontend.vercel.app/health/ready
```

Los tres deben responder `200` y `{"status":"ok"}`. Después se verifican los
dos métodos de login y una reserva con pago sandbox.

## Limitaciones

- El web service gratuito de Render se duerme después de 15 minutos sin
  tráfico; el primer request puede tardar cerca de un minuto.
- Los timers de reconciliación de Flow y expiración de holds no corren mientras
  Render está dormido. Al despertar, el backend ejecuta ambas tareas de
  mantenimiento inmediatamente y después retoma sus intervalos normales.
- No usar pings artificiales para impedir el spin-down: evadir las restricciones
  del plan gratuito puede provocar la suspensión de la cuenta según la
  [Acceptable Use Policy de Render](https://render.com/acceptable-use). Para
  latencia continua se necesita una instancia que no haga spin-down.
- Revisar los límites, pausado y backups del plan de Supabase elegido antes de
  tratarlo como producción definitiva.
- Detrás de Vercel y Render hay dos proxies. Fastify 5.12 descarta la confianza
  basada solo en un número de saltos; el adaptador aplica `false` a esos valores
  para impedir IPs falseadas. Para confiar en un proxy, usar una lista IP/CIDR
  verificada en `TRUSTED_PROXY`. Sin ella, el rate limit puede agrupar clientes
  bajo la IP del proxy.

## Marca Monopiston (octubre de 2026)

El repositorio se llama `FranciscoDastres/Monopiston` y el proyecto existente de
Vercel se llama `monopiston`. Se conserva el dominio público
`https://d-racing-pro-frontend.vercel.app`, sus rewrites a
`https://dracingpro.onrender.com` y el servicio existente de Render. Estos
identificadores están vinculados con Google OAuth, cookies y variables del
backend; cambiar únicamente el hostname rompe la autenticación.

El frontend y la API utilizan la marca Monopiston y los builds de Docker
usan `@monopiston/*`. No se renombra la base ni se crean servicios nuevos.

Para cambiar posteriormente el dominio público, actualizar juntos el dominio de
Vercel, `APP_ORIGIN`, `API_ORIGIN` y `GOOGLE_REDIRECT_URI` en Render, además del
callback autorizado en Google.
