/** @type {import('tailwindcss').Config} */
// Tokens come from theme/colors.ts (Tailwind loads configs through jiti, which handles .ts) so JS and className share one palette.
const { colors } = require('./theme/colors.ts');

module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './hooks/**/*.{js,jsx,ts,tsx}',
    './lib/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors,
    },
  },
  plugins: [],
};
