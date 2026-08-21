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

// Official GymBuddy Logo SVG Path (from components/Logo.tsx)
const GYMBUDDY_LOGO_SVG = `
<g transform="scale(0.55)">
  <path d="M30.6 32.0694L34.2 27.7639H46.6L39.8 38.0972L26.6 44.9861L36.6 32.0694H30.6Z" fill="#C1F617" />
  <path d="M51 17H27C25.9333 17 23.4 17.775 21.8 20.875C20.2 23.975 15.2667 34.5093 13 39.3889H25L21 48L23.4 46.7083L32.6 34.2222H22.6C22.0667 34.3657 21.24 34.1361 22.2 32.0694C23.16 30.0028 25 25.7546 25.8 23.8889C26.0667 23.3148 26.84 22.1667 27.8 22.1667H38.6L35.8 26.0417H43.4L51 17Z" fill="white" />
</g>
`;

// Precision Inter Vector Typography Engine (Cap Height: 88, Baseline: 100, x-height: 62)
const INTER_GLYPHS: Record<string, string> = {
  // Numbers
  '0': 'M 50 12 C 24 12 12 32 12 60 C 12 88 24 108 50 108 C 76 108 88 88 88 60 C 88 32 76 12 50 12 Z M 50 28 C 66 28 70 44 70 60 C 70 76 66 92 50 92 C 34 92 30 76 30 60 C 30 44 34 28 50 28 Z',
  '1': 'M 32 12 L 56 12 L 56 108 L 32 108 Z M 16 34 L 32 12 L 56 12 L 16 34 Z',
  '2': 'M 14 36 C 14 18 30 12 50 12 C 72 12 86 24 86 42 C 86 60 62 76 40 92 L 86 92 L 86 108 L 14 108 L 14 92 L 48 58 C 62 46 68 40 68 34 C 68 26 60 24 50 24 C 40 24 32 30 32 38 Z',
  '3': 'M 16 12 L 84 12 L 84 28 L 48 50 C 54 48 60 48 66 48 C 82 48 88 60 88 78 C 88 96 74 108 50 108 C 24 108 12 94 12 76 L 30 76 C 30 88 38 94 50 94 C 60 94 68 88 68 78 C 68 66 60 62 48 62 L 34 62 L 34 46 L 58 26 L 16 26 Z',
  '4': 'M 58 12 L 78 12 L 78 108 L 58 108 L 58 84 L 10 84 L 10 68 L 54 12 L 58 12 Z M 30 68 L 58 68 L 58 32 Z',
  '5': 'M 18 12 L 82 12 L 82 28 L 36 28 L 36 46 C 44 42 52 42 62 42 C 78 42 88 54 88 76 C 88 96 76 108 50 108 C 24 108 14 94 14 76 L 32 76 C 32 88 40 94 50 94 C 60 94 68 86 68 76 C 68 64 60 58 48 58 C 40 58 32 62 26 66 L 18 56 Z',
  '6': 'M 50 12 C 72 12 84 28 86 42 L 68 42 C 66 30 60 26 50 26 C 36 26 30 40 30 60 C 36 50 46 44 58 44 C 76 44 88 58 88 78 C 88 96 76 108 50 108 C 24 108 12 90 12 60 C 12 30 26 12 50 12 Z M 50 60 C 40 60 30 68 30 78 C 30 88 40 94 50 94 C 60 94 68 88 68 78 C 68 68 60 60 50 60 Z',
  '7': 'M 14 12 L 86 12 L 86 28 L 46 108 L 24 108 L 64 28 L 14 28 Z',
  '8': 'M 50 12 C 68 12 82 24 82 38 C 82 50 72 58 62 62 C 74 66 86 76 86 90 C 86 102 72 108 50 108 C 28 108 14 102 14 90 C 14 76 26 66 38 62 C 28 58 18 50 18 38 C 18 24 32 12 50 12 Z M 50 26 C 38 26 34 32 34 38 C 34 44 38 50 50 50 C 62 50 66 44 66 38 C 66 32 62 26 50 26 Z M 50 62 C 36 62 32 68 32 78 C 32 86 38 94 50 94 C 62 94 68 86 68 78 C 68 68 64 62 50 62 Z',
  '9': 'M 50 108 C 28 108 16 92 14 78 L 32 78 C 34 90 40 94 50 94 C 64 94 70 80 70 60 C 64 70 54 76 42 76 C 24 76 12 62 12 42 C 12 24 24 12 50 12 C 76 12 88 30 88 60 C 88 90 74 108 50 108 Z M 50 26 C 40 26 32 34 32 44 C 32 54 40 60 50 60 C 60 60 68 54 68 44 C 68 34 60 26 50 26 Z',
  
  // Uppercase Letters
  'A': 'M 50 12 L 88 108 L 66 108 L 56 80 L 44 80 L 34 108 L 12 108 Z M 50 36 L 42 66 L 58 66 Z',
  'B': 'M 18 12 L 56 12 C 74 12 84 22 84 38 C 84 48 78 56 66 60 C 80 64 88 74 88 88 C 88 102 76 108 56 108 L 18 108 Z M 38 28 L 38 52 L 54 52 C 62 52 66 46 66 38 C 66 30 62 28 54 28 Z M 38 66 L 38 92 L 56 92 C 64 92 68 86 68 78 C 68 70 64 66 56 66 Z',
  'C': 'M 80 34 C 74 20 64 12 48 12 C 24 12 14 32 14 60 C 14 88 24 108 48 108 C 64 108 74 100 80 86 L 64 78 C 60 88 56 92 48 92 C 34 92 30 76 30 60 C 30 44 34 28 48 28 C 56 28 60 32 64 42 Z',
  'D': 'M 18 12 L 52 12 C 74 12 86 32 86 60 C 86 88 74 108 52 108 L 18 108 Z M 38 28 L 38 92 L 50 92 C 64 92 68 76 68 60 C 68 44 64 28 50 28 Z',
  'E': 'M 18 12 L 82 12 L 82 28 L 38 28 L 38 52 L 76 52 L 76 68 L 38 68 L 38 92 L 82 92 L 82 108 L 18 108 Z',
  'F': 'M 18 12 L 82 12 L 82 28 L 38 28 L 38 52 L 76 52 L 76 68 L 38 68 L 38 108 L 18 108 Z',
  'G': 'M 80 34 C 74 20 64 12 48 12 C 24 12 14 32 14 60 C 14 88 24 108 48 108 C 68 108 80 96 84 76 L 48 76 L 48 60 L 86 60 L 86 92 C 78 102 66 108 48 108 C 24 108 14 88 14 60 C 14 32 24 12 48 12 C 64 12 74 20 80 34 Z',
  'H': 'M 18 12 L 38 12 L 38 52 L 62 52 L 62 12 L 82 12 L 82 108 L 62 108 L 62 68 L 38 68 L 38 108 L 18 108 Z',
  'I': 'M 24 12 L 44 12 L 44 108 L 24 108 Z',
  'J': 'M 58 12 L 78 12 L 78 84 C 78 100 68 108 48 108 C 28 108 18 100 16 86 L 34 80 C 36 88 40 92 48 92 C 56 92 60 88 60 80 Z',
  'K': 'M 18 12 L 38 12 L 38 54 L 62 12 L 86 12 L 50 58 L 88 108 L 64 108 L 38 70 L 38 108 L 18 108 Z',
  'L': 'M 18 12 L 38 12 L 38 92 L 82 92 L 82 108 L 18 108 Z',
  'M': 'M 16 12 L 38 12 L 50 60 L 62 12 L 84 12 L 84 108 L 66 108 L 66 42 L 54 88 L 46 88 L 34 42 L 34 108 L 16 108 Z',
  'N': 'M 18 12 L 38 12 L 64 74 L 64 12 L 82 12 L 82 108 L 62 108 L 36 46 L 36 108 L 18 108 Z',
  'O': 'M 50 12 C 24 12 14 32 14 60 C 14 88 24 108 50 108 C 76 108 86 88 86 60 C 86 32 76 12 50 12 Z M 50 28 C 64 28 68 44 68 60 C 68 76 64 92 50 92 C 36 92 32 76 32 60 C 32 44 36 28 50 28 Z',
  'P': 'M 18 12 L 54 12 C 74 12 84 24 84 44 C 84 64 74 74 54 74 L 38 74 L 38 108 L 18 108 Z M 38 28 L 38 58 L 52 58 C 62 58 66 52 66 44 C 66 36 62 28 52 28 Z',
  'Q': 'M 50 12 C 24 12 14 32 14 60 C 14 88 24 108 50 108 C 62 108 72 102 78 92 L 68 80 C 64 88 58 92 50 92 C 36 92 32 76 32 60 C 32 44 36 28 50 28 C 64 28 68 44 68 60 C 68 66 66 72 62 78 L 78 94 C 84 84 86 72 86 60 C 86 32 76 12 50 12 Z M 66 84 L 84 108 L 72 114 L 56 90 Z',
  'R': 'M 18 12 L 54 12 C 74 12 84 24 84 42 C 84 56 76 66 60 70 L 88 108 L 64 108 L 42 74 L 38 74 L 38 108 L 18 108 Z M 38 28 L 38 58 L 52 58 C 62 58 66 52 66 42 C 66 32 62 28 52 28 Z',
  'S': 'M 78 36 C 72 20 62 12 48 12 C 28 12 18 22 18 36 C 18 50 28 58 48 64 C 64 68 70 74 70 82 C 70 92 60 94 50 94 C 38 94 30 88 26 78 L 10 86 C 16 102 30 108 50 108 C 72 108 86 98 86 82 C 86 68 74 58 54 52 C 38 48 34 44 34 36 C 34 28 40 24 48 24 C 56 24 64 28 68 38 Z',
  'T': 'M 10 12 L 90 12 L 90 28 L 58 28 L 58 108 L 42 108 L 42 28 L 10 28 Z',
  'U': 'M 18 12 L 38 12 L 38 76 C 38 88 42 92 50 92 C 58 92 62 88 62 76 L 62 12 L 82 12 L 82 76 C 82 98 72 108 50 108 C 28 108 18 98 18 76 Z',
  'V': 'M 14 12 L 34 12 L 50 82 L 66 12 L 86 12 L 60 108 L 40 108 Z',
  'W': 'M 12 12 L 30 12 L 42 74 L 50 30 L 58 74 L 70 12 L 88 12 L 76 108 L 60 108 L 50 62 L 40 108 L 24 108 Z',
  'X': 'M 16 12 L 38 12 L 50 48 L 62 12 L 84 12 L 62 58 L 86 108 L 64 108 L 50 72 L 36 108 L 14 108 L 38 58 Z',
  'Y': 'M 14 12 L 36 12 L 50 50 L 64 12 L 86 12 L 58 66 L 58 108 L 42 108 L 42 66 Z',
  'Z': 'M 18 12 L 82 12 L 82 28 L 38 92 L 82 92 L 82 108 L 18 108 L 18 92 L 62 28 L 18 28 Z',
  
  // Lowercase Letters
  'a': 'M 48 42 C 28 42 16 54 16 76 C 16 98 28 108 48 108 C 58 108 66 104 70 96 L 70 108 L 86 108 L 86 42 L 70 42 L 70 54 C 66 46 58 42 48 42 Z M 52 56 C 64 56 70 64 70 76 C 70 86 64 94 52 94 C 40 94 32 86 32 76 C 32 64 40 56 52 56 Z',
  'b': 'M 18 12 L 34 12 L 34 54 C 40 46 48 42 58 42 C 76 42 86 56 86 76 C 86 98 76 108 58 108 C 48 108 40 104 34 96 L 34 108 L 18 108 Z M 52 56 C 40 56 34 64 34 76 C 34 86 40 94 52 94 C 64 94 70 86 70 76 C 70 64 64 56 52 56 Z',
  'c': 'M 74 58 C 70 48 62 42 50 42 C 28 42 16 54 16 76 C 16 98 28 108 50 108 C 62 108 70 102 74 92 L 60 86 C 58 92 54 94 48 94 C 38 94 32 86 32 76 C 32 64 38 56 48 56 C 54 56 58 60 60 66 Z',
  'd': 'M 70 12 L 86 12 L 86 108 L 70 108 L 70 96 C 66 104 58 108 48 108 C 28 108 16 98 16 76 C 16 56 28 42 48 42 C 58 42 66 46 70 54 Z M 52 56 C 40 56 32 64 32 76 C 32 86 40 94 52 94 C 64 94 70 86 70 76 C 70 64 64 56 52 56 Z',
  'e': 'M 50 42 C 26 42 16 54 16 76 C 16 98 28 108 50 108 C 66 108 74 100 78 88 L 64 82 C 60 88 56 94 48 94 C 38 94 32 86 32 74 L 80 74 C 80 54 70 42 50 42 Z M 32 62 C 34 52 40 48 48 48 C 56 48 64 52 64 62 Z',
  'f': 'M 40 12 C 26 12 18 20 18 34 L 18 42 L 8 42 L 8 56 L 18 56 L 18 108 L 34 108 L 34 56 L 48 56 L 48 42 L 34 42 L 34 32 C 34 26 36 24 42 24 L 48 24 L 48 12 Z',
  'g': 'M 70 42 L 86 42 L 86 98 C 86 118 74 126 54 126 C 36 126 24 118 20 106 L 34 100 C 38 108 44 112 52 112 C 64 112 70 106 70 96 L 70 92 C 66 98 58 102 48 102 C 28 102 16 90 16 72 C 16 54 28 42 48 42 C 58 42 66 46 70 54 Z M 52 56 C 40 56 32 64 32 72 C 32 82 40 88 52 88 C 64 88 70 82 70 72 C 70 64 64 56 52 56 Z',
  'h': 'M 18 12 L 34 12 L 34 54 C 40 46 48 42 58 42 C 74 42 82 52 82 68 L 82 108 L 66 108 L 66 70 C 66 60 62 56 52 56 C 42 56 36 62 34 70 L 34 108 L 18 108 Z',
  'i': 'M 18 12 L 34 12 L 34 26 L 18 26 Z M 18 42 L 34 42 L 34 108 L 18 108 Z',
  'j': 'M 32 12 L 48 12 L 48 26 L 32 26 Z M 32 42 L 48 42 L 48 102 C 48 116 40 126 22 126 C 14 126 6 122 2 114 L 16 106 C 20 110 24 112 28 112 C 34 112 36 108 36 100 L 36 42 Z',
  'k': 'M 18 12 L 34 12 L 34 68 L 60 42 L 80 42 L 46 72 L 82 108 L 60 108 L 34 78 L 34 108 L 18 108 Z',
  'l': 'M 18 12 L 34 12 L 34 108 L 18 108 Z',
  'm': 'M 14 42 L 30 42 L 30 54 C 34 46 40 42 48 42 C 58 42 64 48 68 56 C 72 48 80 42 88 42 C 104 42 110 52 110 68 L 110 108 L 94 108 L 94 70 C 94 60 90 56 82 56 C 74 56 70 62 66 70 L 66 108 L 50 108 L 50 70 C 50 60 46 56 38 56 C 34 56 30 60 30 70 L 30 108 L 14 108 Z',
  'n': 'M 18 42 L 34 42 L 34 54 C 40 46 48 42 58 42 C 74 42 82 52 82 68 L 82 108 L 66 108 L 66 70 C 66 60 62 56 52 56 C 42 56 36 62 34 70 L 34 108 L 18 108 Z',
  'o': 'M 50 42 C 26 42 16 54 16 76 C 16 98 26 108 50 108 C 72 108 82 98 82 76 C 82 54 72 42 50 42 Z M 50 56 C 62 56 66 64 66 76 C 66 86 62 94 50 94 C 38 94 34 86 34 76 C 34 64 38 56 50 56 Z',
  'p': 'M 18 42 L 34 42 L 34 54 C 40 46 48 42 58 42 C 76 42 86 56 86 76 C 86 98 76 108 58 108 C 48 108 40 104 34 96 L 34 126 L 18 126 Z M 52 56 C 40 56 34 64 34 76 C 34 86 40 94 52 94 C 64 94 70 86 70 76 C 70 64 64 56 52 56 Z',
  'q': 'M 70 42 L 86 42 L 86 126 L 70 126 L 70 96 C 66 104 58 108 48 108 C 28 108 16 98 16 76 C 16 56 28 42 48 42 C 58 42 66 46 70 54 Z M 52 56 C 40 56 32 64 32 76 C 32 86 40 94 52 94 C 64 94 70 86 70 76 C 70 64 64 56 52 56 Z',
  'r': 'M 18 42 L 34 42 L 34 58 C 38 48 46 42 56 42 L 64 42 L 64 58 L 52 58 C 42 58 36 64 34 74 L 34 108 L 18 108 Z',
  's': 'M 70 56 C 64 46 56 42 46 42 C 30 42 20 50 20 62 C 20 72 28 78 44 82 C 58 86 64 90 64 96 C 64 102 56 106 48 106 C 36 106 30 100 26 92 L 12 98 C 16 110 28 116 48 116 C 68 116 80 108 80 94 C 80 82 72 74 54 70 C 40 66 34 62 34 56 C 34 50 40 46 48 46 C 54 46 60 50 64 58 Z',
  't': 'M 18 22 L 34 22 L 34 42 L 48 42 L 48 56 L 34 56 L 34 94 C 34 98 36 100 42 100 L 48 100 L 48 112 C 40 114 32 114 26 110 C 20 104 18 98 18 90 L 18 56 L 8 56 L 8 42 L 18 42 Z',
  'u': 'M 18 42 L 34 42 L 34 80 C 34 90 38 94 48 94 C 58 94 64 90 68 80 L 68 42 L 84 42 L 84 108 L 68 108 L 68 96 C 64 104 56 108 46 108 C 26 108 18 98 18 80 Z',
  'v': 'M 12 42 L 30 42 L 48 92 L 66 42 L 84 42 L 56 108 L 40 108 Z',
  'w': 'M 10 42 L 26 42 L 38 90 L 48 52 L 58 90 L 70 42 L 86 42 L 74 108 L 60 108 L 50 72 L 40 108 L 26 108 Z',
  'x': 'M 12 42 L 30 42 L 48 66 L 66 42 L 84 42 L 58 74 L 84 108 L 66 108 L 48 82 L 30 108 L 12 108 L 38 74 Z',
  'y': 'M 12 42 L 30 42 L 48 80 L 66 42 L 84 42 L 56 102 C 50 116 42 126 24 126 C 14 126 8 122 2 118 L 12 106 C 16 110 20 112 26 112 C 34 112 40 106 44 98 L 12 42 Z',
  'z': 'M 16 42 L 78 42 L 78 56 L 36 94 L 80 94 L 80 108 L 16 108 L 16 94 L 58 56 L 16 56 Z',

  // Punctuation & Symbols
  '.': 'M 0 94 L 16 94 L 16 108 L 0 108 Z',
  ',': 'M 4 94 L 18 94 L 10 118 L 0 110 Z',
  ':': 'M 0 46 L 16 46 L 16 60 L 0 60 Z M 0 94 L 16 94 L 16 108 L 0 108 Z',
  '·': 'M 0 52 L 16 52 L 16 68 L 0 68 Z',
  '-': 'M 0 58 L 44 58 L 44 70 L 0 70 Z',
  '+': 'M 24 30 L 42 30 L 42 50 L 62 50 L 62 68 L 42 68 L 42 88 L 24 88 L 24 68 L 4 68 L 4 50 L 24 50 Z',
  '%': 'M 18 18 C 28 18 28 36 18 36 C 8 36 8 18 18 18 Z M 54 68 C 64 68 64 86 54 86 C 44 86 44 68 54 68 Z M 62 14 L 72 20 L 18 92 L 8 86 Z',
  '/': 'M 54 12 L 72 12 L 18 108 L 0 108 Z',
  '(': 'M 36 12 C 12 44 12 76 36 108 L 20 108 C -4 76 -4 44 20 12 Z',
  ')': 'M 0 12 C 24 44 24 76 0 108 L 16 108 C 40 76 40 44 16 12 Z',
  "'": 'M 8 12 L 22 12 L 14 34 L 4 28 Z',
  '"': 'M 4 12 L 18 12 L 12 34 L 0 28 Z M 24 12 L 38 12 L 32 34 L 20 28 Z',
  '!': 'M 6 12 L 20 12 L 16 70 L 8 70 Z M 6 94 L 20 94 L 20 108 L 6 108 Z',
  ' ': ' '
};

