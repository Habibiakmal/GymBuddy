const https = require('https');
const dns = require('dns');

dns.lookup('gymbuddygroup.com', (err, address, family) => {
  console.log('gymbuddygroup.com IP:', address);
});

https.get('https://gymbuddygroup.com', (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('HTML status:', res.statusCode);
    const matches = d.match(/assets\/[^"'\s>]+/g);
    console.log('Assets in HTML:', matches);
    if (matches) {
      matches.forEach(asset => {
        https.get('https://gymbuddygroup.com/' + asset, (aRes) => {
          console.log(asset, 'status:', aRes.statusCode);
        });
      });
    }
  });
}).on('error', e => console.error(e.message));
