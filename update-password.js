const hash = '$2b$10$mC6gK.d8SjoG5gCUGigYJeZPr3hF1rzfyR7UnXk48xGZ3pLFrWrhO';

fetch('https://api.cloudflare.com/client/v4/accounts/664cc8aa94cb585def8d27ec174fa417/d1/database/6e0bb22d-1a1d-4b5b-a647-f2306e991baf/query', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer cfut_5uaDAKIrsykcjxcf3CKfUHmmoomu6reimNuhVPhhcb8e935f',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    sql: `UPDATE users SET password_hash = '${hash}' WHERE username = '最中幻想'`
  })
}).then(r => r.json()).then(d => {
  if (d.success) console.log('✅ 密码哈希已更新');
  else console.log('❌', JSON.stringify(d.errors));
}).catch(e => console.log('错误:', e.message));
