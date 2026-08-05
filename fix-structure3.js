import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// Replace using a more flexible regex that handles \r\n and varying spaces
code = code.replace(
  /<\/div>\s*\{\/\* SECTION 2: AI FEATURES \*\/\}/g,
  `{/* SECTION 2: AI FEATURES */}`
);

code = code.replace(
  /\{\/\* FOOTER \*\/\}/g,
  `</div>\n      {/* FOOTER */}`
);

code = code.replace(
  /\{\/\* FAQ SECTION \*\/\}/g,
  `</div>\n      {/* FAQ SECTION */}`
);

fs.writeFileSync('src/App.tsx', code);
