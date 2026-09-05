const https = require('https');
const runId = 33861947898;
let checks = 0;

function check() {
  checks++;
  https.get('https://api.github.com/repos/Habibiakmal/GymBuddy/actions/runs/' + runId, {
    headers: { 'User-Agent': 'Node.js' }
  }, (res) => {
    let d = '';
    res.on('data', chunk => d += chunk);
    res.on('end', () => {
      try {
        const run = JSON.parse(d);
        console.log(`[Check ${checks}] Status: ${run.status}, Conclusion: ${run.conclusion}`);
        if (run.status === 'completed') {
          if (run.conclusion === 'success') {
            console.log('🎉 Deployment succeeded!');
            process.exit(0);
          } else {
            console.error('❌ Deployment concluded with status: ' + run.conclusion);
            process.exit(1);
          }
        } else {
          setTimeout(check, 10000);
        }
      } catch (e) {
        console.error('Parse error:', e.message);
        setTimeout(check, 10000);
      }
    });
  }).on('error', (err) => {
    console.error('Network error:', err.message);
    setTimeout(check, 10000);
  });
}

check();
