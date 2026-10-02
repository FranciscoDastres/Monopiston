# Plan de lanzamiento comercial de Monopiston

Fecha: 1 de octubre de 2026.

## Resultado buscado

Abrir un canal de ventas operativo cuanto antes y completar después el circuito
de reserva y pago online. Meta inicial propuesta: cinco reservas reales
confirmadas durante la primera semana de difusión, registrando consultas,
reservas y servicios realizados. Es una meta de seguimiento, no una previsión.

La web ya está publicada en https://d-racing-pro-frontend.vercel.app con el tema
plomo. Según la última verificación documentada, la API de Render agotaba el
tiempo de espera; no está acreditado el funcionamiento de reservas ni pagos en
producción. Véase [estado técnico](status-2026-10-01.md).

## Orden de ejecución

Los plazos son estimaciones de trabajo desde que están disponibles los accesos
y datos necesarios. Dominio, contenido y recuperación de la API pueden avanzar
en paralelo. DNS, activación del comercio y respuesta de proveedores pueden
extender el calendario.

| Prioridad / plazo               | Trabajo                                                                                                                                                                                                                               | Condición para darlo por terminado                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0 · Primer día                 | Abrir ventas asistidas: oferta concreta, precios o condiciones de cotización, duración, ubicación y horarios; CTA principal a WhatsApp mientras la API no esté verificada. Confirmar manualmente cada cupo y cobrar en el taller.     | Un cliente desde su móvil puede consultar un servicio y recibir confirmación con fecha, precio y condiciones; la reserva queda registrada en una agenda única. |
| P0 · Primer día                 | Recuperar Render: revisar deployment y logs, arranque, variables, conexión PostgreSQL y migraciones; corregir la causa comprobada y desplegar `main`.                                                                                 | `/health/live`, `/health/ready` y catálogo responden directamente y a través de Vercel; una reserva persiste y aparece en administración.                      |
| P0 · Días 1–2                   | Comprobar disponibilidad y registrar `monopiston.cl` a nombre del titular del negocio; configurar dominio principal, `www`, HTTPS y buzón real.                                                                                       | Dominio resuelto, certificado válido, redirección a un único dominio y correo que recibe y envía.                                                              |
| P0 · Días 1–2                   | Completar contenido comercial: servicios, precios, teléfono, dirección, fotos pertinentes, identificación del negocio y condiciones de reserva/cancelación. Sustituir redes genéricas y verificar o retirar testimonios sin respaldo. | No quedan enlaces ni datos de ejemplo en el recorrido comercial; la oferta coincide con lo que el taller puede entregar.                                       |
| P0 · Días 2–3                   | Verificar Google, sesión, disponibilidad, reserva, cancelación y agenda administrativa en el dominio definitivo.                                                                                                                      | Recorrido completo móvil/escritorio y prueba de dos clientes intentando tomar el mismo cupo sin doble reserva.                                                 |
| P1 · Días 2–3, según activación | Verificar Flow en sandbox y después activar credenciales de producción y notificaciones de pago.                                                                                                                                      | Pago aprobado actualiza una sola vez la reserva; rechazo/cancelación no la marcan pagada; reintentos no duplican cobros ni registros.                          |
| P1 · Primera semana             | Activar seguimiento de caídas y errores, comprobar backup y restauración, documentar rollback y responsables de atención.                                                                                                             | Alerta comprobada, restauración ensayada fuera de producción y procedimiento de recuperación utilizable.                                                       |
| P1 · Primera semana             | Publicar la oferta en redes reales y perfil comercial de Google, compartir el enlace con clientes existentes y medir resultados.                                                                                                      | Registro de origen de consultas, reservas confirmadas y servicios completados; revisión al séptimo día.                                                        |

La primera apertura comercial puede funcionar con agenda asistida y pago en el
taller. La reserva automática se habilita al superar sus pruebas. El pago online
se habilita al superar las suyas; su activación no debe bloquear las ventas asistidas.

## Dominio y configuración

- Nombre preferido: `monopiston.cl`. Su disponibilidad **no está verificada**.
  Registrar el dominio requiere cuenta del titular y pago del registro.
- Mantener el dominio y cuentas de proveedores bajo control del negocio, con
  recuperación de acceso y recordatorio de renovación.
- Conectar dominio y `www` al proyecto existente de Vercel usando los registros
  DNS que indique el proveedor. Elegir `https://monopiston.cl` como URL principal.
  [Guía oficial de Vercel](https://vercel.com/docs/domains/working-with-domains/add-a-domain).
- Actualizar conjuntamente los orígenes de backend, cookies, callback autorizado
  de Google y URLs de retorno/notificación de Flow. Probar antes de redirigir
  el dominio anterior. Mantener el proxy existente hacia la API para evitar
  introducir otra infraestructura durante el lanzamiento.
- Crear `contacto@monopiston.cl` como buzón real y configurar autenticación del
  correo con los registros que entregue su proveedor.

## Infraestructura y presupuesto

Mantener React/Vercel, NestJS/Render y PostgreSQL/Supabase para este lanzamiento.
La prioridad es recuperar y verificar el sistema existente.

| Concepto               | Presupuesto / decisión                                                                                                                                                                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dominio `.cl`          | CLP $9.990 por un año, exento de IVA, según [NIC Chile](https://www.nic.cl/dominios/tarifas.html).                                                                                                                                                                                                |
| Frontend               | Revisar plan actual. Si es Hobby, pasar a un plan apto para uso comercial: Hobby se limita a uso personal no comercial. Pro parte de US$20/mes, con cargos adicionales según uso e impuestos. [Restricción de Hobby](https://vercel.com/docs/plans/hobby), [tarifas](https://vercel.com/pricing). |
| API                    | Presupuestar instancia de pago y confirmar su tarifa al contratar. Render gratuito se suspende tras 15 minutos sin tráfico; pagar evita esa suspensión, pero no corrige por sí solo el fallo actual. [Documentación de Render](https://render.com/docs/free).                                     |
| Base de datos y correo | Revisar plan, almacenamiento y recuperación de Supabase; cotizar buzón. Importe pendiente de verificar en las cuentas.                                                                                                                                                                            |
| Pagos                  | Considerar comisión y condiciones del contrato Flow. Su sandbox y producción usan entornos distintos. [Documentación de Flow](https://developers.flow.cl/docs/intro).                                                                                                                             |

El presupuesto total queda pendiente de verificar los planes actuales y las
tarifas de API, correo, base y pagos. Ninguna contratación o compra forma parte
de este documento.

## Dependencias y salida a producción

Acceso al servicio Render y sus logs es la dependencia técnica inmediata:
no había credenciales ni deploy hook disponibles en la revisión anterior.
Registro del dominio y buzón requieren la cuenta del titular; Flow requiere
cuenta comercial activa y credenciales de producción. Los datos del negocio,
precios y capacidad diaria deben reflejar la operación real.

Antes de difusión amplia: confirmar el canal de atención, oferta y agenda;
validar HTTPS y recorrido móvil; completar condiciones de servicio y proceso
real de emisión de documentos tributarios. Los reportes internos del sistema
no acreditan por sí solos una integración fiscal.

Cada cambio de código se entrega por PR, con checks, merge, deployment y
verificación del commit publicado. Conservar rollback al último deployment
verificado. No publicar cambios de base destructivos como parte del lanzamiento.

Después de la primera semana, ajustar la oferta con las consultas recibidas.
Medir tiempos de respuesta, errores y capacidad antes de ampliar infraestructura.
Antes de varias réplicas de API, resolver la ejecución única de los timers de
pagos y expiración descritos en el estado técnico.
