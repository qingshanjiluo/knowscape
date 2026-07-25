const https = require('https');

function api(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.cloudflare.com',
      path: '/client/v4/accounts/664cc8aa94cb585def8d27ec174fa417/workers/scripts/knowscape-api' + path,
      method,
      headers: { 'Authorization': 'Bearer cfut_5uaDAKIrsykcjxcf3CKfUHmmoomu6reimNuhVPhhcb8e935f' }
    };
    if (body) { opts.headers['Content-Type'] = 'application/json'; }
    const req = https.request(opts, res => {
      let b = '';
      res.on('data', chunk => b += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(b)); } catch(e) { resolve(b); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Get version IDs
  const r = await api('/versions');
  console.log('versions:', r);
  
  // Try to get the worker content
  const r2 = await api('/content/v2');
  console.log('content type:', typeof r2);
}
main().catch(e => console.log('错误:', e));
