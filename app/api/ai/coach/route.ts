import { NextRequest, NextResponse } from "next/server";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { getSkillSignals, getRecentGameReviews } from "@/lib/supabase/queries";
import { deriveLearnerProfile } from "@/lib/ollie/learnerContext";
import { buildOllieSystemPrompt } from "@/lib/ollie/systemPrompt";
import { isRateLimited } from "@/lib/ollie/rateLimit";
import { validateCoachRequest } from "@/lib/ollie/validate";
import { generateOllieResponse } from "@/lib/ollie/aiProvider";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const rawBody = await req.json().catch(() => null);
  const validated = validateCoachRequest(rawBody);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  const {
    message,
    history,
    boardFen,
    lessonTitle,
    dayNumber,
    lessonTopic,
    buddyName,
    childId,
    reviewContext,
    experienceLevel,
    ageBand,
  } = validated.data;

  if (!childId) {
    return NextResponse.json({ error: "childId is required" }, { status: 400 });
  }
  // RLS on `children` (supabase/migrations/0001_init.sql) already scopes
  // select to rows whose parent_id maps back to this auth.uid() -- so this
  // query IS the ownership check. A childId belonging to someone else's
  // account, or that doesn't exist, simply returns no row.
  const { data: child } = await supabase.from("children").select("id").eq("id", childId).maybeSingle();
  if (!child) {
    return NextResponse.json({ error: "Child not found" }, { status: 403 });
  }

  if (isRateLimited(user.id)) {
    // Checked before the learner reads below so a rate-limited caller can't
    // still make us pay for two queries.
    return NextResponse.json({
      reply: "Hoo! You're asking fast -- give me just a moment to catch up, then try again.",
      mocked: true,
      error: "rate_limited",
    });
  }

  // Cross-session awareness is derived HERE, from the child's own recorded
  // counters, rather than accepted from the request body — otherwise a caller
  // could hand Ollie invented claims about the child's history. Both reads are
  // best-effort and already swallow their own failures, so a signals outage
  // just means Ollie answers without the extra context.
  const [skillSignals, recentReviews] = await Promise.all([
    getSkillSignals(supabase, childId),
    getRecentGameReviews(supabase, childId),
  ]);
  const learnerProfile = deriveLearnerProfile(skillSignals, recentReviews);

  const systemPrompt = buildOllieSystemPrompt({
    lessonTitle,
    dayNumber,
    lessonTopic,
    buddyName,
    boardFen,
    reviewContext,
    experienceLevel,
    ageBand,
    learnerProfile,
  });

  // TODO(Phase 2): pass this reply through the age-appropriate content filter
  // and log a summary (not raw transcript) to ai_chat_logs per the DB schema.
  const result = await generateOllieResponse({ systemPrompt, message, history });

  return NextResponse.json({ reply: result.text, mocked: result.usedFallback, provider: result.provider });
}
