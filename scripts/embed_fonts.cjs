const fs = require('fs');
const path = require('path');

const fonts = ['arial.ttf', 'arialbd.ttf'];
const fontDir = path.join(__dirname, '..', 'fonts');

for (const f of fonts) {
  const p = path.join(fontDir, f);
  if (fs.existsSync(p)) {
    const b64 = fs.readFileSync(p).toString('base64');
    console.log(`${f}: ${b64.length} base64 chars (~${Math.round(b64.length * 0.75 / 1024)}KB)`);
  } else {
    console.log(`NOT FOUND: ${p}`);
  }
}
