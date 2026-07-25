const https = require('https');

function queryD1(sql) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ sql });
    const req = https.request({
      hostname: 'api.cloudflare.com',
      path: '/client/v4/accounts/664cc8aa94cb585def8d27ec174fa417/d1/database/6e0bb22d-1a1d-4b5b-a647-f2306e991baf/query',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer cfut_5uaDAKIrsykcjxcf3CKfUHmmoomu6reimNuhVPhhcb8e935f',
        'Content-Type': 'application/json',
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  // Check current hash
  const r1 = await queryD1("SELECT password_hash FROM users WHERE username='最中幻想'");
  console.log('当前哈希:', r1.result?.[0]?.results?.[0]?.password_hash);
  
  // Test locally
  const bcrypt = require('bcryptjs');
  const currentHash = r1.result?.[0]?.results?.[0]?.password_hash;
  if (currentHash) {
    console.log('bcryptjs验证:', bcrypt.compareSync('Pipi20100817', currentHash));
  }
  
  // Update if needed
  if (!currentHash || !bcrypt.compareSync('Pipi20100817', currentHash)) {
    const newHash = bcrypt.hashSync('Pipi20100817', 10);
    console.log('新哈希:', newHash);
    const r2 = await queryD1(`UPDATE users SET password_hash = '${newHash}' WHERE username = '最中幻想'`);
    console.log('更新结果:', r2.success ? '✅' : '❌');
    
    // Verify
    const r3 = await queryD1("SELECT password_hash FROM users WHERE username='最中幻想'");
    const newHash2 = r3.result?.[0]?.results?.[0]?.password_hash;
    console.log('更新后验证:', bcrypt.compareSync('Pipi20100817', newHash2));
  }
}

main().catch(e => console.log('错误:', e));
