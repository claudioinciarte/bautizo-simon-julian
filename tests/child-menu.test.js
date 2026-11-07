import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { normalizeResponse } from '../api/_lib/rsvp.js';

test('configured child menu survives validation and the Sheets bridge', async () => {
  const config = JSON.parse(await readFile(new URL('../content/event.json', import.meta.url), 'utf8'));
  assert.equal(config.childMenu?.id, 'menu-infantil');
  assert.equal(config.childMenu.price, 18);
  const menus = [...config.menus, { ...config.childMenu, childOnly: true }];
  const input = {
    responseId: 'a9a8d95a-4d65-4c72-80b1-47dddb2f6512',
    submissionId: '793b419d-5335-4ec4-8e1b-ad07da27741a',
    contactName: 'Familia de prueba',
    attending: true,
    guests: [{ guestId: '5332a4b4-2435-4806-8a7f-30c7fbb8b952', name: 'Comensal de prueba', mainCourseId: config.childMenu.id, isChild: true }],
  };
  const record = normalizeResponse(input, menus);
  assert.equal(record.guests[0].isChild, true);
  assert.equal(record.guests[0].mainCourseLabel, config.childMenu.label);
  assert.throws(() => normalizeResponse({ ...input, guests: [{ ...input.guests[0], isChild: false }] }, menus), /invalid_menu/);
  const source = await readFile(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
  const validate = runInNewContext(`${source}\nvalidateResponse_`);
  assert.doesNotThrow(() => validate(record));
  assert.throws(() => validate({ ...record, guests: [{ ...record.guests[0], isChild: false }] }), /invalid_guest/);
});
