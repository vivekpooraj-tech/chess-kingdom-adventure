"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";

export default function SplashPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 px-6 text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="text-8xl animate-floaty"
      >
        🏰
      </motion.div>
      <h1 className="font-display text-5xl text-kingdom-night drop-shadow-sm">
        Chess Kingdom
        <br />
        Adventure
      </h1>
      <p className="font-body text-lg text-kingdom-night/70 max-w-sm">
        Rescue the Chess Kingdom, one magical crystal at a time!
      </p>
      <Link href="/sign-in">
        <Button size="lg">Start the Adventure! ✨</Button>
      </Link>
    </main>
  );
}
