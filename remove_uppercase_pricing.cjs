const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Replace /month
content = content.replace(/>\/month</g, '>{language === "EN" ? "/month" : "/bulan"}<');

// Remove uppercase class from /month spans
content = content.replace(/text-xs font-bold mt-1 text-neutral-400 uppercase/g, 'text-xs font-bold mt-1 text-neutral-400');
content = content.replace(/text-xs font-bold mt-1 text-neutral-500 uppercase/g, 'text-xs font-bold mt-1 text-neutral-500');

// AI Voice Coach
content = content.replace(/AI Voice Coach/g, '{language === "EN" ? "AI Voice Coach" : "Pelatih Suara AI"}');
content = content.replace(/Vision<br \/>Form Check/g, '{language === "EN" ? <>Vision<br />Form Check</> : <>Pemeriksaan<br />Postur Visi</>}');

fs.writeFileSync('src/App.tsx', content);