function renderInterVectorText(text: string, x: number, y: number, height: number, fill = '#FFFFFF', letterSpacing = 0.08): string {
  const str = String(text || "");
  const scale = height / 120;
  const standardWidth = 74 * scale;
  let currentX = x;
  let paths = '';

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === ' ') {
      currentX += standardWidth * 0.45;
      continue;
    }

    const glyph = INTER_GLYPHS[char];
    let glyphWidth = standardWidth;
    if (char === 'i' || char === 'l' || char === '.' || char === ':' || char === '·' || char === ',' || char === '!' || char === "'") {
      glyphWidth = 22 * scale;
    } else if (char === 'm' || char === 'w' || char === 'M' || char === 'W') {
      glyphWidth = 100 * scale;
    } else if (char === 'r' || char === 't' || char === 'f' || char === 'j') {
      glyphWidth = 46 * scale;
    } else if (char >= 'a' && char <= 'z') {
      glyphWidth = 66 * scale;
    } else if (char >= 'A' && char <= 'Z') {
      glyphWidth = 76 * scale;
    }

    if (glyph && glyph.trim()) {
      paths += `<path d="${glyph}" transform="translate(${currentX.toFixed(1)}, ${y.toFixed(1)}) scale(${scale.toFixed(4)})" fill="${fill}"/>\n`;
    }

    currentX += glyphWidth + (standardWidth * letterSpacing);
  }

  return paths;
}

