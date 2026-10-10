const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstile(token, secret, expectedHostname, requestFetch = fetch) {
  if (typeof token !== 'string' || !token || token.length > 2048
    || typeof secret !== 'string' || secret.length < 20
    || typeof expectedHostname !== 'string' || !expectedHostname) return false;

  try {
    const response = await requestFetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret, response: token }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return false;
    const result = await response.json();
    return result.success === true
      && result.hostname === expectedHostname
      && result.action === 'rsvp';
  } catch {
    return false;
  }
}

