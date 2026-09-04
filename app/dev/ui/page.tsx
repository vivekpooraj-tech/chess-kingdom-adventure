import { notFound } from "next/navigation";
import { LOCAL_TEST_MODE } from "@/lib/devTestMode";
import { UiGalleryClient } from "./UiGalleryClient";

/**
 * UI-2B — a dev-only gallery of the core UI primitives (Surface, Button,
 * Section, PageHeader, Chip, Avatar, ProgressRing, Sheet, EmptyState,
 * ErrorState, Tabs, Segmented) for visual + a11y + responsive checking
 * before any screen migration.
 *
 * Same guard as /dev/premium-preview: a real 404 whenever LOCAL_TEST_MODE
 * is off — which lib/devTestMode.ts forces to false in every production
 * build regardless of env vars — so this route does not exist for real
 * users. It renders no real data, reads/writes nothing.
 */
export default function UiGalleryPage() {
  if (!LOCAL_TEST_MODE) notFound();
  return <UiGalleryClient />;
}
