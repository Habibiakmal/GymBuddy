export interface NutritionCardData {
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sodium?: number;
  fiber?: number;
  sugar?: number;
  insight?: string;
  mealType?: string;
  dateStr?: string;
  dailyTargetCalories?: number;
  consumedTodayCalories?: number;
  dailyTargetProtein?: number;
  dailyTargetCarbs?: number;
  dailyTargetFat?: number;
  imageBufferOrBase64?: string; // Data URI (data:image/jpeg;base64,...) or image URL
}

const MANROPE_GLYPHS: Record<string, string> = {
  // Numbers (bold, clean, human)
  '0': 'M 50 0 C 22 0 10 26 10 60 C 10 94 22 120 50 120 C 78 120 90 94 90 60 C 90 26 78 0 50 0 Z M 50 22 C 64 22 68 40 68 60 C 68 80 64 98 50 98 C 36 98 32 80 32 60 C 32 40 36 22 50 22 Z',
  '1': 'M 32 0 L 58 0 L 58 120 L 32 120 Z M 16 28 L 32 0 L 58 0 L 16 28 Z',
  '2': 'M 10 32 C 10 12 28 0 52 0 C 78 0 90 14 90 32 C 90 56 60 76 38 96 L 90 96 L 90 120 L 10 120 L 10 98 L 50 56 C 64 42 68 34 68 28 C 68 20 60 18 52 18 C 40 18 32 24 32 34 Z',
  '3': 'M 14 0 L 86 0 L 86 22 L 44 48 C 50 46 58 46 64 46 C 82 46 90 58 90 78 C 90 102 76 120 50 120 C 24 120 10 102 10 82 L 32 82 C 32 94 40 100 50 100 C 60 100 68 92 68 78 C 68 64 60 58 48 58 L 36 58 L 36 40 L 62 20 L 14 20 Z',
  '4': 'M 62 0 L 86 0 L 86 120 L 62 120 L 62 92 L 6 92 L 6 70 L 58 0 L 62 0 Z M 30 70 L 62 70 L 62 28 Z',
  '5': 'M 14 0 L 86 0 L 86 22 L 36 22 L 36 46 C 44 42 54 42 62 42 C 80 42 90 56 90 78 C 90 102 76 120 50 120 C 22 120 10 100 10 78 L 32 78 C 32 92 40 98 50 98 C 60 98 68 90 68 78 C 68 66 60 58 48 58 C 40 58 32 62 26 68 L 14 54 Z',
  '6': 'M 50 0 C 76 0 88 20 88 38 L 66 38 C 66 24 58 20 50 20 C 34 20 30 38 30 60 C 36 50 46 44 58 44 C 78 44 88 58 88 80 C 88 104 74 120 50 120 C 22 120 8 98 8 58 C 8 20 24 0 50 0 Z M 50 64 C 40 64 32 72 32 82 C 32 92 40 100 50 100 C 60 100 66 92 66 82 C 66 72 60 64 50 64 Z',
  '7': 'M 10 0 L 90 0 L 90 20 L 46 120 L 20 120 L 64 20 L 10 20 Z',
  '8': 'M 50 0 C 72 0 84 14 84 32 C 84 46 72 56 60 60 C 76 64 88 76 88 92 C 88 110 74 120 50 120 C 26 120 12 110 12 92 C 12 76 24 64 40 60 C 28 56 16 46 16 32 C 16 14 28 0 50 0 Z M 50 18 C 38 18 36 26 36 32 C 36 38 40 44 50 44 C 60 44 64 38 64 32 C 64 26 62 18 50 18 Z M 50 60 C 36 60 32 68 32 78 C 32 88 38 98 50 98 C 62 98 68 88 68 78 C 68 68 64 60 50 60 Z',
  '9': 'M 50 120 C 24 120 12 100 12 82 L 34 82 C 34 96 42 100 50 100 C 66 100 70 82 70 60 C 64 70 54 76 42 76 C 22 76 12 62 12 40 C 12 16 26 0 50 0 C 78 0 92 22 92 62 C 92 100 76 120 50 120 Z M 50 56 C 60 56 68 48 68 38 C 68 28 60 20 50 20 C 40 20 34 28 34 38 C 34 48 40 56 50 56 Z',
  
  // Uppercase Letters
  'A': 'M 50 0 L 92 120 L 68 120 L 56 84 L 44 84 L 32 120 L 8 120 Z M 50 28 L 41 64 L 59 64 Z',
  'B': 'M 14 0 L 58 0 C 78 0 88 12 88 32 C 88 44 80 54 68 58 C 82 62 90 74 90 92 C 90 110 78 120 56 120 L 14 120 Z M 36 20 L 36 48 L 54 48 C 64 48 68 42 68 34 C 68 26 64 20 54 20 Z M 36 66 L 36 100 L 56 100 C 66 100 70 94 70 84 C 70 74 66 66 56 66 Z',
  'C': 'M 82 28 C 76 12 64 0 48 0 C 22 0 10 26 10 60 C 10 94 22 120 48 120 C 64 120 76 108 82 92 L 62 84 C 58 94 52 100 46 100 C 32 100 28 80 28 60 C 28 40 32 20 46 20 C 52 20 58 26 62 36 Z',
  'D': 'M 14 0 L 52 0 C 78 0 88 26 88 60 C 88 94 78 120 52 120 L 14 120 Z M 36 20 L 36 100 L 50 100 C 66 100 70 80 70 60 C 70 40 66 20 50 20 Z',
  'E': 'M 14 0 L 86 0 L 86 22 L 36 22 L 36 48 L 78 48 L 78 70 L 36 70 L 36 98 L 86 98 L 86 120 L 14 120 Z',
  'F': 'M 14 0 L 86 0 L 86 22 L 36 22 L 36 48 L 78 48 L 78 70 L 36 70 L 36 120 L 14 120 Z',
  'G': 'M 82 28 C 76 12 64 0 48 0 C 22 0 10 26 10 60 C 10 94 22 120 48 120 C 70 120 84 104 86 78 L 48 78 L 48 58 L 88 58 L 88 100 C 80 114 66 120 48 120 C 22 120 10 94 10 60 C 10 26 22 0 48 0 C 64 0 76 12 82 28 Z',
  'H': 'M 14 0 L 36 0 L 36 48 L 64 48 L 64 0 L 86 0 L 86 120 L 64 120 L 64 70 L 36 70 L 36 120 L 14 120 Z',
  'I': 'M 18 0 L 40 0 L 40 120 L 18 120 Z',
  'J': 'M 60 0 L 82 0 L 82 88 C 82 110 68 120 46 120 C 24 120 12 110 10 92 L 30 86 C 32 96 38 100 46 100 C 56 100 62 94 62 86 Z',
  'K': 'M 14 0 L 36 0 L 36 50 L 64 0 L 88 0 L 48 58 L 90 120 L 64 120 L 36 68 L 36 120 L 14 120 Z',
  'L': 'M 14 0 L 36 0 L 36 98 L 86 98 L 86 120 L 14 120 Z',
  'M': 'M 12 0 L 36 0 L 50 60 L 64 0 L 88 0 L 88 120 L 66 120 L 66 40 L 54 90 L 46 90 L 34 40 L 34 120 L 12 120 Z',
  'N': 'M 14 0 L 36 0 L 66 76 L 66 0 L 86 0 L 86 120 L 64 120 L 34 44 L 34 120 L 14 120 Z',
  'O': 'M 50 0 C 22 0 10 26 10 60 C 10 94 22 120 50 120 C 78 120 90 94 90 60 C 90 26 78 0 50 0 Z M 50 20 C 64 20 68 40 68 60 C 68 80 64 100 50 100 C 36 100 32 80 32 60 C 32 40 36 20 50 20 Z',
  'P': 'M 14 0 L 56 0 C 78 0 88 16 88 40 C 88 64 78 76 56 76 L 36 76 L 36 120 L 14 120 Z M 36 20 L 36 56 L 54 56 C 64 56 68 50 68 40 C 68 30 64 20 54 20 Z',
  'Q': 'M 50 0 C 22 0 10 26 10 60 C 10 94 22 120 50 120 C 64 120 74 114 80 104 L 70 88 C 66 94 58 100 50 100 C 36 100 32 80 32 60 C 32 40 36 20 50 20 C 64 20 68 40 68 60 C 68 68 66 76 62 82 L 80 100 C 86 88 90 74 90 60 C 90 26 78 0 50 0 Z M 68 88 L 86 116 L 72 122 L 56 94 Z',
  'R': 'M 14 0 L 56 0 C 78 0 88 14 88 38 C 88 56 78 68 60 72 L 90 120 L 64 120 L 40 76 L 36 76 L 36 120 L 14 120 Z M 36 20 L 36 56 L 54 56 C 64 56 68 50 68 38 C 68 26 64 20 54 20 Z',
  'S': 'M 82 30 C 76 12 64 0 48 0 C 26 0 14 14 14 32 C 14 48 26 58 48 64 C 66 70 72 76 72 88 C 72 98 62 100 50 100 C 38 100 28 92 24 78 L 6 86 C 12 108 28 120 50 120 C 74 120 88 106 88 88 C 88 70 76 60 54 54 C 36 48 30 42 30 32 C 30 22 38 18 48 18 C 58 18 66 22 70 34 Z',
  'T': 'M 6 0 L 94 0 L 94 22 L 58 22 L 58 120 L 42 120 L 42 22 L 6 22 Z',
  'U': 'M 14 0 L 36 0 L 36 78 C 36 94 42 100 50 100 C 58 100 64 94 64 78 L 64 0 L 86 0 L 86 78 C 86 104 74 120 50 120 C 26 120 14 104 14 78 Z',
  'V': 'M 10 0 L 32 0 L 50 86 L 68 0 L 90 0 L 62 120 L 38 120 Z',
  'W': 'M 8 0 L 28 0 L 42 78 L 50 24 L 58 78 L 72 0 L 92 0 L 78 120 L 60 120 L 50 64 L 40 120 L 22 120 Z',
  'X': 'M 12 0 L 36 0 L 50 44 L 64 0 L 88 0 L 64 58 L 90 120 L 66 120 L 50 74 L 34 120 L 10 120 L 36 58 Z',
  'Y': 'M 10 0 L 34 0 L 50 48 L 66 0 L 90 0 L 60 66 L 60 120 L 40 120 L 40 66 Z',
  'Z': 'M 14 0 L 86 0 L 86 20 L 36 98 L 86 98 L 86 120 L 14 120 L 14 100 L 64 22 L 14 22 Z',
  
  // Lowercase Letters
  'a': 'M 50 38 C 26 38 14 54 14 78 C 14 102 26 118 50 118 C 62 118 72 112 76 102 L 76 118 L 94 118 L 94 38 L 76 38 L 76 54 C 72 44 62 38 50 38 Z M 54 56 C 68 56 76 66 76 78 C 76 90 68 100 54 100 C 40 100 32 90 32 78 C 32 66 40 56 54 56 Z',
  'b': 'M 14 0 L 32 0 L 32 54 C 38 44 48 38 60 38 C 82 38 94 56 94 78 C 94 102 82 118 60 118 C 48 118 38 112 32 102 L 32 118 L 14 118 Z M 54 56 C 40 56 32 66 32 78 C 32 90 40 100 54 100 C 68 100 76 90 76 78 C 76 66 68 56 54 56 Z',
  'c': 'M 78 58 C 72 46 62 38 50 38 C 26 38 14 54 14 78 C 14 102 26 118 50 118 C 64 118 74 110 78 98 L 62 92 C 58 98 54 100 48 100 C 38 100 32 90 32 78 C 32 66 38 56 48 56 C 54 56 60 60 62 66 Z',
  'd': 'M 76 0 L 94 0 L 94 118 L 76 118 L 76 102 C 70 112 60 118 48 118 C 26 118 14 102 14 78 C 14 56 26 38 48 38 C 60 38 70 44 76 54 Z M 54 56 C 40 56 32 66 32 78 C 32 90 40 100 54 100 C 68 100 76 90 76 78 C 76 66 68 56 54 56 Z',
  'e': 'M 50 38 C 24 38 12 54 12 78 C 12 102 26 118 50 118 C 68 118 78 108 84 92 L 68 86 C 64 94 58 100 50 100 C 38 100 30 90 30 76 L 86 76 C 86 52 74 38 50 38 Z M 30 62 C 32 50 40 44 50 44 C 60 44 68 50 68 62 Z',
  'f': 'M 42 0 C 26 0 16 10 16 26 L 16 38 L 4 38 L 4 56 L 16 56 L 16 118 L 34 118 L 34 56 L 52 56 L 52 38 L 34 38 L 34 26 C 34 20 38 16 44 16 L 52 16 L 52 0 Z',
  'g': 'M 76 38 L 94 38 L 94 102 C 94 126 80 138 56 138 C 34 138 20 128 16 114 L 32 108 C 36 116 44 120 54 120 C 68 120 76 114 76 102 L 76 98 C 70 106 60 110 48 110 C 26 110 14 94 14 74 C 14 54 26 38 48 38 C 60 38 70 44 76 54 Z M 54 54 C 40 54 32 64 32 74 C 32 86 40 94 54 94 C 68 94 76 86 76 74 C 76 64 68 54 54 54 Z',
  'h': 'M 14 0 L 32 0 L 32 54 C 38 44 48 38 60 38 C 78 38 88 50 88 70 L 88 118 L 70 118 L 70 72 C 70 60 64 54 54 54 C 44 54 36 60 32 70 L 32 118 L 14 118 Z',
  'i': 'M 14 0 L 32 0 L 32 18 L 14 18 Z M 14 38 L 32 38 L 32 118 L 14 118 Z',
  'j': 'M 36 0 L 54 0 L 54 18 L 36 18 Z M 36 38 L 54 38 L 54 108 C 54 124 44 136 24 136 C 14 136 4 130 0 120 L 16 112 C 20 118 24 120 30 120 C 38 120 42 114 42 104 L 42 38 Z',
  'k': 'M 14 0 L 32 0 L 32 70 L 64 38 L 86 38 L 48 76 L 88 118 L 64 118 L 32 82 L 32 118 L 14 118 Z',
  'l': 'M 14 0 L 32 0 L 32 118 L 14 118 Z',
  'm': 'M 10 38 L 28 38 L 28 54 C 32 44 40 38 50 38 C 60 38 68 44 72 54 C 76 44 84 38 94 38 C 110 38 118 50 118 70 L 118 118 L 100 118 L 100 72 C 100 60 96 54 88 54 C 80 54 74 60 70 70 L 70 118 L 52 118 L 52 72 C 52 60 48 54 40 54 C 34 54 28 60 28 70 L 28 118 L 10 118 Z',
  'n': 'M 14 38 L 32 38 L 32 54 C 38 44 48 38 60 38 C 78 38 88 50 88 70 L 88 118 L 70 118 L 70 72 C 70 60 64 54 54 54 C 44 54 36 60 32 70 L 32 118 L 14 118 Z',
  'o': 'M 50 38 C 26 38 14 54 14 78 C 14 102 26 118 50 118 C 74 118 86 102 86 78 C 86 54 74 38 50 38 Z M 50 56 C 64 56 68 68 68 78 C 68 88 64 100 50 100 C 36 100 32 88 32 78 C 32 68 36 56 50 56 Z',
  'p': 'M 14 38 L 32 38 L 32 54 C 38 44 48 38 60 38 C 82 38 94 56 94 78 C 94 102 82 118 60 118 C 48 118 38 112 32 102 L 32 140 L 14 140 Z M 54 56 C 40 56 32 66 32 78 C 32 90 40 100 54 100 C 68 100 76 90 76 78 C 76 66 68 56 54 56 Z',
  'q': 'M 76 38 L 94 38 L 94 140 L 76 140 L 76 102 C 70 112 60 118 48 118 C 26 118 14 102 14 78 C 14 56 26 38 48 38 C 60 38 70 44 76 54 Z M 54 56 C 40 56 32 66 32 78 C 32 90 40 100 54 100 C 68 100 76 90 76 78 C 76 66 68 56 54 56 Z',
  'r': 'M 14 38 L 32 38 L 32 60 C 38 46 48 38 60 38 L 68 38 L 68 58 L 56 58 C 44 58 36 66 32 76 L 32 118 L 14 118 Z',
  's': 'M 74 56 C 68 44 58 38 46 38 C 28 38 18 48 18 62 C 18 74 26 80 44 86 C 60 90 66 94 66 100 C 66 106 58 110 48 110 C 36 110 28 104 24 94 L 8 100 C 14 114 28 122 48 122 C 70 122 84 112 84 98 C 84 84 74 76 56 72 C 40 68 34 64 34 58 C 34 52 40 48 48 48 C 56 48 62 52 66 60 Z',
  't': 'M 18 16 L 36 16 L 36 38 L 54 38 L 54 56 L 36 56 L 36 98 C 36 104 38 106 44 106 L 54 106 L 54 120 C 44 122 34 122 26 118 C 20 112 18 104 18 94 L 18 56 L 6 56 L 6 38 L 18 38 Z',
  'u': 'M 14 38 L 32 38 L 32 82 C 32 94 38 100 48 100 C 58 100 66 94 70 82 L 70 38 L 88 38 L 88 118 L 70 118 L 70 102 C 66 112 56 118 44 118 C 24 118 14 106 14 82 Z',
  'v': 'M 8 38 L 28 38 L 48 98 L 68 38 L 88 38 L 58 118 L 38 118 Z',
  'w': 'M 6 38 L 24 38 L 38 96 L 48 54 L 58 96 L 72 38 L 90 38 L 78 118 L 62 118 L 50 76 L 38 118 L 22 118 Z',
  'x': 'M 10 38 L 30 38 L 48 68 L 66 38 L 86 38 L 60 78 L 88 118 L 68 118 L 48 88 L 28 118 L 8 118 L 36 78 Z',
  'y': 'M 10 38 L 30 38 L 48 84 L 66 38 L 86 38 L 58 108 C 52 124 44 136 24 136 C 14 136 6 132 0 126 L 12 114 C 16 118 20 120 26 120 C 36 120 42 114 46 104 L 10 38 Z',
  'z': 'M 14 38 L 82 38 L 82 54 L 34 102 L 84 102 L 84 118 L 14 118 L 14 102 L 62 54 L 14 54 Z',

  // Punctuation & Symbols
  '.': 'M 0 100 L 18 100 L 18 118 L 0 118 Z',
  ',': 'M 6 100 L 22 100 L 12 126 L 0 118 Z',
  ':': 'M 0 48 L 18 48 L 18 66 L 0 66 Z M 0 100 L 18 100 L 18 118 L 0 118 Z',
  '·': 'M 0 54 L 18 54 L 18 72 L 0 72 Z',
  '-': 'M 0 62 L 48 62 L 48 76 L 0 76 Z',
  '+': 'M 28 32 L 48 32 L 48 56 L 72 56 L 72 76 L 48 76 L 48 100 L 28 100 L 28 76 L 4 76 L 4 56 L 28 56 Z',
  '%': 'M 20 20 C 32 20 32 40 20 40 C 8 40 8 20 20 20 Z M 60 76 C 72 76 72 96 60 96 C 48 96 48 76 60 76 Z M 68 16 L 80 24 L 20 100 L 8 92 Z',
  '/': 'M 60 0 L 80 0 L 20 120 L 0 120 Z',
  '(': 'M 40 0 C 12 40 12 80 40 120 L 22 120 C -6 80 -6 40 22 0 Z',
  ')': 'M 0 0 C 28 40 28 80 0 120 L 18 120 C 46 80 46 40 18 0 Z',
  "'": 'M 10 0 L 26 0 L 16 28 L 4 20 Z',
  '"': 'M 4 0 L 20 0 L 14 26 L 0 20 Z M 28 0 L 44 0 L 38 26 L 24 20 Z',
  '!': 'M 6 0 L 24 0 L 20 72 L 10 72 Z M 6 96 L 24 96 L 24 118 L 6 118 Z',
  ' ': ' '
};

