const { Firestore } = require('./node_modules/@google-cloud/firestore');

async function auditFirestoreDirect() {
  console.log("Checking Cloud Firestore database directly...");
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0130714675";
  
  try {
    const firestore = new Firestore({ projectId });

    // 1. Check 'users' collection
    const usersSnap = await firestore.collection('users').get();
    console.log(`\n1. Collection 'users': ${usersSnap.size} document(s)`);
    usersSnap.docs.forEach((doc, i) => {
      const data = doc.data();
      console.log(`   [${i + 1}] ID: ${doc.id} | Nama: ${data.name || 'N/A'} | HP: ${data.phone || 'N/A'} | Persona: ${data.persona || 'N/A'}`);
    });

    // 2. Check 'subscriptions' collection
    const subSnap = await firestore.collection('subscriptions').get();
    console.log(`\n2. Collection 'subscriptions': ${subSnap.size} document(s)`);
    subSnap.docs.forEach((doc, i) => {
      const data = doc.data();
      console.log(`   [${i + 1}] ID: ${doc.id} | HP: ${data.phone || 'N/A'} | Plan: ${data.plan || 'N/A'} | Status: ${data.status || 'N/A'}`);
    });

    // 3. Check 'appdata' snapshot collection
    const appDataDoc = await firestore.collection('appdata').doc('main').get();
    console.log(`\n3. Collection 'appdata/main': ${appDataDoc.exists ? 'EXISTS' : 'NOT FOUND'}`);
    if (appDataDoc.exists) {
      const data = appDataDoc.data();
      const users = data?.users || {};
      const userKeys = Object.keys(users);
      console.log(`   Total users in appdata snapshot: ${userKeys.length}`);
      userKeys.forEach(k => console.log(`   * ${k}: ${users[k]?.name} (${users[k]?.phone})`));
    }

  } catch (err) {
    console.error("Firestore direct query note:", err.message);
  }
}

auditFirestoreDirect();
