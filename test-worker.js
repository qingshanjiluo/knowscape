const https = require('https');

function request(url, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = {
      hostname: u.hostname, path: u.pathname + u.search, method,
      headers: { 'Content-Type': 'application/json', ...headers }
    };
    const req = https.request(opts, res => {
      let b = '';
      res.on('data', chunk => b += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Test 1: health
  console.log('=== Test 1: Health check ===');
  try {
    const r = await request('https://knowscape-api.sifangzhiji.workers.dev/api/v1/health');
    console.log('Status:', r.status, 'Body:', r.body);
  } catch(e) { console.log('Error:', e.message); }

  // Test 2: login
  console.log('\n=== Test 2: Login ===');
  try {
    const r = await request('https://knowscape-api.sifangzhiji.workers.dev/api/v1/auth/login', 'POST', {
      username: '最中幻想', password: 'Pipi20100817'
    });
    console.log('Status:', r.status, 'Body:', r.body);
  } catch(e) { console.log('Error:', e.message); }

  // Test 3: login via Pages proxy
  console.log('\n=== Test 3: Login via Pages ===');
  try {
    const r = await request('https://1dce5214.knowscape.pages.dev/api/v1/auth/login', 'POST', {
      username: '最中幻想', password: 'Pipi20100817'
    });
    console.log('Status:', r.status, 'Body:', r.body);
  } catch(e) { console.log('Error:', e.message); }
}
main();
