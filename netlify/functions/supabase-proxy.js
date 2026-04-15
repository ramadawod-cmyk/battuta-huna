const https = require('https');

function request(method, path, body, prefer) {
  return new Promise((resolve, reject) => {
    const url = new URL(process.env.SUPABASE_URL + path);
    const payload = body ? JSON.stringify(body) : null;

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'apikey': process.env.SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + process.env.SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        'Prefer': prefer ? `return=representation,${prefer}` : 'return=representation'
      }
    };
    if (payload) options.headers['Content-Length'] = Buffer.byteLength(payload);

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

exports.handler = async function(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-device-id'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Supabase not configured' }) };
  }

  try {
    const { action, data } = JSON.parse(event.body || '{}');
    const deviceId = event.headers['x-device-id'] || 'anonymous';

    // ── GET CITIES ───────────────────────────────────
    if (action === 'getCities') {
      const res = await request('GET', '/rest/v1/cities?select=*&order=name');
      return { statusCode: 200, headers, body: JSON.stringify(res.body) };
    }

    // ── GET SITES FOR CITY ───────────────────────────
    if (action === 'getSites') {
      const { cityId } = data;
      const res = await request('GET', `/rest/v1/sites?city_id=eq.${cityId}&select=*&order=name`);
      return { statusCode: 200, headers, body: JSON.stringify(res.body) };
    }

    // ── UPSERT CITY (AI generated) ───────────────────
    if (action === 'upsertCity') {
      const city = data.city;
      const res = await request('POST', '/rest/v1/cities', city, 'resolution=merge-duplicates');
      return { statusCode: 200, headers, body: JSON.stringify(res.body) };
    }

    // ── UPSERT SITE (AI generated) ───────────────────
    if (action === 'upsertSite') {
      const site = data.site;
      const res = await request('POST', '/rest/v1/sites', site, 'resolution=merge-duplicates');
      return { statusCode: 200, headers, body: JSON.stringify(res.body) };
    }

    // ── UPSERT SITES BATCH ───────────────────────────
    if (action === 'upsertSites') {
      const sites = data.sites;
      const res = await request('POST', '/rest/v1/sites', sites, 'resolution=merge-duplicates');
      return { statusCode: 200, headers, body: JSON.stringify(res.body) };
    }

    // ── GET TRIPS ────────────────────────────────────
    if (action === 'getTrips') {
      const res = await request('GET', `/rest/v1/trips?user_id=eq.${deviceId}&select=*&order=created_at.desc`);
      return { statusCode: 200, headers, body: JSON.stringify(res.body) };
    }

    // ── SAVE TRIP ────────────────────────────────────
    if (action === 'saveTrip') {
      const trip = { ...data.trip, user_id: deviceId };
      const res = await request('POST', '/rest/v1/trips', trip);
      return { statusCode: 200, headers, body: JSON.stringify(res.body) };
    }

    // ── DELETE TRIP ──────────────────────────────────
    if (action === 'deleteTrip') {
      const { tripId } = data;
      const res = await request('DELETE', `/rest/v1/trips?id=eq.${tripId}&user_id=eq.${deviceId}`);
      return { statusCode: 200, headers, body: JSON.stringify({ deleted: true }) };
    }

    // ── UPDATE CITY HERO IMAGE ───────────────────────
    if (action === 'updateCityHero') {
      const { cityId, heroImageUrl } = data;
      const res = await request('PATCH', `/rest/v1/cities?id=eq.${cityId}`, { hero_image_url: heroImageUrl });
      return { statusCode: 200, headers, body: JSON.stringify({ updated: true }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };

  } catch(e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
