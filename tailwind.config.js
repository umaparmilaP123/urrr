/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkslate: "#0f172a",
        electricblue: "#2563eb",
        crimsonpulse: "#ef4444",
        amberorange: "#f97316",
        brightyellow: "#eab308",
        emeraldgreen: "#10b981",
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-red': 'glowRed 2s infinite alternate',
      },
      keyframes: {
        glowRed: {
          '0%': { boxShadow: '0 0 4px rgba(239, 68, 68, 0.2), inset 0 0 4px rgba(239, 68, 68, 0.1)' },
          '100%': { boxShadow: '0 0 16px rgba(239, 68, 68, 0.6), inset 0 0 8px rgba(239, 68, 68, 0.3)' }
        }
      }
    },
  },
  plugins: [],
}
