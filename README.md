# Invitación familiar

Sitio web y API Node, empaquetados para Docker. Los RSVP se guardan en SQLite y se sincronizan con Google Sheets mediante Apps Script.

## Privacidad

El repositorio contiene una configuración de ejemplo. La configuración real del evento se guarda en `content/event.private.json`, se monta en el contenedor en tiempo de ejecución y queda excluida de Git y de la imagen. No subas la lista de invitados, respuestas, observaciones alimentarias ni credenciales al repositorio.

La invitación puede habilitar el formulario con `submissionsEnabled: true`. El backend guarda cada respuesta en SQLite antes de enviarla a Sheets. Si Sheets falla, el RSVP queda pendiente en la base de datos. El formulario conserva validación de origen y un honeypot; no usa Turnstile.

## Desarrollo

Requiere Node.js 22 o posterior.

```sh
npm run check
npm run dev
npm run build
```

La compilación genera `dist/`. El contenido público de ejemplo está en `content/event.json`; la página y estilos están en `index.html`, `app.js` y `styles.css`.

## Backend

Consulta [docs/BACKEND.md](docs/BACKEND.md) para configurar SQLite, secretos y Apps Script. El cron de reintentos está pausado; las filas pendientes se pueden recuperar con `POST /api/admin/retry-sheets`.

## Docker en Raspberry Pi

1. Crea `content/event.private.json` con la configuración real del evento; no lo subas al repositorio.
2. Copia `.env.example` a `.env` y configura el origen, la URL de Apps Script y ambos tokens.
3. Ejecuta `docker compose up -d --build`. Las respuestas quedan en el volumen `rsvp-data`.
4. Abre `http://10.10.30.2:4173` desde la red local. Para invitados fuera de casa configura un dominio y un proxy o túnel HTTPS.

Los robots que respeten directivas reciben `noindex` y `Disallow: /`; una web pública sigue siendo descargable por clientes que ignoren esas directivas.
