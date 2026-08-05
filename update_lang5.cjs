const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

const replacements = [
  [
    `Your AI Personal Trainer, Nutritionist & Fitness Companion — everything you need to train smarter in one app.`,
    `{language === "EN" ? "Your AI Personal Trainer, Nutritionist & Fitness Companion — everything you need to train smarter in one app." : "Pelatih Pribadi AI, Ahli Gizi & Teman Kebugaran Anda — semua yang Anda butuhkan untuk berlatih lebih cerdas dalam satu aplikasi."}`
  ],
  [
    `>Product<`,
    `>{language === "EN" ? "Product" : "Produk"}<`
  ],
  [
    `>Features<`,
    `>{language === "EN" ? "Features" : "Fitur"}<`
  ],
  [
    `>Pricing<`,
    `>{language === "EN" ? "Pricing" : "Harga"}<`
  ],
  [
    `>How it works<`,
    `>{language === "EN" ? "How it works" : "Cara Kerja"}<`
  ],
  [
    `>Reviews<`,
    `>{language === "EN" ? "Reviews" : "Ulasan"}<`
  ],
  [
    `>Resources<`,
    `>{language === "EN" ? "Resources" : "Sumber Daya"}<`
  ],
  [
    `>Documentation<`,
    `>{language === "EN" ? "Documentation" : "Dokumentasi"}<`
  ],
  [
    `>Guides<`,
    `>{language === "EN" ? "Guides" : "Panduan"}<`
  ],
  [
    `>Blog<`,
    `>{language === "EN" ? "Blog" : "Blog"}<`
  ],
  [
    `>Support<`,
    `>{language === "EN" ? "Support" : "Dukungan"}<`
  ],
  [
    `>Company<`,
    `>{language === "EN" ? "Company" : "Perusahaan"}<`
  ],
  [
    `>About<`,
    `>{language === "EN" ? "About" : "Tentang"}<`
  ],
  [
    `>Careers<`,
    `>{language === "EN" ? "Careers" : "Karir"}<`
  ],
  [
    `>Contact<`,
    `>{language === "EN" ? "Contact" : "Kontak"}<`
  ],
  [
    `>Partners<`,
    `>{language === "EN" ? "Partners" : "Mitra"}<`
  ],
  [
    `All rights reserved.`,
    `{language === "EN" ? "All rights reserved." : "Hak Cipta Dilindungi."}`
  ],
  [
    `Terms of Service`,
    `{language === "EN" ? "Terms of Service" : "Syarat Ketentuan"}`
  ],
  [
    `Privacy Policy`,
    `{language === "EN" ? "Privacy Policy" : "Kebijakan Privasi"}`
  ],
  [
    `Made by BIBI`,
    `{language === "EN" ? "Made by BIBI" : "Dibuat oleh BIBI"}`
  ]
];

for (const [search, replace] of replacements) {
  content = content.replace(search, replace);
}

fs.writeFileSync('src/App.tsx', content);
