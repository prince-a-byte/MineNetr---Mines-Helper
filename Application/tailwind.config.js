/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        navy: '#0B3154',
        primary: '#1463D9',
        mist: '#EAF3FF',
        appbg: '#F4F7FB',
        ink: '#14253B',
        sub: '#68788D',
        ok: '#159B72',
        warn: '#E8A02B',
        danger: '#DC4C58',
        line: '#E1E8F0',
      },
      borderRadius: {
        card: 16,
        pill: 999,
      },
    },
  },
  plugins: [],
};
