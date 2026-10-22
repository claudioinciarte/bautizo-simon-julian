import { listPendingRecords } from '../_lib/database.js';
import { syncRecord } from '../rsvp.js';

const MAX_RETRIES_PER_CALL = 20;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const expected = process.env.SYNC_ADMIN_TOKEN;
  const authorization = req.headers.authorization || '';
  if (!expected || expected.length < 32 || authorization !== `Bearer ${expected}`) return res.status(401).json({ error: 'unauthorized' });

  try {
    const pending = listPendingRecords(MAX_RETRIES_PER_CALL + 1);
    const batch = pending.slice(0, MAX_RETRIES_PER_CALL);
    for (const record of batch) await syncRecord(record);
    return res.status(200).json({ ok: true, retried: batch.length, moreMayRemain: pending.length > MAX_RETRIES_PER_CALL });
  } catch {
    return res.status(500).json({ error: 'retry_failed' });
  }
}
