# Invitación familiar

Sitio estático con formulario RSVP y API Node para almacenamiento privado y sincronización con Google Sheets.

## Privacidad

El repositorio contiene una configuración de ejemplo sin nombres ni fecha real. La configuración de producción se proporciona durante la compilación mediante la variable privada `EVENT_CONFIG_JSON` de Vercel. En desarrollo local puedes guardar los datos reales en `content/event.private.json`, un archivo excluido de Git. No subas la lista de invitados, datos del evento, respuestas, observaciones alimentarias ni credenciales al repositorio.

La invitación puede habilitar el formulario con `submissionsEnabled: true`, pero el servidor solo acepta respuestas con configuración completa y una prueba válida de Turnstile. La clave pública se inyecta durante la compilación; el secreto de Turnstile y el HMAC viven en variables privadas de Vercel.

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

Para aceptar respuestas también hay que configurar `TURNSTILE_SITE_KEY` como variable de build en Vercel y `TURNSTILE_SECRET_KEY` como secreto de runtime. Los robots que respeten directivas reciben `noindex` y `Disallow: /`; una web pública sigue siendo descargable por clientes que ignoren esas directivas.

