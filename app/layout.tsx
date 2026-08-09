import type { Metadata } from "next";
import { Baloo_2, Nunito, Fraunces, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import { CapacitorDeepLinkHandler } from "@/components/CapacitorDeepLinkHandler";
import { MotionProvider } from "@/components/MotionProvider";
import { BRAND } from "@/lib/brand";

// Adventure Mode faces. These were referenced in tailwind.config.ts as bare
// family names ("'Baloo 2'", "'Nunito'") with no @font-face ever declared,
// so every screen has silently been rendering in the browser's default
// sans-serif this whole time — next/font self-hosts and loads them for real.
const baloo2 = Baloo_2({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-baloo",
});
const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-nunito",
});

// Classic Mode / premium chrome faces.
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
});
const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-source-sans",
});

export const metadata: Metadata = {
  title: BRAND.name,
  description: BRAND.tagline,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${baloo2.variable} ${nunito.variable} ${fraunces.variable} ${sourceSans.variable}`}
    >
      <body className="min-h-screen">
        <CapacitorDeepLinkHandler />
        {/* Every framer-motion animation in the app (lesson transitions,
            achievement unlocks, board taps, confetti) automatically respects
            the OS-level prefers-reduced-motion setting via this one wrapper,
            rather than each animated component needing its own check. */}
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
