import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { closeDatabase, createResponseStore, getRecord } from '../api/_lib/database.js';
import { makeWebhookEnvelope, normalizeResponse, nextRevision, verifyWebhookEnvelope } from '../api/_lib/rsvp.js';

const menus = [{ id: 'paella-mixta', label: 'Paella mixta (se comparte entre 2 personas)' }];
const family = {
  responseId: 'a9a8d95a-4d65-4c72-80b1-47dddb2f6512',
  submissionId: '21bcc58d-81c2-4434-930f-b075e68ed54c',
  contactName: 'Familia de prueba', attending: true,
  guests: [{ guestId: '5332a4b4-2435-4806-8a7f-30c7fbb8b952', name: 'Comensal de prueba', mainCourseId: 'paella-mixta' }],
};

test('normalizes only server-approved menu labels and drops untrusted fields', () => {
  const record = normalizeResponse({ ...family, ignored: 'private', guests: [{ ...family.guests[0], mainCourseLabel: 'forged' }] }, menus, new Date('2026-10-10T12:00:00Z'));
  assert.equal(record.guests[0].mainCourseLabel, menus[0].label);
  assert.equal(record.ignored, undefined);
  assert.equal(record.guestCount, 1);
});

test('rejects invalid menu, duplicate guests, over-limit groups and guests on a no response', () => {
  assert.throws(() => normalizeResponse({ ...family, guests: [{ ...family.guests[0], mainCourseId: 'other' }] }, menus), /invalid_menu/);
  assert.throws(() => normalizeResponse({ ...family, guests: [family.guests[0], family.guests[0]] }, menus), /duplicate_guest/);
  assert.throws(() => normalizeResponse({ ...family, guests: Array.from({ length: 13 }, (_, i) => ({ ...family.guests[0], guestId: `5332a4b4-2435-4806-8a7f-${String(i).padStart(12, '0')}` })) }, menus), /invalid_guests/);
  assert.throws(() => normalizeResponse({ ...family, attending: false }, menus), /guests_without_attendance/);
});

test('records declines with no guests and increments revisions while marking Sheets pending', () => {
  const decline = normalizeResponse({ ...family, attending: false, guests: [] }, menus);
  assert.equal(decline.guestCount, 0);
  const edited = nextRevision({ revision: 2, sheets: { attempts: 3 } }, decline);
  assert.equal(edited.revision, 3);
  assert.equal(edited.sheets.status, 'pending');
  assert.equal(edited.sheets.attempts, 3);
});

test('signs exact payload, rejects tampering and stale webhook requests', () => {
  const record = normalizeResponse(family, menus);
  const envelope = makeWebhookEnvelope(record, 'test-secret-which-is-long-enough', 1791633600000);
  assert.equal(verifyWebhookEnvelope(envelope, 'test-secret-which-is-long-enough', 1791633600000), true);
  assert.equal(verifyWebhookEnvelope({ ...envelope, payload: { ...record, contactName: 'Tampered' } }, 'test-secret-which-is-long-enough', 1791633600000), false);
  assert.equal(verifyWebhookEnvelope(envelope, 'test-secret-which-is-long-enough', 1791634200001), false);
});

