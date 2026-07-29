import { ReactNode } from "react";

export function SpeechBubble({ children }: { children: ReactNode }) {
  return (
    <div className="relative bg-white rounded-card shadow-toy px-5 py-4 max-w-sm">
      <p className="font-body text-lg text-kingdom-night">{children}</p>
      <div className="absolute -bottom-2 left-8 w-4 h-4 bg-white rotate-45" />
    </div>
  );
}
