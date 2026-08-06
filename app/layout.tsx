import type { Metadata } from "next";
import "./globals.css";
import { CapacitorDeepLinkHandler } from "@/components/CapacitorDeepLinkHandler";

export const metadata: Metadata = {
  title: "Chess Kingdom Adventure",
  description: "Learn chess through story, magic, and play.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <CapacitorDeepLinkHandler />
        {children}
      </body>
    </html>
  );
}
