import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f3f4ff',
          500: '#5865f2',
          600: '#4f5ee7',
          700: '#3e49be',
        },
      },
    },
  },
  plugins: [],
};

export default config;
