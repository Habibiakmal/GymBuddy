import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// Replace Image 1
code = code.replace(
  "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1470&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=1470&auto=format&fit=crop"
);

// Replace Image 2
code = code.replace(
  "https://images.unsplash.com/photo-1490645935967-10de6ba17061?q=80&w=1453&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=1470&auto=format&fit=crop"
);

fs.writeFileSync('src/App.tsx', code);
