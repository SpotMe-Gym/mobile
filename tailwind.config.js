/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Configure the content for all your components
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: '#0A0A0A',
        card: '#1C1C1E',
        text: '#FFFFFF',
        textSecondary: '#A1A1AA',
      },
      fontFamily: {
        // We can add custom fonts here later
      },
    },
  },
  plugins: [],
}
