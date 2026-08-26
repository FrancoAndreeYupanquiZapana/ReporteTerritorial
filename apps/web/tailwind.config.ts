import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ronap: {
          green: '#2d6a4f',
          'green-light': '#40916c',
          'green-dark': '#1b4332',
          cream: '#f5f0e1',
          gold: '#d4a843',
        },
      },
    },
  },
  plugins: [],
};

export default config;
