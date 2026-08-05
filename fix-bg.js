import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// Section 4
code = code.replace(
  `className="py-6 md:py-10 2xl:py-14 px-6 md:px-10 lg:px-12 w-full flex flex-col bg-[#111111] text-white overflow-hidden relative"`,
  `className="py-16 md:py-24 2xl:py-32 px-6 md:px-10 lg:px-12 w-full flex flex-col overflow-hidden relative"`
);

// Section 4 Heading text color
code = code.replace(
  `tracking-tighter leading-[0.9] mb-4 text-white"`,
  `tracking-tighter leading-[0.9] mb-4 text-neutral-900"`
);

// Section 5 wrapper and bg
code = code.replace(
  `className="w-full bg-[#0D0D0D] rounded-[2rem] 2xl:rounded-[3rem] p-6 md:p-10 lg:p-12 relative overflow-hidden flex flex-col"`,
  `className="w-full py-16 md:py-24 lg:py-32 relative overflow-hidden flex flex-col"`
);

code = code.replace(
  `leading-[1] md:leading-[0.95] text-white"`,
  `leading-[1] md:leading-[0.95] text-neutral-900"`
);

code = code.replace(
  `className="w-full md:w-1/3 bg-[#222222] rounded-3xl p-6 md:p-8 flex flex-col min-h-[460px] 2xl:min-h-[500px]"`,
  `className="w-full md:w-1/3 bg-[#F5F5F5] rounded-3xl p-6 md:p-8 flex flex-col min-h-[460px] 2xl:min-h-[500px]"`
);

code = code.replace(
  `className="w-full md:w-1/3 bg-[#222222] rounded-3xl p-6 md:p-8 flex flex-col min-h-[460px] 2xl:min-h-[500px]"`,
  `className="w-full md:w-1/3 bg-[#F5F5F5] rounded-3xl p-6 md:p-8 flex flex-col min-h-[460px] 2xl:min-h-[500px]"`
);

fs.writeFileSync('src/App.tsx', code);
