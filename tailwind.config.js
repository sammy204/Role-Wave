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
        // --- Dashboard shell redesign tokens (added) ---
        sidebar: {
          DEFAULT: '#1D9E75', // matches the public homepage hero card exactly
          active: '#0F6E56',  // active/selected nav item state
        },
        surface: '#FFFFFF', // card/panel background, sits on top of `paper`
        pill: {
          green: { bg: '#E1F5EE', text: '#085041', border: '#5DCAA5' },
          blue: { bg: '#E6F1FB', text: '#0C447C', border: '#9AC0E8' },
          amber: { bg: '#FAEEDA', text: '#633806', border: '#F0D080' },
          red: { bg: '#FAECE7', text: '#712B13', border: '#E8A98C' },
        },
      },
      fontFamily: {
        serif: ['Newsreader', 'Georgia', 'serif'],
        sans: ['Manrope', 'sans-serif'],
      },
      boxShadow: {
        card: '0 10px 28px rgba(26,26,26,0.06)',
        'card-hover': '0 18px 38px rgba(26,26,26,0.12)',
        sidebar: '0 0 40px rgba(15,110,86,0.15)',
      },
      borderRadius: {
        panel: '24px',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
};