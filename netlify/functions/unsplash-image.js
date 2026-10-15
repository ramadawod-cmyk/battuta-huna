const https = require('https');

function httpsGetJson(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers, timeout: 8000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`Unsplash request failed with status ${res.statusCode}: ${data.slice(0, 200)}`));
        }
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse error: ' + data.slice(0, 80))); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
  });
}

exports.handler = async function (event) {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=86400',
    'Access-Control-Allow-Origin': '*',
  };

  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Unsplash not configured' }) };
  }

  const params = event.queryStringParameters || {};
  const city = params.city;
  if (!city) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing city' }) };
  }

  // Appending the country disambiguates same-named cities (e.g. a bare "Paris" search); "travel"
  // biases results toward editorial travel photography instead of unrelated local businesses that
  // happen to share the city's name.
  const query = [city, params.country, 'travel'].filter(Boolean).join(' ');
  const url = 'https://api.unsplash.com/search/photos?per_page=1&orientation=landscape&content_filter=high&query=' +
    encodeURIComponent(query);

  try {
    // Client-ID auth (not OAuth) is Unsplash's documented scheme for server-side "Demo"/"Production"
    // API keys -- this key must stay server-side (no VITE_ prefix) since it's billed per request.
    const data = await httpsGetJson(url, { Authorization: `Client-ID ${accessKey}` });
    const photo = data?.results?.[0];
    if (!photo) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'No photo found', query }) };
    }

    // Unsplash's API guidelines require attributing the photographer (with a link back to their
    // profile) wherever a photo is displayed -- utm params are their documented attribution format.
    const utm = 'utm_source=battuta_huna&utm_medium=referral';
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        url: photo.urls?.regular,
        creditName: photo.user?.name || null,
        creditUrl: photo.user?.links?.html ? `${photo.user.links.html}?${utm}` : null,
      }),
    };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
