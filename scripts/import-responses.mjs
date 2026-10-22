import { readdir, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createResponseStore } from '../api/_lib/database.js';

const source = process.argv[2];
if (!source) throw new Error('Uso: node scripts/import-responses.mjs <directorio-exportado>');

const directory = resolve(source);
const files = (await readdir(directory, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith('.json'));
const records = await Promise.all(files.map(async (file) => {
  const record = JSON.parse(await readFile(join(directory, file.name), 'utf8'));
  if (record.schemaVersion !== 1 || !isUuid(record.responseId) || !isUuid(record.submissionId)
    || !Number.isInteger(record.revision) || record.revision < 1 || !Array.isArray(record.guests)
    || !['pending', 'synced'].includes(record.sheets?.status)) {
    throw new Error(`Registro no válido: ${file.name}`);
  }
  return record;
}));

const store = createResponseStore(process.env.DATABASE_PATH || 'data/rsvp.sqlite');
try {
  for (const record of records) store.save(record);
  console.log(`Importados ${records.length} registros desde ${directory}.`);
} finally {
  store.close();
}

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
