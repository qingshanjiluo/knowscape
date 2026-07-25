const hash = '$2b$10$VdaQpmFk112JTW.AxMPFmuFlIRtN/qX0Eo/ALYRPASOsMlS6wf6B.';

fetch('https://api.cloudflare.com/client/v4/accounts/664cc8aa94cb585def8d27ec174fa417/d1/database/6e0bb22d-1a1d-4b5b-a647-f2306e991baf/query', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer cfut_5uaDAKIrsykcjxcf3CKfUHmmoomu6reimNuhVPhhcb8e935f',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    sql: `INSERT OR IGNORE INTO users (id, username, email, password_hash, is_admin) VALUES ('admin-001', '最中幻想', 'admin@knowscape.app', '${hash}', 1)`
  })
}).then(r => r.json()).then(d => {
  if (d.success) {
    console.log('✅ 管理员账号已创建到D1');
  } else {
    console.log('❌ 失败:', JSON.stringify(d.errors));
  }
}).catch(e => console.log('错误:', e.message));
