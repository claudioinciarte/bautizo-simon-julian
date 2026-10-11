# Invitación familiar

Sitio estático con formulario RSVP y API Node para almacenamiento privado y sincronización con Google Sheets.

## Privacidad

El repositorio contiene una configuración de ejemplo sin nombres ni fecha real. La configuración de producción se proporciona durante la compilación mediante la variable privada `EVENT_CONFIG_JSON` de Vercel. En desarrollo local puedes guardar los datos reales en `content/event.private.json`, un archivo excluido de Git. No subas la lista de invitados, datos del evento, respuestas, observaciones alimentarias ni credenciales al repositorio.

La invitación puede habilitar el formulario con `submissionsEnabled: true`. El envío requiere que el backend tenga configurados Blob, Google Sheets y la clave HMAC compartida con Apps Script. El formulario conserva validación de origen y un honeypot; no usa Turnstile.

## Desarrollo

Requiere Node.js 22 o posterior.

```sh
npm run check
npm run dev
npm run build
```

La compilación genera `dist/`. El contenido público de ejemplo está en `content/event.json`; la página y estilos están en `index.html`, `app.js` y `styles.css`.

## Backend

Vercel necesita `EVENT_CONFIG_JSON`, `PUBLIC_SITE_ORIGIN`, `RSVP_WEBHOOK_SECRET`, `SHEETS_WEBHOOK_URL` y el almacén privado Blob conectado. Apps Script necesita `RSVP_SPREADSHEET_ID` y el mismo `RSVP_WEBHOOK_SECRET` como propiedad del script. Para reintentos administrativos se configura `SYNC_ADMIN_TOKEN`. Consulta [docs/BACKEND.md](docs/BACKEND.md).

Los robots que respeten directivas reciben `noindex` y `Disallow: /`; una web pública sigue siendo descargable por clientes que ignoren esas directivas.

