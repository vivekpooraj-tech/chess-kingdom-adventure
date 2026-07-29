"use client";

import { useState } from "react";
import { BuddyAvatar } from "./BuddyAvatar";
import { SpeechBubble } from "@/components/ui/SpeechBubble";
import { Button } from "@/components/ui/Button";

interface BuddyChatProps {
  buddyEmoji: string;
  buddyName: string;
  greeting: string;
  boardFen?: string;
  onDone?: () => void;
}

export function BuddyChat({ buddyEmoji, buddyName, greeting, boardFen, onDone }: BuddyChatProps) {
  const [messages, setMessages] = useState<{ from: "buddy" | "child"; text: string }[]>([
    { from: "buddy", text: greeting },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send() {
    if (!input.trim() || loading) return;
    const childMessage = input.trim();
    setMessages((m) => [...m, { from: "child", text: childMessage }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: childMessage, boardFen }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { from: "buddy", text: data.reply }]);
    } catch {
      setMessages((m) => [
        ...m,
        { from: "buddy", text: "Hoo! My wings got tangled — can you ask me again?" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 max-w-md mx-auto">
      <div className="flex items-end gap-3">
        <BuddyAvatar emoji={buddyEmoji} size="sm" talking={loading} />
        <span className="font-display text-lg text-kingdom-night">{buddyName}</span>
      </div>

      <div className="flex flex-col gap-3 max-h-72 overflow-y-auto">
        {messages.map((m, i) =>
          m.from === "buddy" ? (
            <SpeechBubble key={i}>{m.text}</SpeechBubble>
          ) : (
            <div key={i} className="self-end bg-kingdom-royal text-white rounded-card px-4 py-2 max-w-xs">
              {m.text}
            </div>
          )
        )}
        {loading && <SpeechBubble>...</SpeechBubble>}
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask Ollie something..."
          className="flex-1 rounded-btn px-4 py-3 border-2 border-kingdom-night/10 font-body text-lg"
          maxLength={200}
        />
        <Button size="md" onClick={send} disabled={loading}>
          Send
        </Button>
      </div>

      <Button variant="ghost" size="md" onClick={onDone}>
        I'm ready, let's play! →
      </Button>
    </div>
  );
}