function renderHumanVectorText(text: string, x: number, y: number, height: number, fill = '#FFFFFF', letterSpacing = 0.12): string {
  const str = String(text || "");
  const scale = height / 120;
  const standardWidth = 80 * scale;
  let currentX = x;
  let paths = '';

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === ' ') {
      currentX += standardWidth * 0.45;
      continue;
    }

    const glyph = MANROPE_GLYPHS[char];
    let glyphWidth = standardWidth;
    if (char === 'i' || char === 'l' || char === '.' || char === ':' || char === '·' || char === ',' || char === '!' || char === "'") {
      glyphWidth = 24 * scale;
    } else if (char === 'm' || char === 'w' || char === 'M' || char === 'W') {
      glyphWidth = 110 * scale;
    } else if (char === 'r' || char === 't' || char === 'f' || char === 'j') {
      glyphWidth = 50 * scale;
    } else if (char >= 'a' && char <= 'z') {
      glyphWidth = 74 * scale;
    }

    if (glyph && glyph.trim()) {
      paths += `<path d="${glyph}" transform="translate(${currentX.toFixed(1)}, ${y.toFixed(1)}) scale(${scale.toFixed(4)})" fill="${fill}"/>\n`;
    }

    currentX += glyphWidth + (standardWidth * letterSpacing);
  }

  return paths;
}

