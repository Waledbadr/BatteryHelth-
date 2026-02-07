/** @type {import('tailwindcss').Config} */
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "panel": "#111827",
        "panel-border": "#1f2937",
        "accent": "#38bdf8"
      }
    }
  },
  plugins: []
};
