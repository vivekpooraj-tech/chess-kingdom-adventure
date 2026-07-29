import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        kingdom: {
          gold: "#FFC53D",
          amber: "#FF9F1C",
          leaf: "#4ADE80",
          forest: "#16803C",
          sky: "#38BDF8",
          royal: "#6D5AE6",
          coral: "#FF6B6B",
          night: "#241E4E",
        },
        semantic: {
          reward: "#FFC53D",
          retry: "#FF8A8A",
          info: "#5AC8FA",
        },
      },
      borderRadius: {
        btn: "24px",
        card: "20px",
        modal: "28px",
      },
      fontFamily: {
        display: ["'Baloo 2'", "system-ui", "sans-serif"],
        body: ["'Nunito'", "system-ui", "sans-serif"],
      },
      boxShadow: {
        toy: "0 8px 0 0 rgba(0,0,0,0.15)",
        goldGlow: "0 0 24px rgba(255,197,61,0.6)",
      },
      keyframes: {
        squish: {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(0.92)" },
          "100%": { transform: "scale(1)" },
        },
        floaty: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
      animation: {
        squish: "squish 150ms ease-in-out",
        floaty: "floaty 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
