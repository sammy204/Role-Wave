/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#FBFAF7',
        ink: '#1A1A1A',
        muted: '#5F5E5A',
        faint: '#B4B2A9',
        line: '#D3D1C7',
        accent: {
          light: '#E1F5EE',
          DEFAULT: '#1D9E75',
          deep: '#0F6E56',
          text: '#085041',
        },
      },
      fontFamily: {
        serif: ['Newsreader', 'Georgia', 'serif'],
        sans: ['Manrope', 'sans-serif'],
      },
    },
  },
  plugins: [],
};