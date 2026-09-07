import { notFound } from "next/navigation";
import { getLocation, isPlayable, WORLD_LOCATIONS } from "@/lib/world/locations";
import { LocationPreview } from "@/components/world/LocationPreview";

/**
 * The pre-game screen for one location.
 *
 * Deliberately OUTSIDE the (tabs) group. This is a full-bleed cinematic screen
 * — the scene runs edge to edge — and the tab chrome would box it in. It is
 * the same reasoning that puts /free-play and /online outside the group.
 *
 * Unbuilt locations 404 rather than rendering a preview of nothing: a card
 * marked "coming soon" that opened a real page would be a worse lie than the
 * lock icon.
 */
export function generateStaticParams() {
  return WORLD_LOCATIONS.filter(isPlayable).map((l) => ({ locationId: l.id }));
}

export default function LocationPage({ params }: { params: { locationId: string } }) {
  const location = getLocation(params.locationId);
  if (!isPlayable(location) || !location) notFound();

  return <LocationPreview location={location} />;
}
