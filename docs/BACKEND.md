# Backend de respuestas

Implementación en preparación. El formulario web continúa en demostración y no acepta respuestas reales hasta conectar y verificar todos los servicios.

## Recorrido

1. `POST /api/rsvp` comprueba el origen, los identificadores, la asistencia, el máximo de 12 comensales y que cada segundo esté en `content/event.json`.
2. La respuesta vigente se escribe primero en Vercel Blob **privado** como `responses/<responseId>.json`.
3. Solo después se envía una copia firmada a Apps Script. El puente actualiza una fila familiar y sustituye las filas de sus comensales; una repetición del mismo envío no crea duplicados.
4. Si Google Sheets no responde, el registro conserva `sheets.status = pending`. `POST /api/admin/retry-sheets` recorre los pendientes, con un máximo de 20 intentos por llamada.

La respuesta HTTP `202` significa que la respuesta ya está guardada de forma duradera. `sheetsSynced` indica si también llegó a la hoja; el frontend no debe presentar una avería de Sheets como pérdida de la respuesta.

## Variables privadas

Configurar en el proyecto Vercel, nunca en `content/event.json`, HTML o JavaScript público:

| Variable | Uso |
| --- | --- |
| `PUBLIC_SITE_ORIGIN` | Origen exacto permitido, por ejemplo `https://bautizo-simon-julian.vercel.app` |
| `RSVP_WEBHOOK_SECRET` | Clave aleatoria de al menos 32 caracteres. El mismo valor va en Script Properties de Apps Script. |
| `SHEETS_WEBHOOK_URL` | URL `/exec` de la implementación de Apps Script. |
| `SYNC_ADMIN_TOKEN` | Token aleatorio de al menos 32 caracteres para reintentar pendientes. |
| `BLOB_STORE_ID` o `RSVP_WEBHOOK_SECRET_STORE_ID` | Identificador que Vercel añade al conectar el almacén. En el almacén actual se eligió el prefijo `RSVP_WEBHOOK_SECRET`, por lo que generó la segunda variable. |
| Token Blob | El almacén actual usa OIDC, que Vercel entrega automáticamente a Functions; no requiere guardar un token de larga duración. Para ejecutar localmente puede usarse `BLOB_READ_WRITE_TOKEN`. |

Genera `RSVP_WEBHOOK_SECRET` y `SYNC_ADMIN_TOKEN` localmente con un generador criptográfico. No los pongas en este repositorio ni los compartas en el chat. Si se pierde la clave compartida, cambia el valor en las dos plataformas a la vez.

## Configurar Google Sheets y Apps Script

1. Importa la plantilla preparada como una hoja nativa privada. Las pestañas y cabeceras se corresponden con `apps-script/Code.gs`.
2. En `script.google.com`, crea un proyecto vinculado a esa hoja o un proyecto independiente y pega `apps-script/Code.gs`.
3. En **Configuración del proyecto → Propiedades del script**, define `RSVP_SPREADSHEET_ID` con el ID de la hoja y `RSVP_WEBHOOK_SECRET` con la misma clave aleatoria que Vercel.
4. Ejecuta `initializeSheets()` como propietario y autoriza el acceso a la hoja.
5. Despliega como aplicación web, ejecutándose como propietario y accesible para cualquiera. Las invitaciones no necesitan iniciar sesión: el receptor exige una firma HMAC válida y rechaza firmas alteradas o con más de cinco minutos.
6. Copia la URL `/exec` en `SHEETS_WEBHOOK_URL` de Vercel.

La hoja contiene nombres y observaciones sobre alergias/intolerancias; mantenla privada y limita sus editores. Las celdas de texto se protegen frente a fórmulas aportadas por usuarios. El emparejamiento de paellas se deja para el cierre de reserva en la columna manual; no se solicita en la invitación.

## Prueba sintética

El contrato de `POST /api/rsvp` es:

```json
{
  "responseId": "a9a8d95a-4d65-4c72-80b1-47dddb2f6512",
  "submissionId": "21bcc58d-81c2-4434-930f-b075e68ed54c",
  "contactName": "Familia de prueba",
  "attending": true,
  "guests": [
    {
      "guestId": "5332a4b4-2435-4806-8a7f-30c7fbb8b952",
      "name": "Comensal de prueba",
      "mainCourseId": "paella-mixta",
      "dietaryNotes": ""
    }
  ],
  "message": ""
}
```

Los tres identificadores son UUID v4. `submissionId` se mantiene igual al reintentar un envío cuya respuesta se haya perdido. La API no confía en la etiqueta del menú enviada por el navegador: la resuelve desde la configuración del evento. `attending: false` requiere una lista `guests` vacía.

El endpoint de recuperación usa `POST /api/admin/retry-sheets` con `Authorization: Bearer <SYNC_ADMIN_TOKEN>`. No devuelve datos personales, únicamente cuántos registros intentó sincronizar.

## Estado de activación

- API, validación, firmas, Apps Script y seis pruebas automatizadas: incluidos en este código fuente. `npm run check` y `npm run build` pasan.
- Almacén Blob privado: conectado a `bautizo-simon-julian` para Production y Preview mediante OIDC. Vercel genera `RSVP_WEBHOOK_SECRET_STORE_ID`; no es la clave HMAC.
- Vercel tiene `EVENT_CONFIG_JSON` como variable sensible para Production y Preview, `PUBLIC_SITE_ORIGIN` para Production y Preview, y `RSVP_WEBHOOK_SECRET` como variable sensible de Production. No se han leído los valores de los secretos. Falta `SHEETS_WEBHOOK_URL`, así que el API todavía no puede enviar copias a Google Sheets.
- Hoja nativa privada: creada y con las pestañas `Resumen`, `Respuestas` y `Comensales`; sin registros de prueba ni respuestas reales.
- Apps Script: el proyecto contiene el receptor y tiene la propiedad `RSVP_SPREADSHEET_ID`. El error `invalid_envelope` aparece si se ejecuta `doPost()` manualmente sin una petición HTTP firmada; no demuestra que la URL web `/exec` esté configurada en Vercel ni que la conexión esté probada.
- Formulario público: desactivado (`submissionsEnabled: false`) hasta completar la URL `/exec`, configurar el origen permitido y probar el envío real de extremo a extremo.

`content/event.json` contiene `submissionsEnabled: false`. Solo se cambia a `true` después de autorizar Sheets, conectar Blob, configurar las claves y probar el flujo completo en producción.
