exports.handler = async function(event) {
  const title = event.queryStringParameters && event.queryStringParameters.title;
  if (!title) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing title' }) };
  }

  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'BattutaHuna/1.0 (https://battutahuna.com)' }
    });
    const data = await response.json();

    if (data.thumbnail && data.thumbnail.source) {
      // Upgrade to larger size
      const src = data.thumbnail.source.replace(/\/\d+px-/, '/800px-');
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=86400', // cache 24h
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ url: src, title: data.title })
      };
    } else {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'No thumbnail found', title: data.title })
      };
    }
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message })
    };
  }
};
