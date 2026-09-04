// Parent Dashboard sits outside (tabs). The bottom nav / sidebar is now
// mounted once by AppShell in the root layout (components/nav/AppShell.tsx)
// — /parent-dashboard is in AppShell's app-chrome route set — so this
// layout is just the route-group boundary for its own loading.tsx.
export default function ParentDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
