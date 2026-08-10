"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { WebSwingHero } from "@/components/WebSwingHero";
import { Logo } from "@/components/branding/Logo";

export default function SplashPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
      <WebSwingHero />
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut", delay: 1.2 }}
        className="text-7xl animate-floaty"
      >
        🏰
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 1.5 }}
        className="flex flex-col items-center gap-4"
      >
        <Logo variant="full" size={340} className="drop-shadow-lg" />
        <Link href="/sign-in">
          <Button size="lg">Start the Adventure! ✨</Button>
        </Link>
      </motion.div>
    </main>
  );
}
