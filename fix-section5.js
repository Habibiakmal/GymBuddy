import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// Restore outer wrapper padding
code = code.replace(
  `{/* SECTION 5: PRICING */}\n        <div className="w-full">`,
  `{/* SECTION 5: PRICING */}\n        <div className="px-4 md:px-6 lg:px-8">`
);

// Add bg and rounded to inner wrapper
code = code.replace(
  `<div className="w-full py-16 md:py-24 lg:py-32 px-6 md:px-10 lg:px-12 relative overflow-hidden flex flex-col">`,
  `<div className="w-full bg-[#0D0D0D] rounded-[2rem] 2xl:rounded-[3rem] py-16 md:py-24 lg:py-32 px-6 md:px-10 lg:px-12 relative overflow-hidden flex flex-col">`
);

// Restore heading color to white
code = code.replace(
  `<h2 className="font-['Archivo_Black'] font-normal text-3xl md:text-5xl lg:text-6xl 2xl:text-7xl uppercase tracking-tighter leading-[1] md:leading-[0.95] text-neutral-900">`,
  `<h2 className="font-['Archivo_Black'] font-normal text-3xl md:text-5xl lg:text-6xl 2xl:text-7xl uppercase tracking-tighter leading-[1] md:leading-[0.95] text-white">`
);

fs.writeFileSync('src/App.tsx', code);
