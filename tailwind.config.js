/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#0f172a',       // headings / strong text
        body: '#334155',      // default body text (bold gray)
        muted: '#64748b',     // secondary text
        canvas: '#eef1f6',    // app background
        accent: '#6366f1',    // indigo-500 (primary)
        'accent-dark': '#4f46e5',
        pending: '#f59e0b',
        done: '#10b981',
        danger: '#ef4444',
        violet: '#8b5cf6',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)',
        lift: '0 8px 24px -6px rgba(16,24,40,0.14), 0 2px 6px rgba(16,24,40,0.06)',
        glow: '0 8px 24px -6px rgba(99,102,241,0.45)',
      },
      borderRadius: { '2xl': '1rem', '3xl': '1.5rem' },
    },
  },
  plugins: [],
};
