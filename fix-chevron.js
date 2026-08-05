import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(
  `<button className="w-11 h-11 md:w-12 md:h-12 rounded-full border border-neutral-700 bg-neutral-900 flex items-center justify-center text-neutral-900 hover:bg-neutral-800 transition-colors focus:outline-none">`,
  `<button className="w-11 h-11 md:w-12 md:h-12 rounded-full border border-neutral-700 bg-neutral-900 flex items-center justify-center text-white hover:bg-neutral-800 transition-colors focus:outline-none">`
);

fs.writeFileSync('src/App.tsx', code);
