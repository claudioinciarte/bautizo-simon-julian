import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { blobStoreId } from '../api/_lib/blob.js';
import { makeWebhookEnvelope, normalizeResponse, nextRevision, verifyWebhookEnvelope } from '../api/_lib/rsvp.js';

const menus = [{ id: 'paella-mixta', label: 'Paella mixta (se comparte entre 2 personas)' }];
const family = {
  responseId: 'a9a8d95a-4d65-4c72-80b1-47dddb2f6512',
  submissionId: '21bcc58d-81c2-4434-930f-b075e68ed54c',
  contactName: 'Familia de prueba', attending: true,
  guests: [{ guestId: '5332a4b4-2435-4806-8a7f-30c7fbb8b952', name: 'Comensal de prueba', mainCourseId: 'paella-mixta' }],
};

test('uses the custom Vercel Blob environment-variable prefix from the connected store', () => {
  assert.equal(blobStoreId({ RSVP_WEBHOOK_SECRET_STORE_ID: 'store_test' }), 'store_test');
  assert.equal(blobStoreId({ BLOB_STORE_ID: 'store_default', RSVP_WEBHOOK_SECRET_STORE_ID: 'store_custom' }), 'store_default');
  assert.equal(blobStoreId({}), '');
});

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

test('Apps Script bridge source parses as V8 JavaScript', async () => {
  const source = await readFile(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
  assert.doesNotThrow(() => new Function(source));
});


