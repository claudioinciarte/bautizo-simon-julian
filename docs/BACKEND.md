# Backend autoalojado

El backend se ejecuta dentro del contenedor Docker. Cada RSVP se persiste en SQLite antes de intentar sincronizarlo con Google Sheets; SQLite está en el volumen `rsvp-data`, así que sobrevive a reinicios y actualizaciones del contenedor. No se necesita Vercel Blob.

## Flujo

1. `POST /api/rsvp` verifica el origen, el honeypot, los identificadores, la asistencia y los menús del evento.
2. Guarda la respuesta en `responses` dentro de SQLite.
3. Envía una copia firmada con HMAC a Apps Script. El script actualiza la fila familiar y sustituye las filas de comensales; reenvíos no crean duplicados.
4. Si Sheets falla, el RSVP permanece guardado como pendiente. `POST /api/admin/retry-sheets` reintenta hasta 20 pendientes por llamada.

El cron de reintentos está pausado intencionadamente. Los envíos nuevos se intentan sincronizar inmediatamente.

## Configuración

Guarda estas variables en el archivo local `.env`, excluido de Git:

| Variable | Uso |
| --- | --- |
| `PUBLIC_SITE_ORIGIN` | Origen exacto de la web, incluyendo esquema y puerto, por ejemplo `http://10.10.30.2:4173`. |
| `RSVP_WEBHOOK_SECRET` | Secreto aleatorio de al menos 32 caracteres. Debe coincidir con la propiedad de Apps Script. |
| `SHEETS_WEBHOOK_URL` | URL `/exec` de la aplicación web de Apps Script. |
| `SYNC_ADMIN_TOKEN` | Token aleatorio de al menos 32 caracteres para reintentar pendientes. |

`content/event.private.json` contiene la configuración real del evento. Queda fuera de Git y de la imagen, y Docker Compose la monta como secreto de solo lectura. No pongas los tokens en el código ni los compartas en el chat.

En Apps Script conserva `RSVP_SPREADSHEET_ID` y el mismo `RSVP_WEBHOOK_SECRET`. La hoja y Apps Script siguen alojados en Google; el contenedor solo realiza las peticiones firmadas.

## Base de datos y copias

SQLite se guarda en `/data/rsvp.sqlite` dentro del volumen `rsvp-data`. Para respaldarla, detén temporalmente el contenedor y copia el volumen o el archivo de base de datos junto a sus archivos `-wal` y `-shm`. No borres el volumen al actualizar la imagen.

El endpoint `GET /healthz` permite comprobar que el contenedor responde. Para recuperar pendientes, envía `POST /api/admin/retry-sheets` con `Authorization: Bearer <SYNC_ADMIN_TOKEN>`; la respuesta solo indica cuántos reintentos realizó.

## Trasladar datos existentes

Las respuestas que solo estén guardadas en el Blob anterior no aparecen automáticamente en SQLite. Antes de apagar o eliminar ese almacenamiento, hay que exportar sus archivos JSON y copiarlos en una carpeta, o confirmar que todas esas respuestas ya están en la hoja. Importa un directorio plano de JSON con `node scripts/import-responses.mjs <directorio>`; el script valida todos los ficheros antes de escribir. No se han copiado respuestas reales en esta preparación.
