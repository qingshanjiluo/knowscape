const hash = '$2b$10$mC6gK.d8SjoG5gCUGigYJeZPr3hF1rzfyR7UnXk48xGZ3pLFrWrhO';

// Verify with bcryptjs
const bcrypt = require('bcryptjs');
console.log('本地验证:', bcrypt.compareSync('Pipi20100817', hash));

// Test Worker login
fetch('https://knowscape-api.sifangzhiji.workers.dev/api/v1/auth/login', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({username: '最中幻想', password: 'Pipi20100817'})
}).then(r => r.json()).then(d => {
  console.log('API结果:', JSON.stringify(d, null, 2));
}).catch(e => console.log('错误:', e.message));
