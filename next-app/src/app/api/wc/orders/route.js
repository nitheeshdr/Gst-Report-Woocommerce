export const maxDuration = 60;

export async function POST(request) {
  const { siteUrl, consumerKey, consumerSecret } = await request.json();

  if (!siteUrl || !consumerKey || !consumerSecret) {
    return Response.json({ error: 'Missing credentials' }, { status: 400 });
  }

  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const headers = { Authorization: `Basic ${auth}` };
  const base = siteUrl.replace(/\/$/, '');
  const baseUrl = `${base}/wp-json/wc/v3/orders?per_page=100`;

  let backoff = 3000;

  const fetchPage = async (page) => {
    let retries = 8;
    while (retries > 0) {
      const res = await fetch(`${baseUrl}&page=${page}`, { headers, cache: 'no-store' });
      if (res.status === 429) {
        const waitMs = res.headers.get('retry-after')
          ? parseInt(res.headers.get('retry-after')) * 1000
          : backoff;
        backoff = Math.min(backoff * 2, 20000);
        await new Promise(r => setTimeout(r, waitMs));
        retries--;
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} on page ${page}`);
      backoff = 3000; // reset after success
      return res;
    }
    throw new Error(`Exceeded retries on page ${page}`);
  };

  try {
    const firstRes = await fetchPage(1);
    const firstData = await firstRes.json();
    const totalPages = parseInt(firstRes.headers.get('X-WP-TotalPages') || '1');

    if (totalPages === 1) {
      return Response.json({ data: firstData });
    }

    const allData = [...firstData];

    for (let page = 2; page <= totalPages; page++) {
      await new Promise(r => setTimeout(r, 500));
      const res = await fetchPage(page);
      const data = await res.json();
      allData.push(...data);
    }

    return Response.json({ data: allData });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
