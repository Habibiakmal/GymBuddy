const https = require('https');
let checks = 0;

function checkBackend() {
  checks++;
  const req = https.request({
    hostname: 'gymbuddygroup.com',
    path: '/api/auth/login-verify-otp',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
  }, (res) => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      const isJson = res.headers['content-type'] && res.headers['content-type'].includes('application/json');
      if (isJson) {
        console.log('BACKEND LIVE! New server responding JSON after', checks, 'checks. Body:', d.substring(0, 100));
        process.exit(0);
      } else {
        console.log(`[Check ${checks}] Backend still old (HTML response)...`);
        setTimeout(checkBackend, 30000);
      }
    });
  });
  req.write('{}');
  req.end();
  req.on('error', (e) => {
    console.error('Error:', e.message);
    setTimeout(checkBackend, 30000);
  });
}

checkBackend();