test('stores RSVP records durably in SQLite and keeps newer revisions over stale sync results', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'rsvp-sqlite-'));
  const path = join(directory, 'responses.sqlite');
  let store = createResponseStore(path);
  try {
    const record = normalizeResponse(family, menus, new Date('2026-10-10T12:00:00Z'));
    store.save(record);
    assert.deepEqual(store.get(record.responseId), record);
    assert.equal(store.listPending(20).length, 1);

    store.close();
    store = createResponseStore(path);
    assert.deepEqual(store.get(record.responseId), record);

    const revision2 = { ...record, revision: 2, contactName: 'Familia actualizada' };
    store.save(revision2);
    store.save({ ...record, sheets: { ...record.sheets, status: 'synced' } });
    assert.equal(store.get(record.responseId).revision, 2);
    assert.equal(store.listPending(20)[0].contactName, 'Familia actualizada');

    store.save({ ...revision2, sheets: { ...revision2.sheets, status: 'synced' } });
    assert.equal(store.listPending(20).length, 0);
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('imports exported RSVP JSON only after validating every file', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'rsvp-import-'));
  const exports = join(directory, 'exports');
  const path = join(directory, 'responses.sqlite');
  await mkdir(exports);
  try {
    const record = normalizeResponse(family, menus);
    await writeFile(join(exports, 'valid.json'), JSON.stringify(record));
    execFileSync(process.execPath, ['scripts/import-responses.mjs', exports], {
      cwd: process.cwd(), env: { ...process.env, DATABASE_PATH: path }, stdio: 'pipe',
    });
    let store = createResponseStore(path);
    assert.deepEqual(store.get(record.responseId), record);
    store.close();

    await writeFile(join(exports, 'invalid.json'), JSON.stringify({ responseId: 'invalid' }));
    assert.throws(() => execFileSync(process.execPath, ['scripts/import-responses.mjs', exports], {
      cwd: process.cwd(), env: { ...process.env, DATABASE_PATH: path }, stdio: 'pipe',
    }));
    store = createResponseStore(path);
    assert.equal(store.listPending(20).length, 1);
    store.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('accepts an RSVP into SQLite before reporting a successful Sheets sync', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'rsvp-handler-'));
  const env = ['DATABASE_PATH', 'PUBLIC_SITE_ORIGIN', 'RSVP_WEBHOOK_SECRET', 'SHEETS_WEBHOOK_URL'];
  const previous = Object.fromEntries(env.map((key) => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  process.env.DATABASE_PATH = join(directory, 'responses.sqlite');
  process.env.PUBLIC_SITE_ORIGIN = 'https://invitation.test';
  process.env.RSVP_WEBHOOK_SECRET = 'test-webhook-secret-that-is-long-enough';
  process.env.SHEETS_WEBHOOK_URL = 'https://sheets.test/exec';
  globalThis.fetch = async (_url, options) => {
    const envelope = JSON.parse(options.body);
    assert.equal(verifyWebhookEnvelope(envelope, process.env.RSVP_WEBHOOK_SECRET), true);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  try {
    const { default: handler } = await import('../api/rsvp.js');
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) { this.headers[name] = value; },
      status(code) { this.statusCode = code; return this; },
      json(value) { this.body = value; return this; },
    };
    await handler({ method: 'POST', headers: { origin: process.env.PUBLIC_SITE_ORIGIN }, body: family }, res);
    assert.equal(res.statusCode, 202);
    assert.equal(res.body.sheetsSynced, true);
    assert.equal(getRecord(family.responseId).sheets.status, 'synced');
  } finally {
    closeDatabase();
    globalThis.fetch = originalFetch;
    for (const key of env) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
    await rm(directory, { recursive: true, force: true });
  }
});

test('Apps Script bridge source parses as V8 JavaScript', async () => {
  const source = await readFile(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
  assert.doesNotThrow(() => new Function(source));
});

test('Apps Script accepts the child menu only for a guest marked as a child', async () => {
  const source = await readFile(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
  const validate = runInNewContext(`${source}\nvalidateResponse_`);
  const response = {
    schemaVersion: 1,
    responseId: 'a9a8d95a-4d65-4c72-80b1-47dddb2f6512',
    revision: 1,
    contactName: 'Familia de prueba',
    attending: true,
    guestCount: 1,
    guests: [{ guestId: '5332a4b4-2435-4806-8a7f-30c7fbb8b952', name: 'Comensal de prueba', mainCourseId: 'menu-infantil', isChild: true }],
  };
  assert.doesNotThrow(() => validate(response));
  assert.throws(() => validate({ ...response, guests: [{ ...response.guests[0], isChild: false }] }), /invalid_guest/);
});

