# Prompt de continuidad para Claude: despliegue en Render

Copia y pega desde `INICIO DEL PROMPT` hasta `FIN DEL PROMPT` en Claude Code.
No agregues credenciales reales dentro de este archivo ni en ningún commit.

---

## INICIO DEL PROMPT

Quiero que continúes hasta dejar operativo en Render el backend de Monopiston,
con PostgreSQL de Supabase y la configuración de Cloudinary. Tienes autorización
para inspeccionar el repositorio, modificar los archivos necesarios, ejecutar
pruebas, crear commits y hacer push. No me vuelvas a preguntar en qué carpeta
trabajar: el repositorio local es:

`/home/dnthdev/proyectos/DRacingPro`

Reglas obligatorias de trabajo:

1. Conserva cualquier cambio existente y no uses `git reset --hard`,
   `git checkout --` ni comandos destructivos.
2. Si debes modificar archivos, crea exactamente **un commit por archivo**. No
   agrupes dos archivos en el mismo commit. Usa mensajes Conventional Commits
   que expliquen ese archivo y haz un solo push al terminar.
3. Nunca publiques secretos, nunca los escribas en `.env`, documentación,
   código, logs de respuesta, commits ni mensajes de PR. Los secretos se cargan
   directamente en Render, Supabase, Cloudinary o Google Cloud.
4. Diagnostica siempre el primer error real del build o del arranque y valida
   después de corregirlo. No hagas redeploys repetidos sin cambiar la causa.
5. No crees otro servicio si `dracing-backend` ya existe en Render. Primero
   inspecciona y corrige el servicio existente.

### Estado que ya está preparado

- Repositorio remoto: `https://github.com/FranciscoDastres/Monopiston.git`.
- Rama de entrega: `fix/node-24-render-readiness`, basada en `origin/main`.
- Render despliega desde `main`, por lo que primero debes comprobar si esa rama
  ya fue fusionada. Si no lo fue, revisa sus commits, abre/fusiona el PR si los
  permisos y las protecciones lo permiten, y confirma que el commit fusionado
  sea el que Render está construyendo.
- El monorepo usa pnpm, TypeScript, NestJS con Fastify, Prisma y PostgreSQL.
- El backend se despliega como Docker usando el Blueprint `render.yaml`, el
  contexto raíz y `apps/backend/Dockerfile`.
- Node quedó fijado en `24.18.0`: `.nvmrc`, `engines`, CI y las dos etapas del
  Dockerfile del backend usan Node 24.18.0. React ya estaba en la versión estable
  moderna 19.2.7 y no necesitó actualización.
- Ya pasaron localmente lint, typecheck, 111 tests, build completo y builds
  Docker del backend y frontend. La imagen local del backend reportó
  `v24.18.0`.
- El contenedor ejecuta `apps/backend/docker-entrypoint.sh`: primero aplica las
  migraciones SQL con `packages/database/scripts/migrate.mjs`, luego crea el
  administrador inicial de forma idempotente y finalmente inicia la API.
- La API escucha en `0.0.0.0:$PORT`, Render inyecta `PORT` y el health check del
  Blueprint es `/health/ready`.
- El backend ejecuta una reconciliación inmediata de pagos y expiración de
  reservas después de cada cold start. No agregues pings artificiales para
  impedir el reposo del plan gratuito.

### Error exacto que falta resolver

El build anterior terminó correctamente, pero el contenedor salió con estado 1
al intentar conectarse a PostgreSQL:

```text
AggregateError [ECONNREFUSED]
connect ECONNREFUSED ::1:5432
connect ECONNREFUSED 127.0.0.1:5432
```

Eso demuestra que el `DATABASE_URL` actual de Render apunta a localhost. No hay
PostgreSQL dentro del contenedor. Reemplaza esa variable en Render por la cadena
que entrega Supabase en **Connect > Session pooler**, con IPv4, puerto `5432` y
`sslmode=require`. No uses el Transaction pooler de puerto `6543`, porque el
runner de migraciones mantiene un advisory lock durante la sesión.

La forma esperada es equivalente a esta, pero debes copiar los valores reales
desde Supabase y respetar exactamente el host y usuario que muestre el panel:

```text
postgresql://postgres.<PROJECT_REF>:<PASSWORD_URL_ENCODED>@<SESSION_POOLER_HOST>:5432/postgres?sslmode=require
```

Si la contraseña contiene caracteres reservados (`@`, `:`, `/`, `?`, `#`, `%`),
debe estar codificada para URL. No muestres la cadena completa al responder;
confirma solamente host, puerto, modo pooler y presencia de SSL, ocultando
usuario y contraseña.

### Configuración correcta del servicio en Render

Usa preferentemente el Blueprint de la raíz. Debe quedar así:

