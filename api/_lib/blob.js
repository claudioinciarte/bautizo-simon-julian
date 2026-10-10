export function blobStoreId(env = process.env) {
  // Vercel allows a custom prefix for Blob's generated environment variables.
  return env.BLOB_STORE_ID || env.RSVP_WEBHOOK_SECRET_STORE_ID || '';
}
