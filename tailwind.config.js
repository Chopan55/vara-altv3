/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          200: '#c7d7fe',
          300: '#a5bcfd',
          400: '#8196fa',
          500: '#6270f5',
          600: '#4f52e9',
          700: '#4240ce',
          800: '#3737a6',
          900: '#323484',
          950: '#1e1d4d',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 2px 8px 0 rgba(0,0,0,0.06)',
        card: '0 1px 3px 0 rgba(0,0,0,0.08)',
        elevated: '0 4px 16px 0 rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
}
