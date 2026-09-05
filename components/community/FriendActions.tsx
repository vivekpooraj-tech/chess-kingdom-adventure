"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TEXT } from "@/lib/designSystem";
import { createClient } from "@/lib/supabase/client";
import { sendFriendRequest, respondToFriendRequest } from "@/lib/supabase/queries";

/**
 * The interactive parts of the friends page.
 *
 * A small client island rather than a client page: the lists themselves are
 * server-rendered, and only the code box and the accept/decline buttons need
 * JavaScript.
 *
 * Every write goes through a SECURITY DEFINER function that re-checks ownership
 * server-side (migration 0034). Nothing here is trusted — this component only
 * reports what the server decided.
 */

const MESSAGES: Record<string, string> = {
  pending: "Request sent. They will see it next time they open Chess Mind.",
  accepted: "You are now friends — they had already sent you a request.",
  already_friends: "You are already friends.",
  not_found: "No player found with that code. Check it and try again.",
  self: "That is your own code.",
  not_authorized: "You cannot send a request as that player.",
  not_enabled: "Friends are not switched on for this app yet.",
  error: "Something went wrong. Try again in a moment.",
};

export function AddFriendBox({ childId }: { childId: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setMessage(null);
    const result = await sendFriendRequest(createClient(), childId, trimmed.toUpperCase());
    setMessage(MESSAGES[result] ?? MESSAGES.error);
    setBusy(false);
    if (result === "pending" || result === "accepted") {
      setCode("");
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label htmlFor="friend-code" className={TEXT.caption}>
        Enter a friend&apos;s code
      </label>
      <div className="flex gap-2">
        <input
          id="friend-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="ABCD2345"
          autoComplete="off"
          spellCheck={false}
          maxLength={12}
          className="min-h-[48px] flex-1 rounded-premiumBtn border border-white/15 bg-premium-navy/70 px-3 font-classic-body text-base uppercase tracking-widest text-premium-ivory placeholder:text-premium-ivory/30 focus:border-premium-gold/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60"
        />
        <Button tone="premium" type="submit" disabled={busy || !code.trim()}>
          {busy ? "Sending…" : "Add"}
        </Button>
      </div>
      {message && (
        <p className={TEXT.body} role="status">
          {message}
        </p>
      )}
    </form>
  );
}

export function RespondButtons({
  childId,
  friendshipId,
  kind,
}: {
  childId: string;
  friendshipId: string;
  kind: "incoming" | "accepted" | "outgoing";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(action: "accept" | "decline" | "remove" | "block") {
    if (busy) return;
    setBusy(true);
    await respondToFriendRequest(createClient(), childId, friendshipId, action);
    setBusy(false);
    router.refresh();
  }

  if (kind === "incoming") {
    return (
      <div className="flex flex-none gap-2">
        <Button tone="premium" size="sm" onClick={() => act("accept")} disabled={busy}>
          Accept
        </Button>
        <Button tone="premium" variant="ghost" size="sm" onClick={() => act("decline")} disabled={busy}>
          Decline
        </Button>
      </div>
    );
  }

  return (
    <Button
      tone="premium"
      variant="ghost"
      size="sm"
      onClick={() => act("remove")}
      disabled={busy}
      className="flex-none"
    >
      {kind === "outgoing" ? "Cancel" : "Remove"}
    </Button>
  );
}
