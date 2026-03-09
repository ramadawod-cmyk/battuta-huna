const https = require('https');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'BattutaHuna/1.0 (https://battutahuna.com)' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpsGet(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse error')); }
      });
    }).on('error', reject);
  });
}

function httpsGetBinary(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'BattutaHuna/1.0 (https://battutahuna.com)',
        'Referer': 'https://en.wikipedia.org/'
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpsGetBinary(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({
        buffer: Buffer.concat(chunks),
        contentType: res.headers['content-type'] || 'image/jpeg'
      }));
    }).on('error', reject);
  });
}

exports.handler = async function(event) {
  const params = event.queryStringParameters || {};

  // Mode 2: proxy image bytes (bypasses Wikimedia hotlink protection)
  if (params.img) {
    try {
      const decoded = decodeURIComponent(params.img);
      const { buffer, contentType } = await httpsGetBinary(decoded);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=604800',
          'Access-Control-Allow-Origin': '*'
        },
        body: buffer.toString('base64'),
        isBase64Encoded: true
      };
    } catch (e) {
      return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
    }
  }

  // Mode 1: get Wikipedia thumbnail URL for a page title
  if (!params.title) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing title' }) };
  }

  try {
    // Title arrives already URL-decoded by Netlify, or percent-encoded once
    // Normalize: decode if encoded, then re-encode cleanly for Wikipedia API
    let title = params.title;
    try { title = decodeURIComponent(title); } catch(e) { /* use as-is */ }

    const wikiUrl = 'https://en.wikipedia.org/api/rest_v1/page/summary/' +
      encodeURIComponent(title);

    const data = await httpsGet(wikiUrl);

    if (data.thumbnail && data.thumbnail.source) {
      const src = data.thumbnail.source.replace(/\/\d+px-/, '/800px-');
      const proxied = '/.netlify/functions/wiki-image?img=' + encodeURIComponent(src);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ url: proxied, title: data.title })
      };
    } else {
      return { statusCode: 404, body: JSON.stringify({ error: 'No thumbnail', page: data.title }) };
    }
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
