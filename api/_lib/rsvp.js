import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';

export const MAX_GUESTS = 12;

export function normalizeResponse(input, menus, now = new Date()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('invalid_body');
  const responseId = validId(input.responseId, 'responseId');
  const submissionId = validId(input.submissionId, 'submissionId');
  const contactName = requiredText(input.contactName, 120, 'contactName');
  if (typeof input.attending !== 'boolean') throw new TypeError('invalid_attendance');

  const guestsInput = input.guests ?? [];
  if (!Array.isArray(guestsInput) || guestsInput.length > MAX_GUESTS) throw new TypeError('invalid_guests');
  if (!input.attending && guestsInput.length) throw new TypeError('guests_without_attendance');
  if (input.attending && !guestsInput.length) throw new TypeError('missing_guests');
  const menuIds = new Set(menus.map((menu) => menu.id));
  const guestIds = new Set();
  const guests = guestsInput.map((guest) => {
    if (!guest || typeof guest !== 'object' || Array.isArray(guest)) throw new TypeError('invalid_guest');
    const guestId = validId(guest.guestId, 'guestId');
    if (guestIds.has(guestId)) throw new TypeError('duplicate_guest');
    guestIds.add(guestId);
    const mainCourseId = String(guest.mainCourseId ?? '');
    if (!menuIds.has(mainCourseId)) throw new TypeError('invalid_menu');
    const menu = menus.find((item) => item.id === mainCourseId);
    if (menu.childOnly && guest.isChild !== true) throw new TypeError('invalid_menu');
    return {
      guestId,
      name: requiredText(guest.name, 120, 'guest_name'),
      mainCourseId,
      mainCourseLabel: menu.label,
      isChild: guest.isChild === true,
      dietaryNotes: optionalText(guest.dietaryNotes, 500, 'dietary_notes'),
    };
  });

  return {
    schemaVersion: 1,
    responseId,
    submissionId,
    revision: 1,
    submittedAt: now.toISOString(),
    contactName,
    attending: input.attending,
    guestCount: guests.length,
    guests,
    message: optionalText(input.message, 1000, 'message'),
    sheets: { status: 'pending', attempts: 0, lastAttemptAt: null, syncedAt: null },
  };
}

export function nextRevision(previous, fresh) {
  return {
    ...fresh,
    revision: (previous?.revision ?? 0) + 1,
    sheets: { status: 'pending', attempts: previous?.sheets?.attempts ?? 0, lastAttemptAt: null, syncedAt: null },
  };
}

export function makeWebhookEnvelope(payload, secret, nowMs = Date.now()) {
  const timestamp = String(nowMs);
  const serializedPayload = JSON.stringify(payload);
  const signature = createHmac('sha256', secret).update(`${timestamp}.${serializedPayload}`).digest('hex');
  return { timestamp, signature, payload };
}

export function verifyWebhookEnvelope(envelope, secret, nowMs = Date.now(), maxAgeMs = 5 * 60 * 1000) {
  if (!envelope || typeof envelope !== 'object' || typeof envelope.timestamp !== 'string'
    || typeof envelope.signature !== 'string' || !envelope.payload) return false;
  const timestamp = Number(envelope.timestamp);
  if (!Number.isSafeInteger(timestamp) || Math.abs(nowMs - timestamp) > maxAgeMs) return false;
  const expected = createHmac('sha256', secret)
    .update(`${envelope.timestamp}.${JSON.stringify(envelope.payload)}`).digest();
  let received;
  try { received = Buffer.from(envelope.signature, 'hex'); } catch { return false; }
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function newId() {
  return randomUUID();
}

function validId(value, label) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new TypeError(`invalid_${label}`);
  }
  return value.toLowerCase();
}

function requiredText(value, maxLength, label) {
  if (typeof value !== 'string') throw new TypeError(`invalid_${label}`);
  const text = value.trim();
  if (!text || text.length > maxLength || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text)) {
    throw new TypeError(`invalid_${label}`);
  }
  return text;
}

function optionalText(value, maxLength, label) {
  if (value == null) return '';
  if (typeof value !== 'string') throw new TypeError(`invalid_${label}`);
  const text = value.trim();
  if (text.length > maxLength || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text)) {
    throw new TypeError(`invalid_${label}`);
  }
  return text;
}
