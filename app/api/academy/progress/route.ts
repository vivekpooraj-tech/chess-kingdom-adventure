import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { ACTIVE_CHILD_COOKIE_NAME } from "@/lib/childSession";
import { resolveActiveChildCached, getCompletedAcademyContentIds } from "@/lib/supabase/queries";

/**
 * Completed Academy content ids for the signed-in child.
 *
 * Exists so the Learn page can show real progress while staying a static server
 * page. Learn is deliberately free of server-side Supabase calls — a previous
 * performance pass removed exactly that kind of per-visit personalized fetch —
 * so progress is filled in afterwards by a small client island instead of
 * blocking the page's first paint.
 *
 * Returns ids only. Counting and labelling happen in the UI, against real
 * completion rows; nothing here is estimated.
 */
export async function GET() {
  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (!user) return NextResponse.json({ completed: [] }, { headers: { "Cache-Control": "no-store" } });

  const cookieChildId = cookies().get(ACTIVE_CHILD_COOKIE_NAME)?.value ?? null;
  const resolution = await resolveActiveChildCached(supabase, user.id, cookieChildId);
  if (!resolution.child) {
    return NextResponse.json({ completed: [] }, { headers: { "Cache-Control": "no-store" } });
  }

  const completed = await getCompletedAcademyContentIds(supabase, resolution.child.id).catch(
    () => [] as string[]
  );

  return NextResponse.json({ completed }, { headers: { "Cache-Control": "no-store" } });
}
