const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '..', 'components', 'Dashboard.tsx');
let content = fs.readFileSync(targetFile, 'utf8');

// 1. Sidebar and Main Container -> bg-[#151515]
content = content.replace(/aside className="hidden lg:flex w-72 bg-\[#[0-9a-fA-F]{6}\]/g, 'aside className="hidden lg:flex w-72 bg-[#151515]');
content = content.replace(/<main className="flex-1 bg-\[#[0-9a-fA-F]{6}\] sm:bg-\[#[0-9a-fA-F]{6}\]/g, '<main className="flex-1 bg-[#151515] sm:bg-[#151515]');

// 2. Card Backgrounds -> #222222 (Bento Box dark shade from Landing Page)
content = content.replace(/bg-\[#000000\]/g, 'bg-[#222222]');

// 3. Inner item/box backgrounds -> #181818 or #2a2a2a
content = content.replace(/bg-\[#0A0A0A\]/g, 'bg-[#181818]');
content = content.replace(/hover:bg-\[#141414\]/g, 'hover:bg-[#2a2a2a]');

// 4. Subtle borders
content = content.replace(/border-neutral-800/g, 'border-white/[0.08]');

// 5. Ensure the outer background is clean white
content = content.replace(/min-h-screen bg-\[#[0-9a-fA-F]{6}\]/g, 'min-h-screen bg-[#F8FAFC]');

fs.writeFileSync(targetFile, content, 'utf8');
console.log('Successfully applied exact Bento dark (#151515 & #222222) palette to Dashboard.tsx');
