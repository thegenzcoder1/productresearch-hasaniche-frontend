/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#1f2430',
        canvas: '#f6f7f9',
        accent: '#0d9488',
        pending: '#f59e0b',
        done: '#10b981',
        danger: '#ef4444',
      },
      borderRadius: { '2xl': '1rem' },
    },
  },
  plugins: [],
};
