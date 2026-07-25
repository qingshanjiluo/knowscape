const https = require('https');

function api(path) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.cloudflare.com',
      path: '/client/v4/accounts/664cc8aa94cb585def8d27ec174fa417/workers/scripts/knowscape-api' + path,
      method: 'GET',
      headers: {
        'Authorization': 'Bearer cfut_5uaDAKIrsykcjxcf3CKfUHmmoomu6reimNuhVPhhcb8e935f',
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  // Get tails
  const r = await api('/tails');
  console.log(JSON.stringify(r, null, 2));
}
main().catch(e => console.log('错误:', e));
