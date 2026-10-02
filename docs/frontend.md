# Frontend de Taller Mono Pistón

La identidad visible es **Taller Mono Pistón**, con espacios y tilde. El emblema
entregado por el taller se usa en la cabecera, el pie, las páginas legales y la
intranet. La sección «El taller» lo muestra a mayor tamaño.

## Estructura de la marca

```text
apps/frontend/
├── public/
│   ├── brand/
│   │   ├── favicon.png
│   │   └── apple-touch-icon.png
│   ├── fonts/
│   └── images/
└── src/
    ├── assets/
    │   ├── brand/
    │   │   ├── taller-mono-piston-original.jpg
    │   │   └── taller-mono-piston.webp
    │   └── hero/ (originales de las fotos adicionales)
    ├── components/
    │   ├── brand/BrandLogo.tsx
    │   └── ui/
    ├── config/
    │   ├── brand.ts
    │   └── contact.ts
    ├── features/
    ├── pages/LandingPage.tsx
    └── styles/index.css
```

`config/brand.ts` centraliza el nombre, la ubicación y la imagen. `BrandLogo`
controla los tamaños de presentación; las páginas no dibujan logos alternativos.
El archivo original se conserva sin modificar, fuera de `public`, y no se importa
al sitio. Vite publica únicamente el WebP utilizado, con un nombre que incorpora
su hash para la caché. Los íconos de navegador quedan en `public/brand` porque
`index.html` los referencia directamente.

Se usó la herramienta integrada `imagegen` para generar la versión transparente;
se retiró el fondo exterior y se conservó el blanco interior del emblema. El WebP
se redujo a 512 píxeles de ancho con calidad 82 y canal alfa; pesa aproximadamente
63 KiB. Los PNG del favicon conservan la proporción del diseño.

Instrucción de edición utilizada: «Quitar únicamente el fondo blanco exterior del
logo suministrado, entregar transparencia real y conservar el emblema, sus
colores, ilustración y textos TALLER MONO PISTÓN, CHILE 2026 y SANTIAGO CENTRO.
No agregar elementos ni recortar el diseño».

## Orden del sitio

La portada presenta servicios, herramientas para el cliente y datos del taller.
La cabecera deja visible la marca y las dos acciones principales: agendar y acceder
a la cuenta. Los datos secundarios aparecen según el espacio disponible. Los
enlaces internos consideran la altura de las barras fijas.

El menú usa un diálogo nativo que administra el foco y se cierra con Escape.
El acceso reutiliza el diálogo compartido. Se retiraron los perfiles sociales
provisionales que apuntaban a las páginas generales de Facebook e Instagram y
los testimonios de demostración.

`features/landing/HeroCarousel.tsx` administra las tres fotografías reales de
`public/images/`: `navi-service-hero.webp`, `navi-service-hero-2.webp` y
`navi-service-hero-3.webp`. Cambia cada seis segundos y vuelve a la primera;
la transición modifica únicamente la opacidad. No hay filtros de color ni
variantes de tema. Los controles mantienen el rojo de la marca.

Se puede pausar, reanudar, avanzar, retroceder o seleccionar una foto. La rotación
se suspende al pasar el puntero, salir de la portada o cambiar de pestaña;
el foco de teclado detiene la reproducción hasta una reanudación explícita.
Con movimiento reducido, comienza pausada. Los timers y listeners se limpian al
salir de la página. El componente utiliza React y CSS sin dependencias nuevas.

Las fotos adicionales se publican como WebP sin metadatos; la segunda se reduce a
1600 × 900 y la tercera conserva 1920 × 1080. Los originales se guardan en
`src/assets/hero/`, sin imports ni descarga al navegador. La primera imagen tiene
prioridad alta y las otras prioridad baja.

Las tres imágenes de publicación pesan 459.928 bytes en conjunto, frente a los
820.791 bytes de los archivos recibidos: una reducción del 44 %.

La cuenta conserva sus controles de perfil y eliminación; ahora tiene una ruta
accesible en `/app/account`, enlazada desde la cabecera de la intranet.

## Limpieza y carga

- Se retiraron las pantallas desconectadas de motos y notificaciones, los gráficos
  antiguos sin uso, el archivo de reexportaciones de UI y el puente de íconos.
- Se retiraron `StatCard` y `Select`, que no tenían consumidores, y las
  exportaciones internas innecesarias.
- Se eliminó la implementación anterior de salud en Fastify. Los endpoints
  `/health/live` y `/health/ready` siguen servidos por NestJS y verificados por sus
  pruebas.
- Se retiraron `@hookform/resolvers`, `react-hook-form` y `recharts`, y se actualizó
  `pnpm-lock.yaml`. Los dos gráficos activos siguen disponibles como SVG,
  incluyendo importes diarios consultables y todos los estados de las citas.
- Agenda y acceso se descargan cuando se abren. Las rutas de intranet y legales
  conservan su separación en módulos. El acceso de desarrollo se limita a
  desarrollo; en producción, una reserva sin sesión ofrece Google.
- La portada ya no consulta `/health/live` para mostrar un indicador técnico.
  La imagen principal se prioriza dentro de la portada y no se precarga desde
  páginas que no la muestran.

Las migraciones, las funciones de citas y pagos y las dependencias utilizadas
por el backend se conservan. `@prisma/client` es necesario para el código
generado; `rxjs` es necesario para NestJS. Los nombres técnicos de paquetes,
credenciales locales y recursos desplegados conservan sus identificadores para
mantener la compatibilidad con los entornos existentes.

## Tamaño de la compilación

Comparación local de las compilaciones antes y después de la limpieza:

| Medida                                   |         Antes |       Después | Reducción |
| ---------------------------------------- | ------------: | ------------: | --------: |
| JavaScript total de producción           | 967.617 bytes | 600.001 bytes |    38,0 % |
| JS y CSS iniciales, comprimidos con gzip | 133.636 bytes | 128.526 bytes |     3,8 % |
| Módulos procesados                       |           755 |           184 |    75,6 % |

El total incluye las rutas que se descargan a demanda. Los gráficos ya estaban
separados antes; por eso su sustitución reduce principalmente la descarga de la
intranet. Las cifras de gzip inicial excluyen las imágenes y las fuentes.

## Comprobaciones

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:unused
pnpm check:unused --production
```

`check:unused` ejecuta Knip 6.39.0 de manera puntual, sin agregarlo a las
dependencias del producto. `knip.js` identifica los puntos de entrada reales del
monorepo. Las únicas excepciones son el ejecutable global `ngrok`, el runtime
importado por Prisma generado y la exportación de la firma Flow que se prueba de
forma directa. En producción se excluye también la preparación del entorno de
pruebas. No se eliminan archivos basándose únicamente en el resultado del
analizador.

Se verificaron la portada y la cuenta en 320, 390, 768 y 1440 píxeles; además,
navegación con Escape, diálogos, reserva autenticada y acceso Google sin sesión,
páginas legales y los gráficos administrativos. La revisión de navegador utiliza
respuestas de API simuladas, sin crear citas ni pagos reales.

El carrusel tiene seis pruebas que cubren el ciclo completo, navegación manual,
pausa, foco de teclado, movimiento reducido, pestaña oculta, visibilidad y
limpieza al desmontar. La suite completa suma 122 pruebas.
