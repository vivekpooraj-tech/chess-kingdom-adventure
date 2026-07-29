import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chess Kingdom Adventure",
  description: "Learn chess through story, magic, and play.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
