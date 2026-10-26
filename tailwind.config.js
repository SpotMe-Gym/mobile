/** @type {import('tailwindcss').Config} */
// Tokens come from src/theme/colors.ts (Tailwind loads configs through jiti, which handles .ts) so JS and className share one palette.
const { colors } = require('./src/theme/colors.ts');

module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors,
    },
  },
  plugins: [],
};
