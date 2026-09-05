import { cookies } from "next/headers";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { resolveActiveChild, getCompletedAcademyContentIds } from "@/lib/supabase/queries";
import { ACTIVE_CHILD_COOKIE_NAME } from "@/lib/childSession";

/**
 * Completed content ids for the signed-in child, for course index pages.
 *
 * SERVER ONLY.
 *
 * Never throws and never redirects. A course index is a reading page — being
 * signed out, or a Supabase hiccup, should show the curriculum with nothing
 * marked complete rather than bounce the visitor to a sign-in screen or blow up
 * the render. This mirrors the "a transient failure is not a logged-out user"
 * rule the auth layer already follows elsewhere in this codebase.
 */
export async function getCompletedContentIds(): Promise<Set<string>> {
  try {
    const supabase = createClient();
    const user = await getSessionUser(supabase);
    if (!user) return new Set();

    const cookieChildId = cookies().get(ACTIVE_CHILD_COOKIE_NAME)?.value ?? null;
    const resolution = await resolveActiveChild(supabase, user.id, cookieChildId);
    const child = resolution.child;
    if (!child) return new Set();

    return new Set(await getCompletedAcademyContentIds(supabase, child.id));
  } catch {
    return new Set();
  }
}
