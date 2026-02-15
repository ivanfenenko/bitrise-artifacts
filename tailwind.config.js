/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0f0f0f',
        surface: '#1a1a1a',
        'surface-hover': '#252525',
        border: '#2a2a2a',
        primary: '#6366f1',
        'primary-hover': '#4f46e5',
        secondary: '#3b82f6',
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
        text: {
          primary: '#fafafa',
          secondary: '#a3a3a3',
          muted: '#737373',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}