function calculateInterTextWidth(text: string, height: number, letterSpacing = 0.08): number {
  const str = String(text || "");
  const scale = height / 120;
  const standardWidth = 74 * scale;
  let w = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === ' ') {
      w += standardWidth * 0.45;
      continue;
    }
    let glyphWidth = standardWidth;
    if (char === 'i' || char === 'l' || char === '.' || char === ':' || char === '·' || char === ',' || char === '!' || char === "'") {
      glyphWidth = 22 * scale;
    } else if (char === 'm' || char === 'w' || char === 'M' || char === 'W') {
      glyphWidth = 100 * scale;
    } else if (char === 'r' || char === 't' || char === 'f' || char === 'j') {
      glyphWidth = 46 * scale;
    } else if (char >= 'a' && char <= 'z') {
      glyphWidth = 66 * scale;
    } else if (char >= 'A' && char <= 'Z') {
      glyphWidth = 76 * scale;
    }
    w += glyphWidth + (standardWidth * letterSpacing);
  }
  return w;
}

export function generateNutritionCardSvg(data: NutritionCardData): string {
  const rawTitle = (data.foodName || "Cheetos Rasa Jagung Bakar Keju (1 Bungkus)").trim();
  
  // Intelligent Multi-line wrap for long meal titles
  const maxCharsPerLine = 34;
  let titleLine1 = rawTitle;
  let titleLine2 = "";
  if (rawTitle.length > maxCharsPerLine) {
    const words = rawTitle.split(/\s+/);
    titleLine1 = "";
    titleLine2 = "";
    for (const w of words) {
      if ((titleLine1 + " " + w).trim().length <= maxCharsPerLine && !titleLine2) {
        titleLine1 = (titleLine1 + " " + w).trim();
      } else {
        titleLine2 = (titleLine2 + " " + w).trim();
      }
    }
  }
  const hasLine2 = Boolean(titleLine2);

  const protein = Math.round(Number(data.protein) || 0);
  const carbs = Math.round(Number(data.carbs) || 0);
  const fat = Math.round(Number(data.fat) || 0);
  const sodium = Math.round(Number(data.sodium) || 0);

  // Exact 4-4-9 macro energy: Calorie = (P * 4) + (C * 4) + (F * 9)
  const macroCalcCalories = (protein * 4) + (carbs * 4) + (fat * 9);
  const calories = macroCalcCalories > 0 ? macroCalcCalories : (Math.round(Number(data.calories)) || 0);

  const mealType = data.mealType || "Lunch";
  const dateStr = data.dateStr || new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const targetCal = Math.round(Number(data.dailyTargetCalories) || 1966);
  const consumedCal = Math.round(Number(data.consumedTodayCalories) || calories);
  const remainingCal = targetCal - consumedCal;

  // Subtle daily status indicator
  const isOver = remainingCal < 0;
  const statusText = isOver 
    ? `${Math.abs(remainingCal).toLocaleString("en-US")} kcal over your goal today` 
    : `${remainingCal.toLocaleString("en-US")} kcal remaining today`;
  
  const statusColor = isOver ? "#F87171" : "#4ADE80";
  const statusDotColor = isOver ? "#EF4444" : "#22C55E";

  let insightText = (data.insight || "").trim();
  if (!insightText) {
    if (protein >= 25) {
      insightText = "Great protein boost! Excellent for muscle recovery and satiety.";
    } else if (carbs >= 50) {
      insightText = "High in carbs. Consider pairing with protein for a balanced day.";
    } else if (fat >= 20) {
      insightText = "Rich in healthy energy. Balance with light fiber for dinner.";
    } else {
      insightText = "Well balanced meal. Keep staying on track with your water and daily goal.";
    }
  }

  // Spacing & Coordinates (Height: 1140px, portrait 9:16 photo ratio)
  const headerY = 38;
  const titleY = headerY + 44;
  const titleHeight = hasLine2 ? 58 : 32;
  const photoY = titleY + titleHeight + 14;
  const photoHeight = 460; // Clean 9:16 portrait ratio!
  const calorieY = photoY + photoHeight + 28;
  const macroY = calorieY + 86;
  const sodiumY = macroY + 74;
  const insightY = sodiumY + 54;

  const photoHref = data.imageBufferOrBase64 || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="720" height="1140" viewBox="0 0 720 1140">
  <defs>
    <!-- Deep Obsidian Slate Canvas -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0B0F17"/>
      <stop offset="50%" stop-color="#070A0F"/>
      <stop offset="100%" stop-color="#030508"/>
    </linearGradient>

    <!-- Subtle Container Gradient -->
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1E293B" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#0F172A" stop-opacity="0.3"/>
    </linearGradient>

    <clipPath id="foodPhotoClip">
      <rect x="40" y="${photoY}" width="640" height="${photoHeight}" rx="16" ry="16"/>
    </clipPath>
  </defs>

  <!-- Canvas Background -->
  <rect width="720" height="1140" fill="url(#bgGrad)"/>

  <!-- 1. Header: Official GymBuddy Logo & Metadata -->
  <g id="header" transform="translate(40, ${headerY})">
    <!-- Official GymBuddy Logo (Clean, subtle, no pill/badge) -->
    <g transform="translate(0, -6)">
      ${GYMBUDDY_LOGO_SVG}
    </g>
    ${renderInterVectorText("GymBuddy", 44, 2, 16, "#F8FAFC")}

    <!-- Meal Metadata on Right: Lunch · Jun 21 -->
    ${renderInterVectorText(`${mealType} · ${dateStr}`, 680 - 40 - calculateInterTextWidth(`${mealType} · ${dateStr}`, 14), 4, 14, "#64748B")}
  </g>

  <!-- 2. Meal Title (Inter SemiBold, Multi-line support) -->
  <g id="mealTitle">
    ${renderInterVectorText(titleLine1, 40, titleY, 24, "#F8FAFC")}
    ${hasLine2 ? renderInterVectorText(titleLine2, 40, titleY + 28, 22, "#CBD5E1") : ""}
  </g>

  <!-- 3. Food Photo (Portrait ~9:16, 16px Rounded Corners, Focal Point) -->
  <g id="foodPhoto">
    <rect x="40" y="${photoY}" width="640" height="${photoHeight}" rx="16" ry="16" fill="#1E293B"/>
    <image href="${photoHref}" xlink:href="${photoHref}" x="40" y="${photoY}" width="640" height="${photoHeight}" preserveAspectRatio="xMidYMid slice" clip-path="url(#foodPhotoClip)"/>
  </g>

  <!-- 4. Calorie Section (Primary Hero Number in Orange Accent + Goal Context + Status) -->
  <g id="calorieSection" transform="translate(40, ${calorieY})">
    <!-- Primary Calorie Number -->
    ${renderInterVectorText(`${calories}`, 0, 0, 48, "#FF6B00")}
    ${renderInterVectorText("kcal", calculateInterTextWidth(`${calories}`, 48) + 8, 14, 24, "#94A3B8")}

    <!-- Goal Context Subtitle -->
    ${renderInterVectorText(`of your ${targetCal.toLocaleString("en-US")} kcal daily goal`, 0, 52, 14, "#64748B")}

    <!-- Subtle Daily Calorie Status Indicator on the Right -->
    <g transform="translate(360, 10)">
      <circle cx="8" cy="14" r="4" fill="${statusDotColor}"/>
      ${renderInterVectorText(statusText, 20, 4, 13, statusColor)}
    </g>
  </g>

  <!-- Subtle Thin Divider Line -->
  <line x1="40" y1="${calorieY + 76}" x2="680" y2="${calorieY + 76}" stroke="#1E293B" stroke-width="1"/>

  <!-- 5. Macronutrients (Clean 3-column horizontal layout, Color Indicators) -->
  <g id="macroSection" transform="translate(40, ${macroY})">
    <!-- Protein -->
    <g transform="translate(0, 0)">
      <circle cx="6" cy="9" r="4" fill="#F59E0B"/>
      ${renderInterVectorText("Protein", 18, 0, 14, "#94A3B8")}
      ${renderInterVectorText(`${protein} g`, 18, 22, 24, "#F8FAFC")}
    </g>

    <!-- Carbs -->
    <g transform="translate(240, 0)">
      <circle cx="6" cy="9" r="4" fill="#EC4899"/>
      ${renderInterVectorText("Carbs", 18, 0, 14, "#94A3B8")}
      ${renderInterVectorText(`${carbs} g`, 18, 22, 24, "#F8FAFC")}
    </g>

    <!-- Fat -->
    <g transform="translate(480, 0)">
      <circle cx="6" cy="9" r="4" fill="#06B6D4"/>
      ${renderInterVectorText("Fat", 18, 0, 14, "#94A3B8")}
      ${renderInterVectorText(`${fat} g`, 18, 22, 24, "#F8FAFC")}
    </g>
  </g>

  <!-- 6. Sodium (Compact, Secondary, Visually Quiet) -->
  <g id="sodiumSection" transform="translate(40, ${sodiumY})">
    <rect x="0" y="0" width="640" height="40" rx="10" fill="url(#cardGrad)"/>
    <circle cx="18" cy="20" r="3" fill="#64748B"/>
    ${renderInterVectorText("Sodium", 28, 11, 13, "#94A3B8")}
    ${renderInterVectorText(`${(sodium || 230)} mg`, 90, 10, 14, "#CBD5E1")}
    ${renderInterVectorText("2,300 mg daily limit", 476, 11, 12, "#64748B")}
  </g>

  <!-- 7. GymBuddy Insight (Human, Actionable Coaching, Subtle) -->
  <g id="insightSection" transform="translate(40, ${insightY})">
    <rect x="0" y="0" width="640" height="62" rx="12" fill="#0F172A" stroke="#1E293B" stroke-width="1"/>
    <!-- Clean coaching tip bullet -->
    <circle cx="24" cy="31" r="5" fill="#C1F617"/>
    ${renderInterVectorText(insightText, 42, 21, 13, "#94A3B8")}
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
