const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf-8');

const replacements = [
  [
    `MEMBERSHIPS PLANS THAT SUIT<br /> YOUR LIFESTYLE`,
    `{language === "EN" ? <Fragment>MEMBERSHIP PLANS THAT SUIT<br /> YOUR LIFESTYLE</Fragment> : <Fragment>PAKET KEANGGOTAAN YANG SESUAI<br /> DENGAN GAYA HIDUP ANDA</Fragment>}`
  ],
  [
    `Perfect for getting started with GymBuddy AI.`,
    `{language === "EN" ? "Perfect for getting started with GymBuddy AI." : "Sempurna untuk memulai dengan GymBuddy AI."}`
  ],
  [
    `AI Personalized Workout Plans`,
    `{language === "EN" ? "AI Personalized Workout Plans" : "Rencana Latihan Personal dengan AI"}`
  ],
  [
    `Exercise & Progress Tracking`,
    `{language === "EN" ? "Exercise & Progress Tracking" : "Pelacakan Latihan & Kemajuan"}`
  ],
  [
    `15 AI requests every 2 days (shared across Workout AI, Meal Recognition, and Form Analysis)`,
    `{language === "EN" ? "15 AI requests every 2 days (shared across Workout AI, Meal Recognition, and Form Analysis)" : "15 permintaan AI setiap 2 hari (dibagi untuk Workout AI, Pengenalan Makanan, dan Analisis Postur)"}`
  ],
  [
    `Community Access`,
    `{language === "EN" ? "Community Access" : "Akses Komunitas"}`
  ],
  [
    `Choose the AI feature that matches your fitness journey.`,
    `{language === "EN" ? "Choose the AI feature that matches your fitness journey." : "Pilih fitur AI yang sesuai dengan perjalanan kebugaran Anda."}`
  ],
  [
    `Choose One AI Specialization`,
    `{language === "EN" ? "Choose One AI Specialization" : "Pilih Satu Spesialisasi AI"}`
  ],
  [
    `Unlimited AI Meal Recognition`,
    `{language === "EN" ? "Unlimited AI Meal Recognition" : "Pengenalan Makanan AI Tanpa Batas"}`
  ],
  [
    `Personalized Nutrition Insights`,
    `{language === "EN" ? "Personalized Nutrition Insights" : "Wawasan Nutrisi Personal"}`
  ],
  [
    `Macro & Calorie Analysis`,
    `{language === "EN" ? "Macro & Calorie Analysis" : "Analisis Makro & Kalori"}`
  ],
  [
    `Unlimited AI Form Analysis`,
    `{language === "EN" ? "Unlimited AI Form Analysis" : "Analisis Postur AI Tanpa Batas"}`
  ],
  [
    `Real-Time Technique Feedback`,
    `{language === "EN" ? "Real-Time Technique Feedback" : "Umpan Balik Teknik Real-Time"}`
  ],
  [
    `Exercise Performance Insights`,
    `{language === "EN" ? "Exercise Performance Insights" : "Wawasan Performa Latihan"}`
  ],
  [
    `You can switch your AI specialization anytime.`,
    `{language === "EN" ? "You can switch your AI specialization anytime." : "Anda dapat mengganti spesialisasi AI Anda kapan saja."}`
  ],
  [
    `The complete GymBuddy AI experience.`,
    `{language === "EN" ? "The complete GymBuddy AI experience." : "Pengalaman GymBuddy AI yang lengkap."}`
  ],
  [
    `Everything in Advanced`,
    `{language === "EN" ? "Everything in Advanced" : "Semua yang ada di Advanced"}`
  ],
  [
    `Nutrition AI + Vision AI`,
    `{language === "EN" ? "Nutrition AI + Vision AI" : "Nutrition AI + Vision AI"}`
  ],
  [
    `Get Started`,
    `{language === "EN" ? "Get Started" : "Mulai Sekarang"}`
  ],
  [
    `Book Now`,
    `{language === "EN" ? "Book Now" : "Pesan Sekarang"}`
  ]
];

for (const [search, replace] of replacements) {
  content = content.replace(search, replace);
}

content = content.replace(/<Fragment>/g, '<>');
content = content.replace(/<\/Fragment>/g, '</>');

fs.writeFileSync('src/App.tsx', content);
