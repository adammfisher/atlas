/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Claude-inspired dark theme
        primary: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        surface: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          750: '#2a2a2a',
          800: '#262626',
          850: '#1f1f1f',
          900: '#171717',
          950: '#0a0a0a',
        },
        claude: {
          bg: '#1A1A1A',
          sidebar: '#212121',
          border: '#2A2A2A',
          hover: '#2A2A2A',
          accent: '#CC7A3F',
        }
      }
    },
  },
  plugins: [],
}
