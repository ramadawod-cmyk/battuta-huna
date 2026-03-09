const https = require('https');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'BattutaHuna/1.0 (https://battutahuna.com)' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

exports.handler = async function(event) {
  const title = event.queryStringParameters && event.queryStringParameters.title;

  if (!title) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing title' }) };
  }

  try {
    const wikiUrl = 'https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title);
    const data = await httpsGet(wikiUrl);

    if (data.thumbnail && data.thumbnail.source) {
      const src = data.thumbnail.source.replace(/\/\d+px-/, '/800px-');
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ url: src, title: data.title })
      };
    } else {
      return { statusCode: 404, body: JSON.stringify({ error: 'No thumbnail found' }) };
    }
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
```

**4. Scroll down and click "Commit changes"**

**5. Wait ~30 seconds for Netlify to redeploy, then open this in your browser:**
```
https://battutahuna.com/.netlify/functions/wiki-image?title=Colosseum
