import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(
  /      <\/div>\n      <\/div>\n      \{\/\* FAQ SECTION \*\/\}/g,
  `      </div>\n      {/* FAQ SECTION */}`
);

fs.writeFileSync('src/App.tsx', code);
