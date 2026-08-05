import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// 1. Remove one `      </div>` right before `      {/* SECTION 2: AI FEATURES */}`
code = code.replace(
  /      <\/div>\n      \{\/\* SECTION 2: AI FEATURES \*\/\}/g,
  `      {/* SECTION 2: AI FEATURES */}`
);

// 2. Add one `      </div>` right before `      {/* FOOTER */}`
code = code.replace(
  /      \{\/\* FOOTER \*\/\}/g,
  `      </div>\n      {/* FOOTER */}`
);

// 3. Add one `      </div>` right before `        {/* FAQ SECTION */}`
code = code.replace(
  /        \{\/\* FAQ SECTION \*\/\}/g,
  `      </div>\n        {/* FAQ SECTION */}`
);

fs.writeFileSync('src/App.tsx', code);
