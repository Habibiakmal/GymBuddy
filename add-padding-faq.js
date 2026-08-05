import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(
  `      {/* FAQ SECTION */}\n      <div className="w-full flex flex-col px-6 md:px-10 lg:px-12">`,
  `      {/* FAQ SECTION */}\n      <div className="w-full flex flex-col px-6 md:px-10 lg:px-12 py-16 md:py-24 2xl:py-32">`
);

fs.writeFileSync('src/App.tsx', code);
