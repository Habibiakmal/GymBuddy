import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// Wrap Section 3 in px-4 md:px-6 lg:px-8
const sec3Start = code.indexOf('{/* SECTION 3: BENTO GRID */}');
const sec4Start = code.indexOf('{/* SECTION 4: HOW IT WORKS */}');

if (sec3Start !== -1 && sec4Start !== -1) {
  let section3Code = code.substring(sec3Start, sec4Start);
  
  // Replace the first div in Section 3
  section3Code = section3Code.replace(
    `<div className="bg-[#151515] rounded-[2.5rem] 2xl:rounded-[3.5rem] p-6 md:p-10 lg:p-12 text-white shadow-2xl">`,
    `<div className="px-4 md:px-6 lg:px-8">\n        <div className="bg-[#151515] rounded-[2.5rem] 2xl:rounded-[3.5rem] p-6 md:p-10 lg:p-12 text-white shadow-2xl">`
  );
  
  // Add closing div at the end of Section 3
  // Find the last </div> before sec4Start in section3Code
  // Since we know the structure, it's:
  //            </div>
  //         </div>
  //         {/* SECTION 4
  section3Code = section3Code.replace(
    `           </div>\n        </div>\n`,
    `           </div>\n        </div>\n        </div>\n`
  );
  
  code = code.substring(0, sec3Start) + section3Code + code.substring(sec4Start);
}

// Button arrow color in Section 5
// Replace the white button with black/dark button
code = code.replace(
  `<button className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white flex items-center justify-center hover:bg-neutral-200 transition-colors">\n                <ArrowRight className="w-5 h-5 text-black" />`,
  `<button className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-neutral-900 flex items-center justify-center hover:bg-black transition-colors">\n                <ArrowRight className="w-5 h-5 text-white" />`
);


fs.writeFileSync('src/App.tsx', code);
