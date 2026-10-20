import type { Config } from 'tailwindcss';
const config: Config = { content: ['./app/**/*.{js,ts,jsx,tsx,mdx}','./components/**/*.{js,ts,jsx,tsx,mdx}'], theme: { extend: { colors: { vihaar: { green: '#00994D', deep: '#006B38', ink: '#171917', cream: '#F7F7F1', gold: '#C99A36' } }, fontFamily: { sans: ['Arial','Helvetica','sans-serif'] } } }, plugins: [] };
export default config;
