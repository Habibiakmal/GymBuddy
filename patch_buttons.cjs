const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Button 1
content = content.replace(
  /boxShadow: "0 0 24px rgba\(212,255,0,0\.4\)",[\s\S]*?className="hidden lg:block bg#D4FF00 text-black px-6 py-3 rounded-full hover:bg#c4ec00 transition-colors"[\s\S]*?\{language === "EN" \? "Try for free" : "Coba Gratis"\}/.source.replace(/#/g, '\\[#'),
  `boxShadow: "0 0 24px rgba(16,185,129,0.4)",
                  }}
                  transition={{ duration: 0.2 }}
                  onClick={() => setIsAppOnboarding(true)}
                  className="hidden lg:block bg-[#10B981] text-white px-6 py-3 rounded-full hover:bg-[#059669] transition-colors"
                >
                  {language === "EN" ? "Try for free" : "Coba Gratis"}`
);

// Button 2
content = content.replace(
  /boxShadow: "0 0 24px rgba\(212,255,0,0\.4\)",[\s\S]*?className="bg#D4FF00 text-black px-6 py-3 md:px-8 md:py-4 2xl:px-10 2xl:py-5 rounded-full font-bold flex items-center justify-center sm:justify-start gap-3 hover:bg#c4ec00 transition-colors text-base md:text-lg 2xl:text-xl w-full sm:w-auto group"[\s\S]*?\{language === "EN" \? "Try for free" : "Coba Gratis"\}/.source.replace(/#/g, '\\[#'),
  `boxShadow: "0 0 24px rgba(16,185,129,0.4)",
                    }}
                    transition={{ duration: 0.2 }}
                    onClick={() => setIsAppOnboarding(true)}
                    className="bg-[#10B981] text-white px-6 py-3 md:px-8 md:py-4 2xl:px-10 2xl:py-5 rounded-full font-bold flex items-center justify-center sm:justify-start gap-3 hover:bg-[#059669] transition-colors text-base md:text-lg 2xl:text-xl w-full sm:w-auto group"
                  >
                    {language === "EN" ? "Try for free" : "Coba Gratis"}`
);

fs.writeFileSync('src/App.tsx', content);
