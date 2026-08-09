import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveChild, getOpeningEncounters } from "@/lib/supabase/queries";
import { ACTIVE_CHILD_COOKIE_NAME } from "@/lib/childSession";
import { PrimaryNav } from "@/components/nav/PrimaryNav";
import { OpeningExplorerClient } from "@/components/openings/OpeningExplorerClient";

export default async function OpeningExplorerPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const cookieChildId = cookies().get(ACTIVE_CHILD_COOKIE_NAME)?.value ?? null;
  const resolution = await resolveActiveChild(supabase, user.id, cookieChildId);
  if (resolution.needsSelection) redirect("/choose-child");

  const child = resolution.child!;
  if (!child.avatar_id || !child.buddy_id) redirect("/onboarding/avatar");

  const encounters = await getOpeningEncounters(supabase, child.id);

  return (
    <>
      <main className="min-h-screen bg-premium-midnight flex flex-col items-center gap-6 px-6 pt-10 pb-24">
        <OpeningExplorerClient encounters={encounters} />
        <Link
          href="/academy"
          className="font-body text-sm text-premium-ivory/40 underline underline-offset-2"
        >
          Back to the Academy
        </Link>
      </main>
      <PrimaryNav />
    </>
  );
}
