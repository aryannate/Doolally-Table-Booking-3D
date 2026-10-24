/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        slab: ['"Zilla Slab"', 'Georgia', 'serif'],
      },
      colors: {
        ink: { DEFAULT: '#1f1c19', soft: '#5d5650', mute: '#8f877e' },
        paper: { DEFAULT: '#f6f3ee', card: '#fffdfa', line: '#ebe5dc' },
        wood: '#d6a466',
        sel: '#2f7cf6',
        booked: '#d9574c',
        held: '#e9a02a',
        avail: '#3fa465',
      },
      boxShadow: {
        card: '0 1px 2px rgba(40,30,20,.06), 0 8px 28px -6px rgba(40,30,20,.16)',
        pill: '0 1px 2px rgba(40,30,20,.06), 0 4px 14px -4px rgba(40,30,20,.12)',
      },
    },
  },
  plugins: [],
}
