"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/branding/Logo";
import { TEXT } from "@/lib/designSystem";

/**
 * The signed-out splash screen (Phase 17) — first thing anyone sees. Built
 * entirely from existing design tokens/CSS (no new image assets): a dark
 * premium backdrop evoking chess history without literally illustrating it,
 * since the official logo (public/Assets/logo/chess-mind-full.png) already
 * depicts the Chaturanga-to-modern-chess story in detail — a second literal
 * retelling behind it would compete rather than complement. The backdrop
 * here stays abstract: warm light from above, a chessboard floor receding
 * into the dark, a few drifting motes.
 */
const PARTICLES = [
  { left: "18%", top: "20%", size: 4, duration: 5.5, delay: 0 },
  { left: "80%", top: "16%", size: 3, duration: 6.5, delay: 0.8 },
  { left: "10%", top: "58%", size: 3, duration: 6, delay: 1.6 },
  { left: "88%", top: "54%", size: 4, duration: 5, delay: 0.4 },
  { left: "50%", top: "10%", size: 2.5, duration: 7, delay: 1.2 },
];

export default function SplashPage() {
  return (
    <main className="relative min-h-screen overflow-hidden flex flex-col items-center justify-center gap-8 px-6 py-12 text-center bg-premium-midnight">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Warm light from above — the one strong light source, not a
            literal sunrise, echoing the "ancient court at dawn" feel. */}
        <motion.div
          className="absolute left-1/2 top-[6%] -translate-x-1/2 h-[420px] w-[420px] rounded-full bg-premium-gold/[0.14] blur-[110px]"
          animate={{ opacity: [0.5, 0.85, 0.5] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* A modern chessboard floor, receding into the dark — the "arrival
            point" of the journey the logo above already depicts. */}
        <div
          className="absolute inset-x-[-10%] bottom-0 h-[38%] opacity-[0.16]"
          style={{
            backgroundImage: "repeating-conic-gradient(#D4AF37 0% 25%, transparent 0% 50%)",
            backgroundSize: "72px 72px",
            transform: "perspective(560px) rotateX(58deg)",
            transformOrigin: "bottom",
            maskImage: "linear-gradient(to top, black, transparent)",
            WebkitMaskImage: "linear-gradient(to top, black, transparent)",
          }}
        />
        {PARTICLES.map((p, i) => (
          <motion.span
            key={i}
            className="absolute rounded-full bg-premium-gold/40"
            style={{ left: p.left, top: p.top, width: p.size, height: p.size }}
            animate={{ opacity: [0.15, 0.6, 0.15], y: [0, -14, 0] }}
            transition={{ duration: p.duration, repeat: Infinity, ease: "easeInOut", delay: p.delay }}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="relative flex flex-col items-center gap-6 max-w-sm"
      >
        <div className="relative">
          <div aria-hidden className="absolute inset-0 scale-125 rounded-full bg-premium-gold/20 blur-3xl" />
          <Logo variant="full" size={252} className="relative" />
        </div>

        <p className={TEXT.body}>From Chaturanga to the modern game.</p>

        <div className="flex flex-col items-center gap-4 mt-2">
          <Link href="/sign-in">
            <Button tone="premium" size="lg">
              Start Your Journey →
            </Button>
          </Link>
          <Link
            href="/sign-in"
            className="font-classic-body text-sm text-premium-ivory/50 hover:text-premium-ivory/80 underline-offset-4 hover:underline transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60 rounded-sm"
          >
            Already have an account? Sign in
          </Link>
        </div>
      </motion.div>
    </main>
  );
}
