const https = require('https');

function api(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.cloudflare.com',
      path: '/client/v4/accounts/664cc8aa94cb585def8d27ec174fa417' + path,
      method,
      headers: { 'Authorization': 'Bearer cfut_5uaDAKIrsykcjxcf3CKfUHmmoomu6reimNuhVPhhcb8e935f' }
    };
    if (body) { opts.headers['Content-Type'] = 'application/json'; }
    const req = https.request(opts, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try { resolve(JSON.parse(b)); } catch(e) { resolve({ error: b.substring(0, 500) }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Try to create a tail
  const r = await api('POST', '/workers/scripts/knowscape-api/tails', {});
  console.log('Tail create:', r.success ? 'success' : 'failed');
  if (!r.success) {
    // Just do a direct health check
    console.log(r);
  } else {
    console.log('Tail URL:', r.result?.url);
  }
}
main().catch(e => console.log('Error:', e));
