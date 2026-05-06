// Fetches a single page — stays well within Vercel Hobby's 10s limit.
export async function POST(request) {
  const { siteUrl, consumerKey, consumerSecret, page = 1 } = await request.json();

  if (!siteUrl || !consumerKey || !consumerSecret) {
    return Response.json({ error: 'Missing credentials' }, { status: 400 });
  }

  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const headers = { Authorization: `Basic ${auth}` };
  const url = `${siteUrl.replace(/\/$/, '')}/wp-json/wc/v3/products?per_page=100&page=${page}`;

  let backoff = 2000;
  let retries = 4;

  while (retries > 0) {
    const res = await fetch(url, { headers, cache: 'no-store' });
    if (res.status === 429) {
      const waitMs = res.headers.get('retry-after')
        ? parseInt(res.headers.get('retry-after')) * 1000
        : backoff;
      backoff = Math.min(backoff * 2, 8000);
      retries--;
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }
    if (!res.ok) {
      return Response.json({ error: `WooCommerce returned HTTP ${res.status}` }, { status: res.status });
    }
    const data = await res.json();
    const totalPages = parseInt(res.headers.get('X-WP-TotalPages') || '1');
    return Response.json({ data, totalPages });
  }

  return Response.json({ error: 'Rate limited — exceeded retries' }, { status: 429 });
}
