const https = require('https');

function supabaseRequest(path, method, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(process.env.SUPABASE_URL + path);
    const payload = body ? JSON.stringify(body) : null;
    const headers = {
      'apikey': process.env.SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    else headers['Authorization'] = 'Bearer ' + process.env.SUPABASE_ANON_KEY;
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method, headers
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
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

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const { action, email, token, userId, deviceId } = JSON.parse(event.body || '{}');
  const deviceIdHeader = event.headers['x-device-id'];

  try {
    // ── SEND MAGIC LINK ───────────────────────────────────
    if (action === 'sendOtp') {
      const res = await supabaseRequest('/auth/v1/magiclink', 'POST', {
        email,
        options: { shouldCreateUser: true }
      });
      if (res.status !== 200 && res.status !== 204) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: res.body?.msg || res.body?.error_description || 'Failed to send link' }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify({ sent: true }) };
    }

    // ── EXCHANGE TOKEN (magic link callback) ─────────────
    if (action === 'verifyOtp') {
      const res = await supabaseRequest('/auth/v1/verify', 'POST', {
        email, token, type: 'magiclink'
      });
      if (res.status !== 200 || !res.body?.access_token) {
        const errMsg = res.body?.error_description || res.body?.msg || res.body?.message || 'Invalid or expired link';
        return { statusCode: 400, headers, body: JSON.stringify({ error: errMsg }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify({ session: res.body }) };
    }

    // ── GET USER FROM TOKEN ───────────────────────────────
    if (action === 'getUser') {
      const { accessToken } = JSON.parse(event.body || '{}');
      const res = await supabaseRequest('/auth/v1/user', 'GET', null, accessToken);
      if (res.status !== 200) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid token' }) };
      return { statusCode: 200, headers, body: JSON.stringify({ user: res.body }) };
    }

    // ── SIGN OUT ─────────────────────────────────────────
    if (action === 'signOut') {
      if (token) await supabaseRequest('/auth/v1/logout', 'POST', {}, token);
      return { statusCode: 200, headers, body: JSON.stringify({ signedOut: true }) };
    }

    // ── MIGRATE DEVICE TRIPS TO USER ─────────────────────
    if (action === 'migrateTrips') {
      const dId = deviceId || deviceIdHeader;
      if (!dId || !userId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing userId or deviceId' }) };
      const res = await supabaseRequest(
        `/rest/v1/trips?user_id=eq.${dId}&auth_user_id=is.null`,
        'PATCH',
        { auth_user_id: userId },
        process.env.SUPABASE_ANON_KEY
      );
      return { statusCode: 200, headers, body: JSON.stringify({ migrated: true }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };
  } catch(e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
