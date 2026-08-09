import { ReactNode } from "react";

export function SpeechBubble({ children }: { children: ReactNode }) {
  return (
    <div className="relative bg-premium-navy border border-premium-gold/20 rounded-premiumCard shadow-premiumCard px-5 py-4 max-w-sm">
      <p className="font-classic-body text-base text-premium-ivory">{children}</p>
      <div className="absolute -bottom-2 left-8 w-4 h-4 bg-premium-navy border-r border-b border-premium-gold/20 rotate-45" />
    </div>
  );
}
