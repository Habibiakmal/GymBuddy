const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

const replacements = [
  [
    `>Recovery Intelligence<`,
    `>{language === "EN" ? "Recovery Intelligence" : "Kecerdasan Pemulihan"}<`
  ],
  [
    `>Wearable Integration<`,
    `>{language === "EN" ? "Wearable Integration" : "Integrasi Wearable"}<`
  ],
  [
    `>Priority AI Processing<`,
    `>{language === "EN" ? "Priority AI Processing" : "Pemrosesan AI Prioritas"}<`
  ]
];

for (const [search, replace] of replacements) {
  content = content.replace(search, replace);
}

fs.writeFileSync('src/App.tsx', content);
