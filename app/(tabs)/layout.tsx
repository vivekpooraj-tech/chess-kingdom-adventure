// Route group for the five primary tabs (Home/Puzzles/Play/Learn/More). The
// parens are invisible to the URL, so /kingdom-map etc. are unchanged.
//
// The persistent bottom nav / sidebar now lives in AppShell (mounted once
// in the root layout — components/nav/AppShell.tsx), so this layout no
// longer renders navigation itself. It stays as the route group's boundary
// (for its shared loading.tsx and so the group reads intentionally); the
// premium ground is already painted by <body> and by each page's own
// <Screen> wrapper.
export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
