const https = require('https');

const opts = {
  hostname: 'api.cloudflare.com',
  path: '/client/v4/accounts/664cc8aa94cb585def8d27ec174fa417/workers/scripts/knowscape-api/content',
  method: 'GET',
  headers: { 'Authorization': 'Bearer cfut_5uaDAKIrsykcjxcf3CKfUHmmoomu6reimNuhVPhhcb8e935f' }
};

const req = https.request(opts, res => {
  let b = Buffer.alloc(0);
  res.on('data', chunk => b = Buffer.concat([b, chunk]));
  res.on('end', () => {
    const content = b.toString('utf-8');
    if (content.includes('.bind(username).first()')) {
      console.log('✅ Worker代码包含.bind()修复');
    } else {
      console.log('❌ Worker代码不包含.bind()修复');
    }
    const loginIdx = content.indexOf('auth/login');
    if (loginIdx >= 0) {
      console.log('login位置附近:', content.substring(loginIdx - 30, loginIdx + 100));
    }
  });
});
req.on('error', e => console.log('Error:', e));
req.end();
