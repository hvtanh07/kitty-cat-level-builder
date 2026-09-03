/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        wood: {
          light: '#f5ddb8',
          DEFAULT: '#e6c387',
          dark: '#b58a47',
          deep: '#784e1b'
        }
      },
      boxShadow: {
        '3d-btn': '0 4px 0 #b38234, 0 6px 10px rgba(0,0,0,0.25)',
        '3d-btn-active': '0 1px 0 #b38234, 0 2px 4px rgba(0,0,0,0.25)',
        '3d-box': '0 6px 0 rgba(0,0,0,0.2), 0 8px 15px rgba(0,0,0,0.25)',
        'inner-tray': 'inset 0 3px 8px rgba(0,0,0,0.35)'
      },
      fontFamily: {
        game: ['Nunito', 'ui-rounded', 'system-ui', 'sans-serif']
      }
    },
  },
  plugins: [],
}
