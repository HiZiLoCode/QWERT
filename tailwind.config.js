/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/ui/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'spin-fast': 'spin 500ms linear infinite',
        'rotateBg': 'rotateBg 12s linear infinite',
      },
      keyframes: {
        rotateBg: {
          '0%': { transform: 'rotate(0deg) scale(1)' },
          '50%': { transform: 'rotate(180deg) scale(1.05)' },
          '100%': { transform: 'rotate(360deg) scale(1)' },
        },
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        'w': {
          '1': '#f2f3f7',
          '2': '#E5E9F0'
        },
        'blue': {
          "1": '#0066FF',
          "2": 'rgba(0, 102, 255, 0.1)',
        },
        'grey': {
          "0": '#E5E9F0',
          "1": '#F2F3F7',
          "2": '#F8F9FB',
          "3": '#D7DEE3',
        },
        'success': '#32AA70',
        'error': '#EA5E56',
        'black': {
          '1': '#151515',
          '2': '#212225',
          '3': '#303134',
        },
        'yellow': {
          '1': '#F59C25',
          '2': '#EB8E12',
        },
        'line': {
          '0': '#4A4B50',
          '1': '#AEAEAE',
          '2': '#D7DEE3',
        },
        'red': {
          '1': '#EA5E56',
          '2': '#DD4E45'
        },
        'green': {
          '1': '#32AA70',
          '2': '#17A05E',
        },
        "zen-gray": {
          "50": "#DEE9FC",
          "100": "#E0EEF8",
          "200": "#E0EEF8",
          "300": "#D4E0F8",
          "400": "#B8CBEC",
          "500": "#3479F5",
          "600": "#3479F5",
          "700": "#C1D1EE",
          "800": "#3479F5",
          "900": "#3479F5",
        }
      },
      screens: {
        'keyboard-lg': '1485px',
      },
    },
  },
  plugins: [],
};
