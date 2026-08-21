import { TabShellNav } from "@/components/nav/TabShellNav";

// Persistent shell for the 5 primary tabs (Home/Puzzles/Play/Learn/More) --
// a route group (the parens are invisible to the URL, so /kingdom-map etc.
// are unchanged) so PrimaryNav renders from ONE place instead of once per
// page. Before this, every one of these pages imported and rendered its
// own <PrimaryNav />, which meant Next.js unmounted and remounted the nav
// (and everything else in the tree) on every single tab switch -- the
// primary cause of navigation feeling like a full page reload instead of
// an instant tab change. Now it's the same mounted component across the
// whole cycle; only `children` swaps.
export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-premium-midnight">
      <TabShellNav />
      {/* Offset main content above the bottom tab bar on all screen sizes */}
      <div>{children}</div>
    </div>
  );
}
