/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/renderer/**/*.{html,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        whatsapp: {
          light: "#dcf8c6",
          DEFAULT: "#25d366",
          dark: "#128c7e",
          teal: "#075e54",
        },
      },
    },
  },
  plugins: [],
  darkMode: "class",
};
