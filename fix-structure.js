import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// 1. Find the closing div of space-y-24 that's right after HERO section.
// The HERO section ends around line 490 (before SECTION 2)
// Actually we can just find:
//       </div>
//     </div>
// 
//     {/* SECTION 2: AI FEATURES */}
// And remove one of those `</div>`s, then add it right before `      {/* FOOTER */}`

code = code.replace(
  `        </div>\n      </div>\n    </div>\n\n    {/* SECTION 2: AI FEATURES */}`,
  `        </div>\n      </div>\n\n    {/* SECTION 2: AI FEATURES */}`
);

// 2. Add the removed `</div>` back before FOOTER
code = code.replace(
  `      {/* FOOTER */}`,
  `      </div>\n      {/* FOOTER */}`
);

// 3. Close the PRICING section's `div.px-4` before FAQ section
code = code.replace(
  `        </div>\n\n        {/* FAQ SECTION */}`,
  `        </div>\n      </div>\n\n      {/* FAQ SECTION */}`
);

fs.writeFileSync('src/App.tsx', code);
