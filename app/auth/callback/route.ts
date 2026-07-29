import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const supabase = createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Parent gate always comes right after auth, before any child-facing
  // screen — see app flow in docs/04-user-flows.md.
  return NextResponse.redirect(new URL("/parent-gate", request.url));
}
