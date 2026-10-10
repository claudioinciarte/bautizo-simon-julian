# Bautizo de Simón Agustín y Julián Daniel

Invitación de una página y formulario de asistencia y selección de menús para el 27 de diciembre de 2026, con comida en El Racó del Port, Mataró.

## Estado actual

Implementados: invitación estática adaptable al móvil y formulario de demostración con asistencia, familiares, observaciones alimentarias, validación y revisión del resumen. Incluye el fondo generado, una tipografía caligráfica local con licencia, los documentos de diseño, el roadmap y los datos iniciales.

El formulario no envía ni guarda respuestas. El guardado persistente, la sincronización con Google Sheets, el panel de organización y el despliegue están pendientes. Los menús, la hora de la comida, la ubicación precisa y las grafías de padrinos y madrinas siguen pendientes de revisión.

Repositorio: https://github.com/claudioinciarte/bautizo-simon-julian. GitHub es la fuente de verdad para código, documentos y recursos. Esta es la base inicial del proyecto.

El repositorio está público por elección del organizador. Vercel también admite repositorios privados de cuentas personales; no es necesario hacerlo público para desplegar. Al ser público, los documentos y las referencias de la invitación son accesibles a cualquier persona. No subir respuestas de invitados ni secretos.

## Uso local y despliegue posterior

Requiere Node.js 22 o posterior y no tiene dependencias externas.

```sh
npm run check
npm run dev
npm run build
```

La compilación crea `dist/` con únicamente la página y sus recursos. `vercel.json` configura la compilación y el directorio de salida para el siguiente paso; no se ha creado ni desplegado un proyecto en Vercel.

Los datos se editan en `content/event.json`. Para activar menús en la demostración, añadir objetos `{ "id": "identificador", "label": "Nombre real del menú" }` y establecer `menusPending` en `false`. Esto no activa el envío real. Para los padrinos, utilizar objetos `{ "child": "Nombre del niño", "godfathers": ["Nombre"], "godmothers": ["Nombre"] }` y revisar `godparentsReviewPending`.

## Archivos

- `index.html`, `styles.css`, `app.js`: página estática y formulario.
- `scripts/`: servidor de revisión y compilación sin dependencias.
- `vercel.json`: configuración para el futuro despliegue.
- `design.md`: identidad visual, composición, componentes y estados.
- `docs/roadmap.md`: procedimiento completo, responsabilidades y verificaciones.
- `docs/assets.md`: procedencia y uso de las imágenes.
- `content/event.json`: contenido inicial y datos pendientes.
- `assets/fondo-bautizo.png`: ilustración sin texto para la página.
- `references/onepager-concepto.png`: propuesta de la interfaz, no un formulario operativo.
- `references/invitacion-borrador.jpg`: fuente aportada por la familia.

## Arquitectura prevista

Web adaptable al móvil en Vercel. El servidor valida y guarda cada respuesta como un JSON privado y permanente antes de confirmarla. Google Sheets recibe una copia mediante Apps Script, con reintentos y deduplicación. El organizador dispone de exportación protegida y recuperación de respuestas pendientes.

Las respuestas de invitados y sus alergias no forman parte del repositorio. Mantener los secretos en la configuración del servidor; no subirlos a GitHub.

## Próximos pasos

Revisar el diseño y confirmar los menús, la hora de la comida y los datos de la ceremonia. Implementar la web y el guardado; conectar Sheets; verificar el recorrido completo, incluidos fallos de conexión; publicar en Vercel y compartir el enlace.

El objetivo es usar servicios gratuitos dentro de sus cuotas. No se ha contratado ningún servicio ni dominio.
