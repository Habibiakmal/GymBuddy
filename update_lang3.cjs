const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

const replacements = [
  [
    `title: "Set Your Goal", desc: "Choose your fitness objective, experience level, equipment, and preferences. GymBuddy creates a personalized foundation."`,
    `title: language === "EN" ? "Set Your Goal" : "Tentukan Tujuanmu", desc: language === "EN" ? "Choose your fitness objective, experience level, equipment, and preferences. GymBuddy creates a personalized foundation." : "Pilih tujuan kebugaran, tingkat pengalaman, peralatan, dan preferensi Anda. GymBuddy membuat fondasi yang dipersonalisasi."`
  ],
  [
    `title: "Train With AI", desc: "Receive adaptive workouts, AI coaching, and real-time form guidance throughout every workout."`,
    `title: language === "EN" ? "Train With AI" : "Berlatih Bersama AI", desc: language === "EN" ? "Receive adaptive workouts, AI coaching, and real-time form guidance throughout every workout." : "Terima latihan adaptif, pelatihan AI, dan panduan postur real-time di sepanjang setiap latihan."`
  ],
  [
    `title: "Fuel Your Body", desc: "Track nutrition, monitor macros, and receive personalized meal recommendations powered by AI."`,
    `title: language === "EN" ? "Fuel Your Body" : "Nutrisi Tubuhmu", desc: language === "EN" ? "Track nutrition, monitor macros, and receive personalized meal recommendations powered by AI." : "Lacak nutrisi, pantau makro, dan terima rekomendasi makanan yang dipersonalisasi yang didukung oleh AI."`
  ],
  [
    `title: "Recover & Improve", desc: "Analyze recovery metrics and automatically optimize your future training plan."`,
    `title: language === "EN" ? "Recover & Improve" : "Pulih & Berkembang", desc: language === "EN" ? "Analyze recovery metrics and automatically optimize your future training plan." : "Analisis metrik pemulihan dan optimalkan rencana pelatihan Anda di masa depan secara otomatis."`
  ]
];

for (const [search, replace] of replacements) {
  content = content.replace(search, replace);
}

fs.writeFileSync('src/App.tsx', content);
