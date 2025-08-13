/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        soft: "0 6px 20px rgba(0,0,0,0.06)"
      },
      borderRadius: {
        '2xl': "1rem"
      }
    },
  },
  plugins: [],
};