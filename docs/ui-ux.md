# UI/UX

## Tema plomo de Monopiston

Referencia visual: [Honda NAVI](https://motos.honda.cl/modelos/navi/).
La portada adapta la cabecera compacta, la franja roja de acciones, la imagen
principal y la navegación por secciones de la referencia. Los fondos blancos
se sustituyen por un gris plomo neutro; se mantiene texto claro para contraste.

| Token        | Valor     | Uso                                 |
| ------------ | --------- | ----------------------------------- |
| `background` | `#454545` | Fondo general, cabecera y secciones |
| `surface`    | `#505050` | Tarjetas, paneles y diálogos        |
| `lead-deep`  | `#353535` | Footer, menú y secciones alternadas |
| `lead-nav`   | `#3B3B3B` | Navegación por secciones            |
| `lead-hover` | `#5A5A5A` | Superficies interactivas            |
| `foreground` | `#F5F5F5` | Texto principal                     |
| `muted`      | `#D0D0D0` | Texto secundario                    |
| `primary`    | `#DF001B` | Franja y acciones principales       |
| `accent`     | `#FF959D` | Acentos legibles sobre plomo        |
| `warning`    | `#FDB022` | Atención y espera                   |
| `success`    | `#32D583` | Confirmado y completado             |

Los tokens están centralizados en `apps/frontend/src/styles/index.css`.
Los fondos plomo utilizan canales RGB iguales, sin dominante azul. El texto
claro se conserva; sustituirlo por plomo reduciría el contraste. En móvil, las
flechas del carrusel se sitúan sobre la imagen para no cubrir los títulos.

## Principios de interacción

- Agendamiento en cuatro pasos: moto, servicios, fecha/hora, confirmación.
- Resumen de precio/duración persistente; no esconder costes hasta el final.
- Mostrar fechas en la zona del taller y confirmar explícitamente el horario.
- Timeline de la moto con última actualización destacada y sello de hora.
- Panel admin orientado a agenda diaria, con filtros y acciones por estado.
- Mobile-first para clientes; desktop denso pero accesible para operación interna.
- Skeletons para carga, estados vacíos útiles y errores recuperables sin perder el
  formulario.
