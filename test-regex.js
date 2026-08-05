import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf-8');
console.log(code.includes("      </div>\n      {/* SECTION 2: AI FEATURES */}"));
