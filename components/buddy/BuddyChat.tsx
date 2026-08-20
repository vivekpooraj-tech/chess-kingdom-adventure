"use client";

import { useEffect, useRef, useState } from "react";
import { BuddyAvatar } from "./BuddyAvatar";
import { SpeechBubble } from "@/components/ui/SpeechBubble";
import { Button } from "@/components/ui/Button";
import { TEXT } from "@/lib/designSystem";

interface BuddyChatProps {
  buddyEmoji: string;
  buddyName: string;
  greeting: string;
  boardFen?: string;
  lessonTitle?: string;
  dayNumber?: number;
  lessonTopic?: string;
  childId?: string | null;
  onDone?: () => void;
}

const HONEST_FAILURE_MESSAGE = "Owl hoot! I couldn't think of an answer right now. Try asking me again.";

export function BuddyChat({
  buddyEmoji,
  buddyName,
  greeting,
  boardFen,
  lessonTitle,
  dayNumber,
  lessonTopic,
  childId,
  onDone,
}: BuddyChatProps) {
  const [messages, setMessages] = useState<{ from: "buddy" | "child"; text: string }[]>([
    { from: "buddy", text: greeting },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // React state updates aren't synchronous, so a `loading` state check alone
  // can't stop two send() calls fired in the same tick (e.g. a rapid double
  // tap on mobile) from both reading `loading` as still false. This ref is
  // set/cleared synchronously so the second call always sees the lock.
  const sendingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  async function send() {
    if (!input.trim() || sendingRef.current) return;
    sendingRef.current = true;
    const childMessage = input.trim();
    const historyForRequest = messages;
    setMessages((m) => [...m, { from: "child", text: childMessage }]);
    setInput("");
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/ai/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          message: childMessage,
          boardFen,
          history: historyForRequest,
          lessonTitle,
          dayNumber,
          lessonTopic,
          buddyName,
          childId,
        }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { from: "buddy", text: data?.reply || HONEST_FAILURE_MESSAGE }]);
    } catch (err) {
      // AbortError means the component unmounted (see the cleanup effect
      // above) -- nothing left to show the message to, and updating state
      // on an unmounted component would just log a React warning.
      if ((err as { name?: string })?.name !== "AbortError") {
        setMessages((m) => [...m, { from: "buddy", text: HONEST_FAILURE_MESSAGE }]);
      }
    } finally {
      setLoading(false);
      sendingRef.current = false;
    }
  }

  return (
    <div className="flex flex-col gap-4 max-w-md mx-auto">
      <div className="flex items-end gap-3">
        <BuddyAvatar emoji={buddyEmoji} size="sm" talking={loading} />
        <span className="font-classic-display text-lg text-premium-ivory">{buddyName}</span>
      </div>

      <div className="flex flex-col gap-3 max-h-72 overflow-y-auto">
        {messages.map((m, i) =>
          m.from === "buddy" ? (
            <SpeechBubble key={i}>{m.text}</SpeechBubble>
          ) : (
            <div
              key={i}
              className="self-end bg-premium-gold/15 border border-premium-gold/30 text-premium-ivory rounded-premiumCard px-4 py-2 max-w-xs font-classic-body text-sm"
            >
              {m.text}
            </div>
          )
        )}
        {loading && <SpeechBubble>Ollie is thinking...</SpeechBubble>}
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask Ollie something..."
          aria-label="Ask Ollie something"
          className="flex-1 rounded-premiumBtn px-4 py-3 border border-white/15 bg-premium-midnightDeep text-premium-ivory font-classic-body placeholder:text-premium-ivory/30"
          maxLength={200}
        />
        <Button tone="premium" size="md" onClick={send} disabled={loading}>
          Send
        </Button>
      </div>

      <Button tone="premium" variant="ghost" size="md" onClick={onDone}>
        I'm ready, let's play →
      </Button>
    </div>
  );
}