function calculateHumanTextWidth(text: string, height: number, letterSpacing = 0.12): number {
  const str = String(text || "");
  const scale = height / 120;
  const standardWidth = 80 * scale;
  let w = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === ' ') {
      w += standardWidth * 0.45;
      continue;
    }
    let glyphWidth = standardWidth;
    if (char === 'i' || char === 'l' || char === '.' || char === ':' || char === '·' || char === ',' || char === '!' || char === "'") {
      glyphWidth = 24 * scale;
    } else if (char === 'm' || char === 'w' || char === 'M' || char === 'W') {
      glyphWidth = 110 * scale;
    } else if (char === 'r' || char === 't' || char === 'f' || char === 'j') {
      glyphWidth = 50 * scale;
    } else if (char >= 'a' && char <= 'z') {
      glyphWidth = 74 * scale;
    }
    w += glyphWidth + (standardWidth * letterSpacing);
  }
  return w;
}

export function generateNutritionCardSvg(data: NutritionCardData): string {
  // Format Meal Title in Sentence Case (Warm & Editorial)
  const rawTitle = (data.foodName || "Es Pisang Ijo").trim();
  const foodTitle = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);

  const protein = Math.round(Number(data.protein) || 0);
  const carbs = Math.round(Number(data.carbs) || 0);
  const fat = Math.round(Number(data.fat) || 0);
  const sodium = Math.round(Number(data.sodium) || 0);

  // Exact math: Calorie = (P * 4) + (C * 4) + (F * 9)
  const macroCalcCalories = (protein * 4) + (carbs * 4) + (fat * 9);
  const calories = macroCalcCalories > 0 ? macroCalcCalories : (Math.round(Number(data.calories)) || 0);

  const mealType = data.mealType || "Lunch";
  const dateStr = data.dateStr || new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const targetCal = Math.round(Number(data.dailyTargetCalories) || 1966);
  const consumedCal = Math.round(Number(data.consumedTodayCalories) || calories);
  const remainingCal = targetCal - consumedCal;

  // Human, calm status wording
  const isOver = remainingCal < 0;
  const statusText = isOver 
    ? `${Math.abs(remainingCal).toLocaleString("en-US")} kcal over your goal today` 
    : `${remainingCal.toLocaleString("en-US")} kcal remaining today`;
  
  const statusColor = isOver ? "#F87171" : "#4ADE80";
  const statusDotColor = isOver ? "#EF4444" : "#22C55E";

  // Human GymBuddy insight
  let insightText = (data.insight || "").trim();
  if (!insightText) {
    if (protein >= 25) {
      insightText = "Great protein boost! Excellent for muscle recovery and satiety.";
    } else if (carbs >= 60) {
      insightText = "High in carbs. Consider pairing with protein for a balanced day.";
    } else if (fat >= 25) {
      insightText = "Rich in healthy energy. Balance with light fiber for dinner.";
    } else {
      insightText = "Well-balanced meal. Keep staying on track with your water and daily goal.";
    }
  }

  // Layout Coordinates (Clean, breathable, minimal borders)
  const headerY = 42;
  const photoY = 135;
  const photoHeight = 460; // Natural portrait 9:16 aspect ratio container
  const calorieY = photoY + photoHeight + 28;
  const macroY = calorieY + 95;
  const sodiumY = macroY + 78;
  const insightY = sodiumY + 54;

  const photoHref = data.imageBufferOrBase64 || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="720" height="1140" viewBox="0 0 720 1140">
  <defs>
    <!-- Calm Dark Navy / Slate Background Gradient -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0F172A"/>
      <stop offset="60%" stop-color="#090E17"/>
      <stop offset="100%" stop-color="#04070D"/>
    </linearGradient>

    <!-- Subtle container gradient -->
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1E293B" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#0F172A" stop-opacity="0.4"/>
    </linearGradient>

    <clipPath id="foodPhotoClip">
      <rect x="40" y="${photoY}" width="640" height="${photoHeight}" rx="20" ry="20"/>
    </clipPath>
  </defs>

  <!-- Calm Dark Navy Canvas -->
  <rect width="720" height="1140" fill="url(#bgGrad)"/>

  <!-- 1. Editorial Meal Header -->
  <g id="header">
    <!-- GymBuddy Branding Subtle Tag -->
    <circle cx="48" cy="${headerY + 6}" r="4" fill="#22C55E"/>
    ${renderHumanVectorText("GymBuddy", 60, headerY, 14, "#94A3B8")}

    <!-- Meal Name in Natural Editorial Sentence Case -->
    ${renderHumanVectorText(foodTitle, 40, headerY + 28, 28, "#F8FAFC")}

    <!-- Meta Subtitle: Lunch · Jun 21 -->
    ${renderHumanVectorText(`${mealType} · ${dateStr}`, 40, headerY + 66, 14, "#64748B")}
  </g>

  <!-- 2. Natural Portrait Food Photo (No heavy cropping or aggressive overlays) -->
  <g id="photoCard">
    <rect x="40" y="${photoY}" width="640" height="${photoHeight}" rx="20" ry="20" fill="#1E293B"/>
    <image href="${photoHref}" xlink:href="${photoHref}" x="40" y="${photoY}" width="640" height="${photoHeight}" preserveAspectRatio="xMidYMid slice" clip-path="url(#foodPhotoClip)"/>
  </g>

  <!-- 3. Calorie & Goal Section (Clean typography hierarchy, no heavy boxes) -->
  <g id="calorieSection" transform="translate(40, ${calorieY})">
    <!-- Big Primary Calorie Number -->
    ${renderHumanVectorText(`${calories}`, 0, 0, 52, "#F8FAFC")}
    ${renderHumanVectorText("kcal", calculateHumanTextWidth(`${calories}`, 52) + 10, 16, 26, "#94A3B8")}

    <!-- Context: of your 1,966 kcal daily goal -->
    ${renderHumanVectorText(`of your ${targetCal.toLocaleString("en-US")} kcal daily goal`, 0, 56, 14, "#64748B")}

    <!-- Subtle Human Daily Status Indicator on the right -->
    <g transform="translate(360, 14)">
      <circle cx="8" cy="14" r="4.5" fill="${statusDotColor}"/>
      ${renderHumanVectorText(statusText, 20, 4, 13, statusColor)}
    </g>
  </g>

  <!-- Subtle Thin Divider Line -->
  <line x1="40" y1="${calorieY + 84}" x2="680" y2="${calorieY + 84}" stroke="#1E293B" stroke-width="1"/>

  <!-- 4. Clean Horizontal Macronutrients (Compact, calm, color dots) -->
  <g id="macroSection" transform="translate(40, ${macroY})">
    <!-- Protein -->
    <g transform="translate(0, 0)">
      <circle cx="6" cy="10" r="4.5" fill="#F59E0B"/>
      ${renderHumanVectorText("Protein", 18, 0, 14, "#94A3B8")}
      ${renderHumanVectorText(`${protein} g`, 18, 22, 26, "#F8FAFC")}
    </g>

    <!-- Carbs -->
    <g transform="translate(240, 0)">
      <circle cx="6" cy="10" r="4.5" fill="#EC4899"/>
      ${renderHumanVectorText("Carbs", 18, 0, 14, "#94A3B8")}
      ${renderHumanVectorText(`${carbs} g`, 18, 22, 26, "#F8FAFC")}
    </g>

    <!-- Fat -->
    <g transform="translate(480, 0)">
      <circle cx="6" cy="10" r="4.5" fill="#06B6D4"/>
      ${renderHumanVectorText("Fat", 18, 0, 14, "#94A3B8")}
      ${renderHumanVectorText(`${fat} g`, 18, 22, 26, "#F8FAFC")}
    </g>
  </g>

  <!-- 5. Secondary Nutrition: Sodium (Visually quiet) -->
  <g id="sodiumSection" transform="translate(40, ${sodiumY})">
    <rect x="0" y="0" width="640" height="42" rx="12" fill="url(#cardGrad)"/>
    <circle cx="18" cy="21" r="3.5" fill="#64748B"/>
    ${renderHumanVectorText("Sodium", 30, 12, 13, "#94A3B8")}
    ${renderHumanVectorText(`${(sodium || 180)} mg`, 96, 11, 14, "#CBD5E1")}
    ${renderHumanVectorText("2,300 mg daily limit", 470, 12, 12, "#64748B")}
  </g>

  <!-- 6. Human GymBuddy Insight (Real actionable coaching, warm and supportive) -->
  <g id="insightSection" transform="translate(40, ${insightY})">
    <rect x="0" y="0" width="640" height="66" rx="14" fill="#0F172A" stroke="#1E293B" stroke-width="1"/>
    <!-- Sparkle / Tip icon -->
    <path d="M 22 18 C 14 18 10 24 10 32 C 10 38 14 42 16 46 L 16 50 L 28 50 L 28 46 C 30 42 34 38 34 32 C 34 24 30 18 22 18 Z M 16 54 L 28 54 L 28 56 L 16 56 Z" fill="#FBBF24"/>
    ${renderHumanVectorText(insightText, 46, 22, 13, "#94A3B8")}
  </g>
</svg>`;
}

export async function generateNutritionCardPng(data: NutritionCardData): Promise<Buffer> {
  const svg = generateNutritionCardSvg(data);
  try {
    const { Resvg } = await import("@resvg/resvg-js");
    const resvg = new Resvg(svg, {
      fitTo: {
        mode: "width",
        value: 720
      }
    });
    return resvg.render().asPng();
  } catch (e) {
    return Buffer.from(svg);
  }
}
