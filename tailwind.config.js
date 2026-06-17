/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Design token palette
        'bg-base': '#0A0908',
        'bg-s1':   '#111009',
        'bg-s2':   '#1A1712',
        'bg-s3':   '#221F1A',
        'gold':    '#C9A84C',
        'gold-dim':'#8B6B3D',
        'text-p':  '#F0EBE0',
        'text-s':  '#8A8070',
        'text-t':  '#4A4540',
        // Legacy aliases
        surface: {
          900: '#0A0908',
          800: '#111009',
          700: '#1A1712',
          600: '#221F1A',
          500: '#2E2920',
        },
        accent: {
          DEFAULT: '#C9A84C',
          light:   '#E0C277',
          dark:    '#A8893A',
        },
      },
      fontFamily: {
        serif:   ['"Playfair Display"', 'Georgia', 'serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        ui:      ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
