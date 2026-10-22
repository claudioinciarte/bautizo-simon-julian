# Despliegue en Raspberry Pi

La aplicación se publica con Docker Compose. Crea `content/event.private.json` con la configuración real del evento y `.env` a partir de `.env.example`; ambos contienen configuración privada y no deben subirse a Git.

```sh
docker compose up -d --build
docker compose ps
docker compose logs -f invitacion
```

El contenedor escucha en `0.0.0.0:4173`; Compose publica el puerto definido por `HOST_PORT` (4173 por defecto). La base SQLite queda en el volumen `rsvp-data`.

Para actualizar la aplicación, trae los cambios y ejecuta de nuevo `docker compose up -d --build`. Para detenerla sin borrar datos, usa `docker compose down`; no añadas `-v` salvo que quieras borrar la base.

El reintento manual desde la Raspberry sigue disponible con `python3 scripts/retry_sheets.py`; pide el token sin mostrarlo y llama al contenedor local. El cron permanece apagado.
