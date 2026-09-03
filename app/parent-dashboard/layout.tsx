import { PrimaryNav } from "@/components/nav/PrimaryNav";

/** Parent dashboard sits outside (tabs) — mount bottom nav here so it
 *  persists across the page and its loading skeleton. */
export default function ParentDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <PrimaryNav />
    </>
  );
}
