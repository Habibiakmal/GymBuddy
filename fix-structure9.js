import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(
  /      <\/div>\n\n      \{\/\* FOOTER \*\/\}/g,
  `      {/* FOOTER */}`
);

fs.writeFileSync('src/App.tsx', code);
