const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

const replacements = [
  // Navbar & Hero translated strings
  [
    `AI Journey`,
    `{language === "EN" ? "AI Journey" : "Perjalanan AI"}`
  ],
  // Features section labels & titles
  [
    `Intelligent Fitness Platform`,
    `{language === "EN" ? "Intelligent Fitness Platform" : "Platform Kebugaran Cerdas"}`
  ],
  [
    `Meet GymBuddy AI, Your Personal Trainer That Never Sleeps.`,
    `{language === "EN" ? "Meet GymBuddy AI, Your Personal Trainer That Never Sleeps." : "Temui GymBuddy AI, Pelatih Pribadi Anda yang Tak Pernah Tidur."}`
  ],
  [
    `Generate personalized workouts, analyze your form in real-time with computer vision, and track nutrition. Everything you need to build your best body, powered by advanced AI.`,
    `{language === "EN" ? "Generate personalized workouts, analyze your form in real-time with computer vision, and track nutrition. Everything you need to build your best body, powered by advanced AI." : "Buat latihan yang dipersonalisasi, analisis postur Anda secara real-time dengan visi komputer, dan lacak nutrisi. Segala yang Anda butuhkan untuk membentuk tubuh terbaik Anda, ditenagai oleh AI canggih."}`
  ],
  [
    `AI Workout Coach`,
    `{language === "EN" ? "AI Workout Coach" : "Pelatih Latihan AI"}`
  ],
  [
    `Workouts Built Around You.`,
    `{language === "EN" ? "Workouts Built Around You." : "Latihan yang Dibuat Khusus Untuk Anda."}`
  ],
  [
    `Personalized training plans generated from your goals, training experience, available equipment, workout history, and recovery status. Every session automatically adapts as your performance improves.`,
    `{language === "EN" ? "Personalized training plans generated from your goals, training experience, available equipment, workout history, and recovery status. Every session automatically adapts as your performance improves." : "Rencana pelatihan personal yang dihasilkan dari tujuan, pengalaman, peralatan yang tersedia, riwayat latihan, dan status pemulihan Anda. Setiap sesi beradaptasi otomatis seiring peningkatan performa Anda."}`
  ],
  [
    `text-white/80 text-sm md:text-base 2xl:text-lg font-medium leading-relaxed max-w-sm 2xl:max-w-md`,
    `text-white/80 text-base md:text-lg 2xl:text-xl font-medium leading-relaxed max-w-sm 2xl:max-w-md`
  ],
  [
    `Nutrition AI`,
    `{language === "EN" ? "Nutrition AI" : "AI Nutrisi"}`
  ],
  [
    `Fuel Every Workout Smarter.`,
    `{language === "EN" ? "Fuel Every Workout Smarter." : "Penuhi Nutrisi Latihan dengan Cerdas."}`
  ],
  [
    `Instantly track meals, analyze calories and macros, and receive personalized nutrition recommendations that support your training goals and recovery.`,
    `{language === "EN" ? "Instantly track meals, analyze calories and macros, and receive personalized nutrition recommendations that support your training goals and recovery." : "Lacak makanan secara instan, analisis kalori dan makro, dan terima rekomendasi nutrisi personal yang mendukung tujuan latihan dan pemulihan Anda."}`
  ],
  [
    `text-white/80 text-sm md:text-base 2xl:text-lg font-medium leading-relaxed max-w-sm`,
    `text-white/80 text-base md:text-lg 2xl:text-xl font-medium leading-relaxed max-w-sm`
  ],
  [
    `AI Workout Generation adapted to your unique fitness goals.`,
    `{language === "EN" ? "AI Workout Generation adapted to your unique fitness goals." : "Pembuatan Latihan AI yang disesuaikan dengan tujuan kebugaran unik Anda."}`
  ],
  // How GymBuddy Works section sizes
  [
    `text-neutral-600 text-sm md:text-base font-medium leading-relaxed max-w-sm`,
    `text-neutral-600 text-base md:text-lg 2xl:text-xl font-medium leading-relaxed max-w-sm`
  ]
];

for (const [search, replace] of replacements) {
  content = content.replace(search, replace);
}

fs.writeFileSync('src/App.tsx', content);
