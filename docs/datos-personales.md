# Datos personales y derecho de supresión (Ley 21.719)

> Borrador técnico para apoyar la revisión legal. **No es asesoría legal.**
> Documenta qué datos personales guarda Monopiston y cómo opera la eliminación
> de cuenta, para cumplir con la Ley 21.719 (protección de datos personales,
> Chile) sin vulnerar las obligaciones de retención tributaria del SII.

## Inventario de datos personales

| Dato                                          | Tabla / campo                         | Trato en la supresión                                          |
| --------------------------------------------- | ------------------------------------- | -------------------------------------------------------------- |
| Correo                                        | `users.email`                         | Reemplazado por tombstone único `deleted-<id>@deleted.invalid` |
| Nombre                                        | `users.display_name`                  | Reemplazado por `Cuenta eliminada`                             |
| Avatar                                        | `users.avatar_url`                    | `null`                                                         |
| Teléfono                                      | `users.phone`                         | `null`                                                         |
| Hash de contraseña                            | `users.password_hash`                 | `null`                                                         |
| Identidad Google                              | `oauth_accounts` (`provider_subject`) | Fila eliminada (impide re-login)                               |
| WhatsApp                                      | `appointments.whatsapp_phone`         | `null`                                                         |
| Notas del cliente                             | `appointments.customer_notes`         | `null`                                                         |
| Apodo / patente / VIN / color / notas de moto | `motorcycles`                         | `null` (e `is_active = false`)                                 |
| IP / user-agent de sesión                     | `auth_sessions`                       | `null`, sesión revocada                                        |
| RUT emisor/receptor                           | `invoices`                            | **Se conserva** (retención tributaria)                         |
| IP en auditoría                               | `audit_logs.ip_address`               | Se conserva (interés legítimo de seguridad)                    |

## Por qué se conservan las boletas

El derecho de supresión cede ante la obligación legal de conservar
documentación tributaria. Por eso la eliminación **anonimiza** los datos
personales del cliente pero **no borra** la fila de `invoices`: el registro
financiero queda sin datos identificatorios del titular ligados a través del
usuario anonimizado, conservando el monto/folio que exige el SII.

## Mecánica de la eliminación

- **Endpoint:** `DELETE /v1/auth/me` (requiere sesión válida + origen confiable).
- **Restricción:** el administrador (operador del negocio) no puede autoeliminarse
  por esta vía (`admin_cannot_self_delete`); existe un único admin y la cuenta es
  la operación.
- **Atomicidad:** toda la anonimización ocurre en una sola transacción
  (`PrismaAuthRepository.anonymizeUserAccount`).
- **Sesiones:** se revocan todas y se limpia la cookie; el cliente queda
  desconectado de inmediato.
- **Auditoría:** se registra `user.account_anonymized` en `audit_logs`.
- **UI:** "Eliminar mi cuenta" en _Mi cuenta_, con modal de confirmación
  (acción irreversible).

## Pendiente (producto/legal, fuera del código)

- Texto operativo de **política de privacidad** y su publicación.
- **Consentimiento explícito** para contacto por WhatsApp.
- Definición formal de **períodos de retención** por tipo de dato.
- Procedimiento de **portabilidad** de datos a solicitud del titular.
