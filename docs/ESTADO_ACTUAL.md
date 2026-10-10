# Estado actual

Código comprobado el 10 de octubre de 2026.

## Código y despliegue

- GitHub `main` y Vercel producción reciben publicaciones desde este proyecto; consulta sus paneles para los identificadores vigentes.
- La configuración pública del repositorio contiene valores de ejemplo. La configuración real de la invitación se mantiene en una variable sensible de Vercel; el archivo local opcional `content/event.private.json` está ignorado y no se copia al build.
- El almacén Blob privado usa OIDC. La API, el receptor de Apps Script y las pruebas automatizadas están incluidos en el proyecto.

## Pendiente para respuestas reales

- Vercel tiene `EVENT_CONFIG_JSON`, `PUBLIC_SITE_ORIGIN`, `RSVP_WEBHOOK_SECRET` y `SHEETS_WEBHOOK_URL`. Los valores secretos no se han leído.
- Apps Script devuelve una URL `/exec`; todavía no se ha confirmado una petición HTTP firmada desde la web hasta la hoja.
- La configuración privada cambia `submissionsEnabled` a `true`, pero los envíos siguen cerrados por código hasta que estén configuradas las claves Turnstile. No se han enviado respuestas de prueba ni datos reales.
- La integración Turnstile valida token, hostname y acción en el servidor. El proyecto necesita `TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY`.
- Se añadieron honeypot y directivas `noindex`/`Disallow`; estas no bloquean scrapers que ignoran robots. El contenido de la invitación sigue siendo público.
- El error de Apps Script `invalid_envelope` es compatible con ejecutar `doPost()` manualmente sin el cuerpo firmado que envía la API; por sí solo no valida el despliegue del receptor.

## Verificación

`npm run check`: ocho pruebas correctas. `npm run build`: correcto; el build local confirmó que no copia `event.private.json` a `dist/`.

