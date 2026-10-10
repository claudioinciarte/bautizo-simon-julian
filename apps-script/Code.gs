const RESPONSE_HEADERS = [
  'ID de respuesta', 'Revisión', 'Fecha de recepción', 'Contacto',
  'Asistencia', 'Comensales', 'Mensaje', 'Estado de sincronización',
];
const GUEST_HEADERS = [
  'ID de respuesta', 'ID de comensal', 'Contacto', 'Nombre del comensal',
  'Segundo (ID)', 'Segundo plato', 'Alergias o intolerancias',
  'Fecha de recepción', 'Pareja / referencia (manual)',
];
const MENU_IDS = ['entrecot', 'bacalao', 'rabo-buey', 'paella-mixta', 'paella-pescado'];

function doPost(e) {
  try {
    const envelope = JSON.parse(e && e.postData && e.postData.contents || '{}');
    verifyEnvelope_(envelope);
    const result = upsertResponse_(envelope.payload);
    return json_({ ok: true, ...result });
  } catch (error) {
    console.error('RSVP bridge rejected a request: ' + safeError_(error));
    return json_({ ok: false, error: safeError_(error) });
  }
}

function initializeSheets() {
  const spreadsheet = spreadsheet_();
  ensureSheet_(spreadsheet, 'Respuestas', RESPONSE_HEADERS);
  ensureSheet_(spreadsheet, 'Comensales', GUEST_HEADERS);
  if (!spreadsheet.getSheetByName('Resumen')) throw new Error('Falta la pestaña Resumen. Importa primero la plantilla preparada.');
}

function verifyEnvelope_(envelope) {
  const secret = PropertiesService.getScriptProperties().getProperty('RSVP_WEBHOOK_SECRET');
  if (!secret || secret.length < 32) throw new Error('bridge_not_configured');
  if (!envelope || typeof envelope.timestamp !== 'string' || typeof envelope.signature !== 'string' || !envelope.payload) {
    throw new Error('invalid_envelope');
  }
  const timestamp = Number(envelope.timestamp);
  if (!Number.isSafeInteger(timestamp) || Math.abs(Date.now() - timestamp) > 5 * 60 * 1000) throw new Error('expired_request');
  const canonical = envelope.timestamp + '.' + JSON.stringify(envelope.payload);
  const bytes = Utilities.computeHmacSha256Signature(canonical, secret);
  const expected = bytes.map(function (value) { return ('0' + (value & 255).toString(16)).slice(-2); }).join('');
  if (!constantTimeEqual_(expected, envelope.signature)) throw new Error('invalid_signature');
}

function upsertResponse_(response) {
  validateResponse_(response);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('sheet_busy_retry');
  try {
    const spreadsheet = spreadsheet_();
    const answers = ensureSheet_(spreadsheet, 'Respuestas', RESPONSE_HEADERS);
    const guests = ensureSheet_(spreadsheet, 'Comensales', GUEST_HEADERS);
    const existingRow = findRow_(answers, 1, response.responseId);
    if (existingRow && Number(answers.getRange(existingRow, 2).getValue()) > Number(response.revision)) {
      return { responseId: response.responseId, revision: response.revision, stale: true };
    }

    const guestRows = guests.getLastRow() > 1
      ? guests.getRange(2, 1, guests.getLastRow() - 1, GUEST_HEADERS.length).getValues() : [];
    const pairByGuestId = new Map();
    guestRows.forEach(function (row) { if (row[1]) pairByGuestId.set(String(row[1]), row[8] || ''); });

    const answerRow = [
      response.responseId,
      Number(response.revision),
      safeCell_(response.submittedAt),
      safeCell_(response.contactName),
      response.attending ? 'Sí' : 'No',
      Number(response.guestCount),
      safeCell_(response.message || ''),
      'Sincronizada',
    ];
    if (existingRow) answers.getRange(existingRow, 1, 1, answerRow.length).setValues([answerRow]);
    else answers.appendRow(answerRow);

    const retained = guestRows.filter(function (row) { return String(row[0]) !== response.responseId; });
    const currentGuests = response.guests.map(function (guest) {
      return [
        response.responseId,
        guest.guestId,
        safeCell_(response.contactName),
        safeCell_(guest.name),
        guest.mainCourseId,
        safeCell_(guest.mainCourseLabel),
        safeCell_(guest.dietaryNotes || ''),
        safeCell_(response.submittedAt),
        safeCell_(pairByGuestId.get(guest.guestId) || ''),
      ];
    });
    const allRows = retained.concat(currentGuests);
    if (guests.getLastRow() > 1) guests.getRange(2, 1, guests.getLastRow() - 1, GUEST_HEADERS.length).clearContent();
    if (allRows.length) guests.getRange(2, 1, allRows.length, GUEST_HEADERS.length).setValues(allRows);
    SpreadsheetApp.flush();
    return { responseId: response.responseId, revision: response.revision, stale: false };
  } finally {
    lock.releaseLock();
  }
}

function validateResponse_(response) {
  if (!response || response.schemaVersion !== 1 || !isUuid_(response.responseId) || !Number.isInteger(response.revision) || response.revision < 1) {
    throw new Error('invalid_response');
  }
  if (typeof response.contactName !== 'string' || !response.contactName.trim() || !Array.isArray(response.guests) || response.guests.length > 12) {
    throw new Error('invalid_response');
  }
  if (response.attending !== (response.guests.length > 0) || Number(response.guestCount) !== response.guests.length) throw new Error('invalid_guest_count');
  const seen = new Set();
  response.guests.forEach(function (guest) {
    if (!isUuid_(guest.guestId) || seen.has(guest.guestId) || !MENU_IDS.includes(guest.mainCourseId) || typeof guest.name !== 'string' || !guest.name.trim()) {
      throw new Error('invalid_guest');
    }
    seen.add(guest.guestId);
  });
}

function spreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('RSVP_SPREADSHEET_ID');
  if (!id) throw new Error('spreadsheet_not_configured');
  return SpreadsheetApp.openById(id);
}

function ensureSheet_(spreadsheet, name, headers) {
  const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  const existing = sheet.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
  if (existing.every(function (value) { return !value; })) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  } else if (headers.some(function (value, index) { return existing[index] !== value; })) {
    throw new Error('sheet_schema_mismatch_' + name);
  }
  return sheet;
}

function findRow_(sheet, column, value) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  const values = sheet.getRange(2, column, lastRow - 1, 1).getDisplayValues();
  const index = values.findIndex(function (row) { return row[0] === String(value); });
  return index < 0 ? 0 : index + 2;
}

function safeCell_(value) {
  const text = String(value == null ? '' : value);
  return /^[\s]*[=+\-@\t\r]/.test(text) ? "'" + text : text;
}

function constantTimeEqual_(left, right) {
  if (typeof right !== 'string' || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function isUuid_(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function safeError_(error) {
  const message = String(error && error.message || 'bridge_error');
  return /^[a-z0-9_-]{1,64}$/i.test(message) ? message : 'bridge_error';
}
