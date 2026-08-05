import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// Find Section 5
const section5Start = code.indexOf('{/* SECTION 5: PRICING */}');
const section5End = code.indexOf('{/* FAQ SECTION */}');

if (section5Start !== -1 && section5End !== -1) {
  let section5Code = code.substring(section5Start, section5End);
  
  // Free and Elite tier text colors
  section5Code = section5Code.replace(/text-white/g, 'text-neutral-900');
  section5Code = section5Code.replace(/text-neutral-300/g, 'text-neutral-600');
  section5Code = section5Code.replace(/text-neutral-400/g, 'text-neutral-500');
  
  code = code.substring(0, section5Start) + section5Code + code.substring(section5End);
}

fs.writeFileSync('src/App.tsx', code);
