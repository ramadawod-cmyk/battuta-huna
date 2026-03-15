const https = require('https');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'BattutaHuna/1.0 (https://battutahuna.com)' },
      timeout: 8000
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpsGet(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (!data) return reject(new Error('Empty response'));
        const first = data.trimStart()[0];
        if (first !== '{' && first !== '[') {
          return reject(new Error('Non-JSON response: ' + data.slice(0, 80)));
        }
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse error: ' + data.slice(0, 80))); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
  });
}

function httpsGetBinary(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'BattutaHuna/1.0 (https://battutahuna.com)',
        'Referer': 'https://en.wikipedia.org/'
      },
      timeout: 8000
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
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
  });
}

exports.handler = async function(event) {
  const params = event.queryStringParameters || {};

  // Mode 2: proxy image bytes
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
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: e.message })
      };
    }
  }

  // Mode 1: resolve wiki title → thumbnail URL
  if (!params.title) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing title' })
    };
  }

  try {
    // Netlify decodes query params once already, so title arrives decoded
    // Just encode it cleanly for the Wikipedia API
    const title = params.title;
    const wikiUrl = 'https://en.wikipedia.org/api/rest_v1/page/summary/' +
      encodeURIComponent(title);

    const data = await httpsGet(wikiUrl);

    if (data.thumbnail && data.thumbnail.source) {
      const src = data.thumbnail.source.replace(/\/\d+px-/, '/800px-');
      // Decode first in case Wikipedia URL already has encoded chars, then encode once cleanly
      const cleanSrc = encodeURIComponent(decodeURIComponent(src));
      const proxied = '/.netlify/functions/wiki-image?img=' + cleanSrc;
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ url: proxied, title: data.title })
      };
    }

    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'No thumbnail', page: data.title || title })
    };

  } catch (e) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: e.message })
    };
  }
};
