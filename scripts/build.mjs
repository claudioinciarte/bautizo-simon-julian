import { mkdir, cp, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'dist');
let eventJson = process.env.EVENT_CONFIG_JSON;
if (!eventJson) {
  try {
    eventJson = await readFile(resolve(root, 'content/event.private.json'), 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    eventJson = await readFile(resolve(root, 'content/event.json'), 'utf8');
  }
}
const event = JSON.parse(eventJson);
if (!event.children?.length || !event.date || !Array.isArray(event.menus)) throw new Error('Revisa content/event.json');
await mkdir(out, { recursive: true });
for (const item of ['index.html', 'styles.css', 'app.js', 'assets']) {
  await cp(resolve(root, item), resolve(out, item), { recursive: true });
}
await mkdir(resolve(out, 'content'), { recursive: true });
await writeFile(resolve(out, 'content/event.json'), `${JSON.stringify(event, null, 2)}\n`);
console.log('Web estática preparada en dist/. El formulario sigue en modo demostración.');
