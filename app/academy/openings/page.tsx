import { backLabel } from "@/lib/navigation/destinations";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { resolveActiveChild, getOpeningEncounters } from "@/lib/supabase/queries";
import { ACTIVE_CHILD_COOKIE_NAME } from "@/lib/childSession";
import { Screen } from "@/components/layout/Screen";
import { OpeningExplorerClient } from "@/components/openings/OpeningExplorerClient";

export default async function OpeningExplorerPage() {
  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/sign-in");

  const cookieChildId = cookies().get(ACTIVE_CHILD_COOKIE_NAME)?.value ?? null;
  const resolution = await resolveActiveChild(supabase, user.id, cookieChildId);
  if (resolution.needsSelection) redirect("/choose-child");

  const child = resolution.child!;
  if (!child.avatar_id || !child.buddy_id) redirect("/onboarding/avatar");

  const encounters = await getOpeningEncounters(supabase, child.id);

  return (
    <>
      <Screen maxWidth="compact" topSafeArea="icons">
        <OpeningExplorerClient encounters={encounters} />
        <Link
          href="/learn"
          className="inline-flex items-center min-h-[44px] font-body text-sm text-premium-ivory/65 underline underline-offset-2"
        >
          {backLabel("LEARN")}
        </Link>
      </Screen>
    </>
  );
}
