export default async function(req, context) {
  const url = new URL(req.url);
  const title = url.searchParams.get('title');

  if (!title) {
    return new Response(JSON.stringify({ error: 'Missing title' }), { status: 400 });
  }

  try {
    const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const response = await fetch(wikiUrl, {
      headers: { 'User-Agent': 'BattutaHuna/1.0 (https://battutahuna.com)' }
    });
    const data = await response.json();

    if (data.thumbnail && data.thumbnail.source) {
      const src = data.thumbnail.source.replace(/\/\d+px-/, '/800px-');
      return new Response(JSON.stringify({ url: src, title: data.title }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } else {
      return new Response(JSON.stringify({ error: 'No thumbnail found' }), { status: 404 });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

export const config = {
  path: "/api/wiki-image"
};
