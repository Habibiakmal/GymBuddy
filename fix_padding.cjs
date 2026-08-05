const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Section 2: AI FEATURES
content = content.replace(
  /<div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 2xl:gap-32 items-center">/,
  '<div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 2xl:gap-32 items-center px-6 md:px-10 lg:px-12">'
);

// Section 3: BENTO GRID
content = content.replace(
  /<div className="bg-\\[#151515\\] rounded-\\[2.5rem\\] 2xl:rounded-\\[3.5rem\\] p-4 md:p-6 lg:p-8 2xl:p-12 text-white shadow-2xl">/,
  '<div className="bg-[#151515] rounded-[2.5rem] 2xl:rounded-[3.5rem] p-6 md:p-10 lg:p-12 text-white shadow-2xl">'
);

// Section 4: HOW IT WORKS
content = content.replace(
  /<div className="py-6 md:py-10 2xl:py-14 w-full flex flex-col">/,
  '<div className="py-6 md:py-10 2xl:py-14 px-6 md:px-10 lg:px-12 w-full flex flex-col">'
);

// Section 5: PRICING
content = content.replace(
  /<div className="w-full bg-\\[#0D0D0D\\] rounded-\\[2rem\\] 2xl:rounded-\\[3rem\\] p-6 md:p-12 lg:p-16 2xl:p-20 relative overflow-hidden flex flex-col">/,
  '<div className="w-full bg-[#0D0D0D] rounded-[2rem] 2xl:rounded-[3rem] p-6 md:p-10 lg:p-12 relative overflow-hidden flex flex-col">'
);

// FOOTER
content = content.replace(
  /<footer className="w-full bg-white text-neutral-900 pt-16 md:pt-24 pb-8">/,
  '<footer className="w-full bg-white text-neutral-900 pt-16 md:pt-24 pb-8 px-6 md:px-10 lg:px-12">'
);

fs.writeFileSync('src/App.tsx', content);
