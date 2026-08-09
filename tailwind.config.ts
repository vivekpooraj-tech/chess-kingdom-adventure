import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
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
        // THE single design language for the app going forward (Phase 10B).
        // Was introduced as "Classic Mode" chrome and grew organically
        // across Chess Mind / Opening Explorer / Academy / Kingdom Map —
        // by Phase 10B it's the de facto standard, so it's being formalized
        // as such rather than replaced with a third palette. Measured
        // against the Phase 10B brief's suggested midnight/navy/ivory/gold/
        // emerald direction: these values are already within a few points
        // of hue/lightness of that suggestion and are WCAG-verified (see
        // below), so kept rather than swapped for arbitrary new hex codes.
        // `kingdom` above remains for not-yet-migrated screens during the
        // incremental rollout (see Phase 10B implementation order) and for
        // deliberately extra-playful Adventure-mode touches (Kingdom Map
        // zone flavor, confetti, etc.) — not a competing system to replace,
        // a deliberately reserved register.
        //
        // Accessible text-opacity scale (verified via WCAG 2.1 contrast
        // math against midnight/midnightDeep/navy — see the ratios below).
        // Use these consistently instead of picking an opacity by eye:
        //   ivory / ivory-90   -> primary text, headings          (11–14:1)
        //   ivory/70           -> secondary text                   (7.5–8.8:1)
        //   ivory/50           -> muted/caption text (min for AA)  (4.5–4.9:1)
        //   ivory/40           -> large text (>=18px) or decorative/
        //                         disabled only — fails AA for body text (3.4–3.5:1)
        //   ivory/30 or below  -> DO NOT use for anything meant to be read;
        //                         decorative-only (2.1–2.5:1, fails AA)
        // `premium.gold` at full opacity passes AA on every background here
        // (7.3–9.3:1), so gold accents/links never need an opacity cut.
        premium: {
          midnight: "#0F1629",
          midnightDeep: "#080C18",
          navy: "#1B2440",
          navyLight: "#28315A",
          gold: "#D4AF37",
          goldMuted: "#B8944A",
          ivory: "#F7F3E8",
          cream: "#EFE7D8",
          emerald: "#146B4A",
          emeraldDeep: "#0D4A33",
        },
      },
      borderRadius: {
        btn: "24px",
        card: "20px",
        modal: "28px",
        // Tighter radii for the premium/Classic surface language — "avoid
        // excessive rounded cards" per design brief.
        premiumCard: "12px",
        premiumBtn: "10px",
      },
      fontFamily: {
        // Adventure Mode (existing, unchanged utility class names).
        display: ["var(--font-baloo)", "system-ui", "sans-serif"],
        body: ["var(--font-nunito)", "system-ui", "sans-serif"],
        // Classic Mode / premium chrome.
        "classic-display": ["var(--font-fraunces)", "Georgia", "serif"],
        "classic-body": ["var(--font-source-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        toy: "0 8px 0 0 rgba(0,0,0,0.15)",
        goldGlow: "0 0 24px rgba(255,197,61,0.6)",
        // Premium/Classic — softer, more restrained than the playful ones above.
        premiumCard: "0 1px 2px rgba(8,12,24,0.4), 0 12px 32px -12px rgba(8,12,24,0.55)",
        premiumGlow: "0 0 20px rgba(212,175,55,0.35)",
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
