import type { Metadata, Viewport } from "next";
import { Baloo_2, Nunito, Fraunces, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import { CapacitorDeepLinkHandler } from "@/components/CapacitorDeepLinkHandler";
import { MotionProvider } from "@/components/MotionProvider";
import { DevTestModeBar } from "@/components/dev/DevTestModeBar";
import { NativeLayoutProvider } from "@/components/nav/NativeLayoutProvider";
import { LayoutBootstrapScript } from "@/components/nav/LayoutBootstrapScript";
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

const metaDescription = `${BRAND.name} — ${BRAND.tagline}`;

export const metadata: Metadata = {
  // Without this, Next.js resolves the relative OG/Twitter image paths
  // below against "http://localhost:3000" even in production builds.
  metadataBase: new URL("https://chess-kingdom-adventure-opal.vercel.app"),
  title: BRAND.name,
  description: metaDescription,
  openGraph: {
    title: BRAND.name,
    description: metaDescription,
    // Casing is exact and load-bearing here — see components/branding/Logo.tsx.
    images: ["/Assets/logo/chess-mind-full.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND.name,
    description: metaDescription,
    images: ["/Assets/logo/chess-mind-full.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${baloo2.variable} ${nunito.variable} ${fraunces.variable} ${sourceSans.variable}`}
    >
      <body className="min-h-screen">
        <LayoutBootstrapScript />
        <NativeLayoutProvider>
          <CapacitorDeepLinkHandler />
          {/* Every framer-motion animation in the app (lesson transitions,
              achievement unlocks, board taps, confetti) automatically respects
              the OS-level prefers-reduced-motion setting via this one wrapper,
              rather than each animated component needing its own check. */}
          <MotionProvider>{children}</MotionProvider>
          {/* Renders nothing unless LOCAL_TEST_MODE is on (lib/devTestMode.ts) —
              see that file for why a production build can't activate it. */}
          <DevTestModeBar />
        </NativeLayoutProvider>
      </body>
    </html>
  );
}
