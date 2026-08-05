const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf-8');

const replacements = [
  [
    `Be healthier.<br />\n              Be stronger.<br />\n              Be confident.`,
    `{language === "EN" ? "Be healthier." : "Lebih sehat."}<br />\n              {language === "EN" ? "Be stronger." : "Lebih kuat."}<br />\n              {language === "EN" ? "Be confident." : "Lebih percaya diri."}`
  ],
  [
    `satisfied clients`,
    `{language === "EN" ? "satisfied clients" : "klien puas"}`
  ],
  [
    `They arrive with different goals, yet they all find the support and motivation they need. Their success is the ultimate validation of our method.`,
    `{language === "EN" ? "They arrive with different goals, yet they all find the support and motivation they need. Their success is the ultimate validation of our method." : "Mereka datang dengan tujuan berbeda, namun menemukan dukungan dan motivasi yang mereka butuhkan. Kesuksesan mereka adalah validasi akhir dari metode kami."}`
  ],
  [
    `Your muscles grow while you sleep. Make 7-9 hours your secret weapon for maximum progress.`,
    `{language === "EN" ? "Your muscles grow while you sleep. Make 7-9 hours your secret weapon for maximum progress." : "Otot Anda tumbuh saat tidur. Jadikan 7-9 jam tidur sebagai senjata rahasia Anda untuk progres maksimal."}`
  ],
  [
    `Get 2 days free trial`,
    `{language === "EN" ? "Get 2 days free trial" : "Dapatkan 2 hari uji coba gratis"}`
  ],
  [
    `Experience our premium fitness facilities for 48 hours completely free`,
    `{language === "EN" ? "Experience our premium fitness facilities for 48 hours completely free" : "Nikmati fasilitas kebugaran premium kami selama 48 jam secara gratis"}`
  ],
  [
    `Advanced AI<br/>Recovery Intelligence`,
    `{language === "EN" ? <Fragment>Advanced AI<br/>Recovery Intelligence</Fragment> : <Fragment>Kecerdasan Pemulihan<br/>AI Lanjutan</Fragment>}`
  ],
  [
    `24/7 AI<br/>Coaching`,
    `{language === "EN" ? <Fragment>24/7 AI<br/>Coaching</Fragment> : <Fragment>Pelatihan<br/>AI 24/7</Fragment>}`
  ],
  [
    `How GymBuddy Works`,
    `{language === "EN" ? "How GymBuddy Works" : "Cara Kerja GymBuddy"}`
  ],
  [
    `A complete AI-powered fitness experience from planning to recovery.`,
    `{language === "EN" ? "A complete AI-powered fitness experience from planning to recovery." : "Pengalaman kebugaran lengkap dengan AI dari perencanaan hingga pemulihan."}`
  ],
  [
    `Explore More`,
    `{language === "EN" ? "Explore More" : "Jelajahi Lebih Lanjut"}`
  ]
];

for (const [search, replace] of replacements) {
  content = content.replace(search, replace);
}

fs.writeFileSync('src/App.tsx', content);