- Servicio existente: `dracing-backend`.
- Tipo: Web Service.
- Runtime: Docker.
- Plan: Free.
- Rama desplegada: `main` después de fusionar la rama de entrega.
- Root Directory: vacío, porque el contexto es la raíz del monorepo.
- Dockerfile: `./apps/backend/Dockerfile`.
- Docker Context: `.`.
- Health Check Path: `/health/ready`.
- No escribas Build Command ni Start Command manuales para este runtime; el
  Dockerfile y su `CMD` controlan el proceso.

El `render.yaml` ya define las variables no secretas. Verifica en el Dashboard
que estén sincronizadas y completa manualmente todas las marcadas `sync: false`:

```text
NODE_ENV=production
COOKIE_SECURE=true
TZ=America/Santiago
SESSION_SECRET=<valor fuerte generado por Render, mínimo 32 caracteres>
DATABASE_URL=<Supabase Session pooler 5432 con sslmode=require>
APP_ORIGIN=https://d-racing-pro-frontend.vercel.app
API_ORIGIN=https://d-racing-pro-frontend.vercel.app
GOOGLE_CLIENT_ID=<secreto de Google>
GOOGLE_CLIENT_SECRET=<secreto de Google>
GOOGLE_REDIRECT_URI=https://d-racing-pro-frontend.vercel.app/v1/auth/google/callback
ADMIN_DISPLAY_NAME=Administrador Monopiston
ADMIN_EMAIL=<correo del administrador>
ADMIN_PASSWORD=<secreto entre 12 y 128 caracteres>
FLOW_API_BASE=https://sandbox.flow.cl/api
FLOW_API_KEY=<secreto de Flow>
FLOW_SECRET_KEY=<secreto de Flow>
CLOUDINARY_CLOUD_NAME=<Cloud name>
CLOUDINARY_API_KEY=<API key>
CLOUDINARY_API_SECRET=<API secret>
CLOUDINARY_FOLDER=dracing-pro
```

Las tres variables principales de Cloudinary deben existir juntas o el backend
rechazará la configuración. El secret jamás debe convertirse en una variable
`VITE_*` ni llegar al navegador.

Importante: en el estado actual del código, Cloudinary tiene validación de
variables y preparación de despliegue, pero no encontré un cliente SDK, una
ruta de upload ni una prueba de subida real. No declares "Cloudinary operativo"
solo porque las variables existen. Determina si el producto necesita subir
archivos ahora. Si sí, implementa la integración mínima completa y segura
(backend firmado, autorización, límites de tipo/tamaño, persistencia de URL y
pruebas), respetando un commit por archivo. Si no hay ninguna funcionalidad del
producto que suba archivos todavía, déjalo documentado como configuración
preparada y no inventes una ruta innecesaria.

### Secuencia de ejecución

1. Ejecuta `git status --short --branch`, revisa los commits de la rama contra
   `origin/main` y verifica el remoto antes de tocar nada.
2. Confirma que cada commit nuevo de la rama contiene un solo archivo.
3. Fusiona la entrega a `main` mediante el flujo permitido por GitHub y confirma
   el SHA remoto que Render debe construir.
4. Inspecciona el servicio de Render existente. Si tienes Render MCP, úsalo para
   consultar servicio, despliegues y logs; si no, trabaja con el Dashboard y los
   logs que te entregue el usuario. No crees recursos duplicados.
5. Corrige `DATABASE_URL` directamente en Render y comprueba el resto de las
   variables sin exponer sus valores.
6. Lanza un único deploy del commit correcto y sigue los logs. Deben verse las
   migraciones aplicadas u omitidas idempotentemente, el bootstrap del admin y
   el servidor escuchando sin excepciones.
7. Si falla, clasifica si es build, startup o health; corrige el primer fallo y
   recién entonces redespliega.
8. Verifica que el deploy quede `live` y que estas llamadas devuelvan HTTP 200 y
   `{"status":"ok"}`:

   ```bash
   curl -fsS https://dracing-backend.onrender.com/health/live
   curl -fsS https://dracing-backend.onrender.com/health/ready
   ```

   Si Render asignó otro hostname, usa el real y luego actualiza solamente las
   referencias que dependan de él.

9. Comprueba una consulta que realmente dependa de Supabase, el login del único
   administrador, Google OAuth si sus credenciales ya están disponibles y el
   flujo de reserva/pago sandbox. No hagas pagos reales.
10. Informa al final: URL pública, SHA desplegado, estado de health, resultado de
    migraciones, conexión a Supabase, estado real de Cloudinary, pruebas
    ejecutadas, commits/push realizados y cualquier credencial externa que aún
    deba cargar el usuario. Oculta todos los secretos.

No te detengas en explicaciones generales: inspecciona, ejecuta, verifica y deja
un reporte basado en evidencia real del repositorio y de Render.

## FIN DEL PROMPT
