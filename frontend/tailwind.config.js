/** @type {import('tailwindcss').Config} */
module.exports = { content: ['./app/**/*.{ts,tsx}','./components/**/*.{ts,tsx}'],
theme: { extend: { colors: {
  navy: '#07152E', navy2: '#0f1f3d',
  primary: '#145BEE', brand: '#1d4ed8', branddark: '#1e3a8a',
  workspace: '#F1F7FE', line: '#DCE6F2',
  ok: '#10A779', warn: '#F4A51C', crit: '#EF4444', info: '#64748B',
} } }, plugins: [] };
