import { get, list } from '@vercel/blob';
import { blobStoreId } from '../_lib/blob.js';
import { RESPONSE_PREFIX } from '../_lib/rsvp.js';
import { saveRecord, syncRecord } from '../rsvp.js';

const MAX_RETRIES_PER_CALL = 20;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const expected = process.env.SYNC_ADMIN_TOKEN;
  const authorization = req.headers.authorization || '';
  if (!expected || expected.length < 32 || authorization !== `Bearer ${expected}`) return res.status(401).json({ error: 'unauthorized' });

  try {
    let cursor;
    let retried = 0;
    let pendingFound = false;
    do {
      const page = await list({ prefix: RESPONSE_PREFIX, limit: 1000, cursor, storeId: blobStoreId() });
      for (const blob of page.blobs) {
        const result = await get(blob.pathname, { access: 'private', useCache: false, storeId: blobStoreId() });
        if (!result?.stream) continue;
        const record = JSON.parse(await new Response(result.stream).text());
        if (record.sheets?.status === 'synced') continue;
        pendingFound = true;
        if (retried >= MAX_RETRIES_PER_CALL) continue;
        await syncRecord(blob.pathname, record);
        retried += 1;
      }
      if (!page.hasMore || retried >= MAX_RETRIES_PER_CALL) break;
      cursor = page.cursor;
    } while (true);
    return res.status(200).json({ ok: true, retried, moreMayRemain: pendingFound && retried === MAX_RETRIES_PER_CALL });
  } catch {
    return res.status(500).json({ error: 'retry_failed' });
  }
}
