const https = require('https');
https.get('https://gymbuddygroup.com', res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const scriptMatch = data.match(/src="\/assets\/index[^"]+"/);
    const cssMatch = data.match(/href="\/assets\/index[^"]+"/);
    console.log('Script tag:', scriptMatch ? scriptMatch[0] : 'NOT FOUND');
    console.log('CSS tag:', cssMatch ? cssMatch[0] : 'NOT FOUND');
    console.log('Full HTML length:', data.length);
  });
});
