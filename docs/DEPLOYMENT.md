# Despliegue de producción

- Proyecto Vercel: `bautizo-simon-julian`.
- Alias de producción: `https://bautizo-simon-julian.vercel.app/`.
- Build: `npm run build`, salida `dist/`.

La configuración real de la invitación vive en la variable sensible `EVENT_CONFIG_JSON` de Vercel. GitHub conserva una configuración de ejemplo; la clave HMAC y los datos del evento no se guardan en el código público. En el equipo local, la configuración privada opcional se guarda en `content/event.private.json`, excluida de Git y de `dist/`.

`SHEETS_WEBHOOK_URL` ya apunta al despliegue `/exec` de Apps Script. La configuración privada marca el formulario habilitado, pero la interfaz y la API bloquean los envíos hasta añadir las claves Turnstile y reemplazar la clave HMAC expuesta. Comprueba el despliegue actual en Vercel; los identificadores y estados cambian con cada publicación.

