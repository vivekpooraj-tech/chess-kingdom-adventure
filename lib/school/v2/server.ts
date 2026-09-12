import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { resolveActiveChild, type ChildProfile } from "@/lib/supabase/queries";
import { ACTIVE_CHILD_COOKIE_NAME } from "@/lib/childSession";
import { PARENT_PREMIUM_COLUMNS, type ParentPremiumRow } from "@/lib/premium/entitlement";
import type { SchoolProgress } from "@/content/school/types";
import {
  SCHOOL_ENTITLEMENT_COLUMNS,
  resolveSchoolAccess,
  type SchoolAccess,
  type SchoolEntitlementRow,
} from "./access";
import { loadSchoolProgressServer } from "./queries";

/**
 * Everything a Chess School page needs, resolved once on the server.
 *
 * The same four reads every route would otherwise repeat: who is signed in,
 * which child is active, whether this account has access, and where that child
 * is in the course. Kept together so the pages stay thin and so a change to
 * the access rule lands in one place.
 *
 * The premium and entitlement reads run in parallel and are allowed to fail
 * independently: a transient error reading the entitlement table (or the
 * table not existing yet because migration 0043 has not been applied) resolves
 * to the free tier, not to an error page. Failing closed on access is the
 * right side to fail on — it costs a paying parent a refresh; failing open
 * would give the course away on every database hiccup.
 */
export interface SchoolPageContext {
  child: ChildProfile;
  progress: SchoolProgress;
  access: SchoolAccess;
}

export async function loadSchoolPageContext(): Promise<SchoolPageContext> {
  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/sign-in");

  const cookieChildId = cookies().get(ACTIVE_CHILD_COOKIE_NAME)?.value ?? null;
  const resolution = await resolveActiveChild(supabase, user.id, cookieChildId);
  if (resolution.needsSelection) redirect("/choose-child");
  const child = resolution.child!;

  const parentPromise = supabase
    .from("parents")
    .select(`id, ${PARENT_PREMIUM_COLUMNS}`)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const [parentResult, progress] = await Promise.all([
    parentPromise.then((r) => r, () => null),
    loadSchoolProgressServer(supabase, child.id),
  ]);

  const parentRow = (parentResult?.data as (ParentPremiumRow & { id?: string }) | null) ?? null;

  let schoolRow: SchoolEntitlementRow | null = null;
  if (parentRow?.id) {
    try {
      const { data } = await supabase
        .from("school_entitlements")
        .select(SCHOOL_ENTITLEMENT_COLUMNS)
        .eq("parent_id", parentRow.id)
        .maybeSingle();
      schoolRow = (data as SchoolEntitlementRow | null) ?? null;
    } catch {
      schoolRow = null;
    }
  }

  return {
    child,
    progress,
    access: resolveSchoolAccess(parentRow, schoolRow),
  };
}
