const https = require('https');

function api(url, body = null, method = 'POST') {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = {
      hostname: 'api.cloudflare.com', path: u.pathname + u.search, method,
      headers: { 'Authorization': 'Bearer cfut_5uaDAKIrsykcjxcf3CKfUHmmoomu6reimNuhVPhhcb8e935f', 'Content-Type': 'application/json' }
    };
    const req = https.request(opts, res => {
      let b = ''; res.on('data', c => b += c);
      res.on('end', () => resolve(b));
    });
    req.on('error', reject);
    req.setTimeout(30000);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Drop and recreate user_points with correct schema
  const dbQ = "https://api.cloudflare.com/client/v4/accounts/664cc8aa94cb585def8d27ec174fa417/d1/database/6e0bb22d-1a1d-4b5b-a647-f2306e991baf/query";

  // First check user_points
  const r1 = await api(dbQ, { sql: "SELECT sql FROM sqlite_master WHERE type='table' AND name='user_points'" });
  console.log('user_points schema:', r1);

  // Check users
  const r2 = await api(dbQ, { sql: "SELECT sql FROM sqlite_master WHERE type='table' AND name='users'" });
  console.log('users schema:', r2);
}
main().catch(e => console.log('Error:', e));
