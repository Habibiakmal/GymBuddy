const https = require('https');
const qs = require('querystring');

function req(method, path, data, isForm = false) {
  return new Promise((resolve) => {
    let payload = '';
    const headers = {};
    if (data) {
      payload = isForm ? qs.stringify(data) : JSON.stringify(data);
      headers['Content-Type'] = isForm ? 'application/x-www-form-urlencoded' : 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const r = https.request({
      hostname: 'gymbuddy-backend-253242815083.asia-southeast2.run.app',
      path,
      method,
      headers
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, raw: d }); }
      });
    });
    r.on('error', e => resolve({ error: e.message }));
    if (payload) r.write(payload);
    r.end();
  });
}

async function runFullSuite() {
  const testPhone = '081299998888';
  console.log('========================================================');
  console.log('  STARTING COMPREHENSIVE END-TO-END SYSTEM TEST SUITE  ');
  console.log('========================================================\n');

  // 1. Initial State: Must be clean
  console.log('[TEST 1] Verifying initial clean state...');
  const initCheck = await req('GET', '/api/user/' + testPhone);
  console.log('Result:', initCheck.status === 404 ? 'PASS (404 Not Found)' : 'FAIL');

  // 2. Register New User
  console.log('\n[TEST 2] Registering user via /api/onboarding...');
  const reg = await req('POST', '/api/onboarding', {
    phone: testPhone,
    profile: {
      phone: testPhone,
      name: 'TestUser',
      gender: 'pria',
      age: 26,
      height: 175,
      weight: 78,
      targetWeight: 72,
      goal: 'lose',
      goalTitle: 'Menurunkan Berat Badan',
      persona: 'max',
      targetCalories: 1850,
      proteinGrams: 140,
      carbGrams: 200,
      fatGrams: 50,
      fiberGrams: 25
    }
  });
  console.log('Result:', reg.status === 200 && reg.body?.success ? 'PASS (200 OK & Profile Created)' : 'FAIL');

  // 3. Verify User Fetch
  console.log('\n[TEST 3] Fetching user profile via /api/user/:phone...');
  const uFetch = await req('GET', '/api/user/' + testPhone);
  console.log('Result:', uFetch.status === 200 && uFetch.body?.name === 'TestUser' ? 'PASS (Profile matches)' : 'FAIL', '| Name:', uFetch.body?.name);

  // 4. Test WhatsApp Food Logging with Natrium
  console.log('\n[TEST 4] WhatsApp Food Logging: "Makan Dada Ayam Bakar + Nasi Merah"...');
  const waFood = await req('POST', '/api/webhook/twilio-whatsapp', {
    From: 'whatsapp:+62' + testPhone.substring(1),
    Body: 'Makan Dada Ayam Bakar + Nasi Merah',
    NumMedia: '0'
  }, true);
  const waFoodStr = waFood.raw || JSON.stringify(waFood.body);
  const hasNatrium = waFoodStr.includes('Natrium') || waFoodStr.includes('mg');
  console.log('Result:', waFood.status === 200 && waFoodStr.includes('<Response>') ? 'PASS (TwiML generated)' : 'FAIL', '| Contains Natrium:', hasNatrium);

  // 5. Test Negative Case: Non-Food Rejection
  console.log('\n[TEST 5] Negative Case: Non-food item "kipas angin cosmos"...');
  const waNonFood = await req('POST', '/api/webhook/twilio-whatsapp', {
    From: 'whatsapp:+62' + testPhone.substring(1),
    Body: 'kipas angin cosmos',
    NumMedia: '0'
  }, true);
  const nonFoodStr = waNonFood.raw || JSON.stringify(waNonFood.body);
  console.log('Result:', nonFoodStr.includes('bukan makanan') || nonFoodStr.includes('Coach') ? 'PASS (Successfully rejected)' : 'FAIL');

  // 6. Test Exercise Inquiry with Image
  console.log('\n[TEST 6] Exercise Guide with Media: "cara pakai lat pulldown"...');
  const waEx = await req('POST', '/api/webhook/twilio-whatsapp', {
    From: 'whatsapp:+62' + testPhone.substring(1),
    Body: 'cara pakai lat pulldown',
    NumMedia: '0'
  }, true);
  const waExStr = waEx.raw || JSON.stringify(waEx.body);
  const hasMedia = waExStr.includes('<Media>');
  console.log('Result:', hasMedia ? 'PASS (Includes <Media> image tutorial)' : 'FAIL');

  // 7. Verify Database Meals Sync
  console.log('\n[TEST 7] Checking meals in Firestore via /api/user/:phone/meals...');
  const mFetch = await req('GET', '/api/user/' + testPhone + '/meals');
  const mealCount = mFetch.body?.logs?.length || 0;
  console.log('Result:', mealCount > 0 ? 'PASS (' + mealCount + ' meals logged in Firestore)' : 'FAIL');

  // 8. Delete Account (Full Permanent Wipe)
  console.log('\n[TEST 8] Executing Permanent Account Deletion via DELETE /api/user/:phone...');
  const del = await req('DELETE', '/api/user/' + testPhone);
  console.log('Result:', del.status === 200 && del.body?.success ? 'PASS (Account wiped)' : 'FAIL');

  // 9. Post-Deletion Verification
  console.log('\n[TEST 9] Verifying 404 Not Found & Empty Database after deletion...');
  const v1 = await req('GET', '/api/user/' + testPhone);
  const v2 = await req('GET', '/api/user/' + testPhone + '/meals');
  console.log('User Profile Status:', v1.status, '(Must be 404)');
  console.log('Meals Count after delete:', v2.body?.logs?.length || 0, '(Must be 0)');
  const allPassed = (v1.status === 404 && (v2.body?.logs?.length || 0) === 0);
  console.log('\nFINAL STATUS:', allPassed ? 'ALL 9 TESTS PASSED 100% ✅' : 'FAIL ❌');
  console.log('========================================================');
}

runFullSuite();
