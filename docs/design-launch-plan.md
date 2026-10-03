# Diseño para el lanzamiento de Taller Mono Pistón

Revisión: 2 de octubre de 2026. Alcance: diseño, contenido comercial y experiencia
de cliente. Por solicitud del usuario, se excluyen métodos de pago y dominio.
Esta revisión no acredita que el backend o las reservas funcionen en producción.

## Carrusel integrado

El hero utiliza las tres imágenes existentes del proyecto. El componente de
referencia se adaptó a la identidad del taller: arrastre horizontal, miniaturas
que se expanden al seleccionarlas, borde rojo, controles de reproducción y
navegación, teclado y bucle continuo. No incorpora fotografías externas ni una
ruta de demostración. Se conserva el botón «Agendar una cita» y el contenido de
la portada. Las funciones de interacción de Motion se descargan en un módulo
separado y se respeta el movimiento reducido.

La pausa con foco, la navegación y las descripciones de las fotos siguen el
[patrón de carrusel de W3C](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/).
El arrastre utiliza las funciones de
[Motion](https://motion.dev/docs/react-drag).

## Dirección visual

Mantener una identidad de taller especializado, centrada en las NAVI y en el
emblema suministrado. La animación principal es el carrusel; las demás secciones
pueden mantenerse estables. Evitar efectos adicionales que retrasen la reserva.

| Elemento             | Decisión                                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Fondo y paneles      | `#242424` y `#303030`, como en el frontend actual.                                                                |
| Acciones y selección | Rojo `#df001b`; fotografías con sus colores originales.                                                           |
| Texto                | `#f5f5f5` para contenido principal y `#d0d0d0` para apoyo.                                                        |
| Tipografía           | Montserrat para títulos; Inter para texto. Ambas ya se sirven localmente.                                         |
| Composición          | Texto alineado a la izquierda, fotografía amplia y miniaturas discretas.                                          |
| Móvil                | Reserva visible, controles separados y gestos horizontales que permitan seguir desplazando la página en vertical. |

Las tarjetas de servicios deben parecer una pauta concreta del taller: nombre,
qué incluye, duración, importe y acción. Una tira compacta de próxima visita en
la cuenta puede usar la misma jerarquía. No se propone cambiar toda la marca ni
agregar una biblioteca visual adicional.

## Lo que falta antes de promocionar la web

Estas observaciones provienen del código actual de la portada y del formulario
de reserva; las soluciones son propuestas, salvo el carrusel ya integrado.

| Prioridad | Hallazgo                                                                                                                         | Cambio concreto                                                                                                                                                | Criterio de término                                                                                             |
| --------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Alta      | «Servicios para tu NAVI» anuncia precio y duración, pero las tres tarjetas solo tienen nombre y descripción.                     | Mostrar el catálogo real ya disponible en `/v1/services`, con inclusiones, duración e importe en CLP; permitir comenzar la reserva desde el servicio elegido.  | El cliente entiende la oferta antes de iniciar sesión. Los valores coinciden con la agenda y la administración. |
| Alta      | El estado de error del catálogo o la disponibilidad no tiene una salida clara en el formulario autenticado.                      | Mensaje específico, botón para reintentar y contacto con el taller. Diferenciar «sin cupos» de «no pudimos consultar».                                         | Una API lenta o indisponible no deja una pantalla vacía ni inventa horarios.                                    |
| Alta      | La dirección aparece en «El taller», pero no hay una acción «Cómo llegar»; los horarios quedan alejados en móvil.                | Agrupar dirección, horario y botones de mapa, llamada y WhatsApp en un bloque de visita.                                                                       | Desde 320 px se puede consultar el horario y abrir indicaciones con una acción.                                 |
| Alta      | No hay preguntas frecuentes junto a la oferta.                                                                                   | Acordeón breve sobre modelo atendido, acceso a la reserva, información necesaria para la visita y coordinación de cambios. Enlazar las condiciones existentes. | Las respuestas reflejan las reglas reales del taller y se navegan con teclado.                                  |
| Alta      | El frontend usa un correo de contacto marcado como provisional en la configuración.                                              | Verificar con el taller los datos comerciales publicados y el canal efectivo de consultas.                                                                     | Todos los enlaces de contacto usados por clientes llevan a canales atendidos.                                   |
| Media     | Hay información sobre seguimiento e historial, pero la portada no permite reconocer la experiencia de la cuenta antes de entrar. | Mostrar una explicación breve de los pasos «reservar, seguir el servicio, revisar el informe», usando capturas propias cuando el flujo esté validado.          | No se prometen avisos automáticos o funciones que todavía no estén operativas.                                  |
| Media     | Se retiraron testimonios de demostración y todavía no hay prueba social verificable.                                             | Incorporar reseñas reales con enlace a su fuente y trabajos propios autorizados. Mantener la sección oculta hasta contar con contenido.                        | Cada opinión tiene respaldo; no se inventan estrellas, clientes ni cifras.                                      |

La investigación de [NN/g sobre páginas de oferta](https://www.nngroup.com/articles/ecommerce-product-pages/)
respalda presentar información completa y comprensible sobre lo que se contrata.
Aplicar esa recomendación a las mantenciones es una adaptación al negocio del
taller, no un resultado medido todavía en Monopiston.

La [guía de W3C sobre mensajes de formularios](https://www.w3.org/WAI/tutorials/forms/notifications/)
recomienda explicar resultados y errores con instrucciones claras.
[Google Business Profile](https://support.google.com/business/answer/3474050?hl=en)
permite enlazar reseñas y compartir una solicitud de valoración. No exige
instalar un widget externo ni descargar todos sus recursos en la portada.

## Funciones nuevas con utilidad para el taller

| Orden | Función propuesta                          | Qué aporta                                                  | Dependencia antes de construir                                                                           |
| ----- | ------------------------------------------ | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1     | Selección de servicio desde la portada     | Evita elegir de nuevo al abrir la agenda.                   | Catálogo real y estado compartido del servicio elegido; conservar el contexto al iniciar sesión.         |
| 2     | «Añadir mi cita al calendario»             | Lleva la próxima visita al calendario del cliente.          | Generar un archivo ICS con fecha y zona horaria correctas, únicamente para una cita confirmada.          |
| 3     | Resumen de próxima visita con indicaciones | Reúne horario, servicio, ubicación y contacto en la cuenta. | Usar la cita persistida; reflejar una cancelación o cambio de horario.                                   |
| 4     | Recordatorio de próxima mantención         | Ayuda a volver al taller según fecha o kilometraje.         | Reglas acordadas con el taller y datos completos; empezar con una recomendación visible en la cuenta.    |
| 5     | Lista de espera para horarios              | Permite registrar interés cuando no hay cupos.              | Disponibilidad fiable y proceso de atención definido. No confirmar una reserva solo por inscribirse.     |
| 6     | Reseña después de un servicio completado   | Facilita recoger opiniones reales.                          | Perfil comercial real y cierre de atención validado; primero un enlace, sin envío automático a clientes. |

El seguimiento y el historial ya existen en el producto; no deben presentarse
como funciones nuevas. Los recordatorios y la lista de espera no están
implementados por esta integración. Antes de automatizar comunicaciones o
cambios de estado, verificar el flujo operativo y su consistencia.

## Orden recomendado de la siguiente entrega

1. Catálogo comercial real, con carga y error visibles.
2. Bloque de visita y preguntas frecuentes.
3. Resumen de próxima cita y exportación al calendario.
4. Reseñas verificadas y nuevas funciones según su uso real.

El diseño puede avanzar con ese orden. Abrir ventas también requiere comprobar
una reserva real y su reflejo en administración, además de resolver cualquier
credencial publicada. Ese trabajo operativo queda separado de esta revisión
visual; no se da por terminado por haber cambiado el carrusel.
