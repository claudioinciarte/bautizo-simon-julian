import { get, put } from '@vercel/blob';
import eventConfig from '../content/event.json' with { type: 'json' };
import { blobStoreId } from './_lib/blob.js';
import { makeWebhookEnvelope, nextRevision, normalizeResponse, RESPONSE_PREFIX } from './_lib/rsvp.js';

export const config = { api: { bodyParser: { sizeLimit: '32kb' } } };

export default async function handler(req, res) {
  setHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!sameOrigin(req)) return res.status(403).json({ error: 'origin_not_allowed' });

  const body = parseBody(req.body);
  if (!body) return res.status(400).json({ error: 'invalid_body' });
  if (body.website) return res.status(202).json({ received: true });

  const secret = process.env.RSVP_WEBHOOK_SECRET;
  const sheetsUrl = process.env.SHEETS_WEBHOOK_URL;
  if (!secret || secret.length < 32 || !blobStoreId()) {
    return res.status(503).json({ error: 'backend_not_configured' });
  }

  let fresh;
  try { fresh = normalizeResponse(body, eventConfig.menus); }
  catch (error) { return res.status(400).json({ error: safeValidationCode(error) }); }

  const pathname = `${RESPONSE_PREFIX}${fresh.responseId}.json`;
  try {
    const current = await get(pathname, { access: 'private', storeId: blobStoreId() });
    let record;
    let shouldWrite = false;
    if (current?.stream) {
      const prior = JSON.parse(await new Response(current.stream).text());
      if (prior.submissionId === fresh.submissionId) {
        record = prior;
      } else {
        record = nextRevision(prior, fresh);
        shouldWrite = true;
      }
    } else {
      record = fresh;
      shouldWrite = true;
    }

    if (shouldWrite) await saveRecord(pathname, record);

    const synced = record.sheets?.status === 'synced'
      ? true : await syncRecord(pathname, record, sheetsUrl, secret);
    return res.status(202).json({
      received: true,
      responseId: record.responseId,
      revision: record.revision,
      sheetsSynced: synced,
    });
  } catch {
    return res.status(503).json({ error: 'could_not_save_response' });
  }
}

export async function syncRecord(pathname, record, sheetsUrl = process.env.SHEETS_WEBHOOK_URL, secret = process.env.RSVP_WEBHOOK_SECRET) {
  if (!sheetsUrl || !secret) return false;
  const updated = {
    ...record,
    sheets: { ...record.sheets, status: 'pending', attempts: (record.sheets?.attempts ?? 0) + 1, lastAttemptAt: new Date().toISOString() },
  };
  let synced = false;
  try {
    const envelope = makeWebhookEnvelope(updated, secret);
    const response = await fetch(sheetsUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(envelope),
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) throw new Error('sheets_http_error');
    const result = await response.json();
    if (result.ok !== true) throw new Error('sheets_rejected');
    updated.sheets = { status: 'synced', attempts: updated.sheets.attempts, lastAttemptAt: updated.sheets.lastAttemptAt, syncedAt: new Date().toISOString() };
    synced = true;
  } catch {
    // A failed copy stays pending; the durable RSVP remains accepted.
  }
  try { await saveRecord(pathname, updated); }
  catch { return false; }
  return synced;
}

export async function saveRecord(pathname, record) {
  await put(pathname, JSON.stringify(record), {
    access: 'private',
    storeId: blobStoreId(),
    contentType: 'application/json; charset=utf-8',
    cacheControlMaxAge: 60,
    allowOverwrite: true,
  });
}

function parseBody(value) {
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return null; }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function safeValidationCode(error) {
  return error instanceof TypeError && /^invalid_|^(missing_|guests_)/.test(error.message) ? error.message : 'invalid_body';
}

function sameOrigin(req) {
  const allowed = process.env.PUBLIC_SITE_ORIGIN;
  if (!allowed) return false;
  return req.headers.origin === allowed;
}

function setHeaders(res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
}
